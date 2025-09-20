const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

// Ensure JSON body parsing available for this router
router.use(express.json({ limit: '2mb' }));

// Simple token-bucket to simulate upstream rate-limits when no API key is configured
const TOKEN_BUCKET_CAPACITY = Number(process.env.PROXY_TOKEN_BUCKET_CAPACITY) || 10;
const TOKEN_REFILL_PER_SEC = Number(process.env.PROXY_TOKEN_REFILL_PER_SEC) || 1; // tokens per second
const buckets = new Map();

function getBucket(key) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: TOKEN_BUCKET_CAPACITY, lastRefill: now };
    buckets.set(key, b);
  }
  const elapsed = Math.max(0, now - b.lastRefill);
  const refill = (elapsed / 1000) * TOKEN_REFILL_PER_SEC;
  if (refill > 0) {
    b.tokens = Math.min(TOKEN_BUCKET_CAPACITY, b.tokens + refill);
    b.lastRefill = now;
  }
  return b;
}

router.post('/dbquery', async (req, res) => {
  try {
  // Backwards-compatible environment variable: prefer HF_KEY, fall back to ZEROCODEDB_API_KEY, then OPENAI_API_KEY
  const API_KEY = (process.env.HF_KEY || process.env.ZEROCODEDB_API_KEY || process.env.OPENAI_API_KEY || '').trim();

  // Decide upstream target
  const useOpenAIUpstream = !!(process.env.OPENAI_API_KEY) && !process.env.HF_KEY && !process.env.ZEROCODEDB_API_KEY;
  // Prefer an explicit upstream URL for HF if provided. Otherwise use HF inference base + optional HF_MODEL env
  const HF_UPSTREAM_BASE = (process.env.HF_UPSTREAM_BASE || 'https://api-inference.huggingface.co').replace(/\/+$/, '');
  const hfModel = (process.env.HF_MODEL || '').replace(/^\/+|\/+$/g, '');
  const hfDefaultUpstream = hfModel ? `${HF_UPSTREAM_BASE}/models/${hfModel}` : HF_UPSTREAM_BASE + '/models';
  const upstreamUrl = useOpenAIUpstream ? 'https://api.openai.com/v1/chat/completions' : (process.env.HF_UPSTREAM_URL || hfDefaultUpstream);

  // If no API key is configured, reject early with an explicit error.
  // Production deployments should set HF_KEY or HF_TOKEN (or OPENAI_API_KEY when using OpenAI upstream).
  if (!API_KEY) {
    console.warn('[PROXY] no upstream API key configured; rejecting request');
    return res.status(502).json({ error: 'No upstream API key configured. Set HF_KEY or HF_TOKEN (or OPENAI_API_KEY).' });
  }

    // If upstream would point back to this same server's AI route, call the local handler
    // to avoid an HTTP recursion (proxy -> same host -> proxy -> ...)
    try {
      const localHostnames = [process.env.FRONTEND_ORIGIN || '', process.env.SELF_HOST || '', 'http://localhost:' + (process.env.PORT || 5000)];
      // If we're targeting zerocodedb.online and the runtime appears to be the same host,
      // prefer invoking the local AI handler directly when available.
      if (!useOpenAIUpstream && (() => {
        try {
          const host = (process.env.SELF_HOST || '').toString();
          // If SELF_HOST is configured to the same domain as zerocodedb.online, use local handler.
          return !!host || true; // prefer local handler when possible
        } catch (e) { return false; }
      })()) {
        try {
          const hfRouter = require('../src/api/dbquery.hf.cjs');
          if (hfRouter && hfRouter.handleDbQuery && typeof hfRouter.handleDbQuery === 'function') {
            // Reuse local handler: it expects (req, res, next)
            return hfRouter.handleDbQuery(req, res);
          }
        } catch (e) {
          // no local HF router available - fallthrough to axios
        }
      }

    } catch (e) {
      // ignore and continue to upstream axios call
    }

    // Real upstream proxying when API key is present (upstreamUrl chosen above)
    console.log('[PROXY] forwarding to upstream:', upstreamUrl, 'useOpenAI:', useOpenAIUpstream ? 'yes' : 'no');

    // Generate or propagate request id for tracing
    const crypto = require('crypto');
    const incomingReqId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    const requestId = incomingReqId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random()*100000)}`);

    const maxAttempts = Number(process.env.PROXY_UPSTREAM_MAX_ATTEMPTS || 3);
    const baseDelayMs = Number(process.env.PROXY_UPSTREAM_BASE_DELAY_MS || 500);
    let lastErr = null;
    let upstreamResponse = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const headers = {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          'X-Correlation-Id': requestId
        };

        // forward some client headers for context
        if (req.headers['user-agent']) headers['X-Forwarded-User-Agent'] = req.headers['user-agent'];

        const timeoutMs = Number(process.env.PROXY_UPSTREAM_TIMEOUT_MS || 120000);
        const resp = await axios.post(upstreamUrl, req.body || {}, {
          headers,
          validateStatus: () => true,
          timeout: timeoutMs
        });

        upstreamResponse = resp;

        // If upstream indicates Retry-After and status is 429/503, honor it
        if (resp.status === 429 || resp.status === 503) {
          const ra = resp.headers && (resp.headers['retry-after'] || resp.headers['Retry-After']);
          if (ra) {
            const waitMs = (parseInt(ra, 10) || 1) * 1000;
            console.warn(`[PROXY] upstream returned ${resp.status} with Retry-After=${ra}s. Waiting ${waitMs}ms before retry (attempt ${attempt}).`);
            await new Promise(r => setTimeout(r, waitMs));
            lastErr = new Error(`Upstream ${resp.status}`);
            continue;
          }
          // otherwise fall through to exponential backoff below
          lastErr = new Error(`Upstream ${resp.status}`);
        }

        // successful or non-retryable status — break and forward
        break;
      } catch (err) {
        // network/timeout error — treat as transient and retry
        lastErr = err;
        const backoff = Math.min(baseDelayMs * (2 ** (attempt - 1)), 30000);
        const jitter = Math.floor(Math.random() * 300);
        const sleepMs = backoff + jitter;
        console.warn(`[PROXY] upstream request error (attempt ${attempt}/${maxAttempts}): ${err && err.message}. Retrying in ${sleepMs}ms`);
        await new Promise(r => setTimeout(r, sleepMs));
        continue;
      }
    }

    if (!upstreamResponse && lastErr) {
      console.error('[PROXY] all upstream attempts failed', lastErr && lastErr.message ? lastErr.message : lastErr);
      return res.status(502).json({ error: 'Upstream unavailable after retries', details: String(lastErr && lastErr.message ? lastErr.message : lastErr) });
    }

    const upstream = upstreamResponse;

    // Forward rate-limit related headers so client can react (Retry-After, X-RateLimit-*)
    try {
      Object.keys(upstream.headers || {}).forEach((k) => {
        if (/^retry-after$/i.test(k) || /^x-ratelimit/i.test(k)) {
          res.setHeader(k, upstream.headers[k]);
        }
      });
    } catch (e) {
      console.warn('[PROXY] header copy failed', e && e.message ? e.message : e);
    }

    // Preserve status and body
    if (typeof upstream.data === 'string') {
      return res.status(upstream.status).send(upstream.data);
    }
    return res.status(upstream.status).json(upstream.data);
  } catch (err) {
    console.error('[PROXY] error forwarding request', err && err.message ? err.message : err);
    return res.status(502).json({ error: 'proxy_error' });
  }
});

module.exports = router;
