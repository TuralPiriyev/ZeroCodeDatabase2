const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

// Parse JSON bodies for this router
router.use(express.json({ limit: '5mb' }));

// Config from env
const MYSTER_KEY = (process.env.MYSTER_API_KEY || '').trim();
const MYSTER_OWNER = (process.env.MYSTER_OWNER || process.env.HF_OWNER || '').trim();
const MYSTER_MODEL = (process.env.MYSTER_MODEL || process.env.HF_MODEL || '').trim();
const PROXY_UPSTREAM = (process.env.MYSTER_API_BASE_URL || process.env.PROXY_UPSTREAM || 'https://api.myster.example').replace(/\/+$/, '');

// Health check
router.get('/health', (req, res) => {
  return res.json({ status: 'ok', proxy: true });
});

// Respond to preflight requests for this proxy (useful if frontend sends preflight)
router.options('/*', (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Correlation-Id');
  res.setHeader('Access-Control-Max-Age', '600');
  return res.sendStatus(204);
});

// Helper to generate or propagate request id
function ensureRequestId(req) {
  return req.headers['x-request-id'] || req.headers['x-correlation-id'] || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random()*100000)}`);
}

// Only handle POST for now (models inference typically uses POST)
router.post('/*', async (req, res) => {
  const start = Date.now();
  const requestId = ensureRequestId(req);

  try {
    // Determine suffix path and query relative to /api/proxy (router is mounted at /api/proxy)
    // req.baseUrl is '/api/proxy'
    const suffix = (req.originalUrl || req.url || '').replace(req.baseUrl || '', '') || '';
    // suffix looks like '/dbquery' or '/models/x/y?foo=1' etc.

    let upstreamUrl;
    if (suffix === '' || suffix === '/' || suffix === '/dbquery') {
      // Map /api/proxy/dbquery -> /models/{OWNER}/{MODEL} on Myster
      if (!MYSTER_OWNER || !MYSTER_MODEL) {
        const msg = 'MYSTER_OWNER or MYSTER_MODEL not configured in environment';
        console.error('[PROXY] config error:', msg);
        return res.status(500).json({ error: 'proxy_misconfigured', details: msg });
      }
      // Preserve any query string from originalUrl
      const queryIndex = (req.originalUrl || '').indexOf('?');
      const query = queryIndex >= 0 ? (req.originalUrl || '').slice(queryIndex) : '';
      upstreamUrl = `${PROXY_UPSTREAM}/models/${encodeURIComponent(MYSTER_OWNER)}/${encodeURIComponent(MYSTER_MODEL)}${query}`;
    } else {
      // For other paths, forward to PROXY_UPSTREAM + suffix
      // Ensure we do not duplicate slashes
      upstreamUrl = `${PROXY_UPSTREAM}${suffix}`;
    }

    // Build headers for upstream request
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'X-Request-Id': requestId,
      'X-Correlation-Id': requestId
    };

    // Forward user-agent as context
    if (req.headers['user-agent']) headers['X-Forwarded-User-Agent'] = req.headers['user-agent'];

    if (MYSTER_KEY) {
      headers['Authorization'] = `Bearer ${MYSTER_KEY}`;
    }

  // Add CORS headers to actual responses too (mirror origin or use configured FRONTEND_ORIGIN)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Correlation-Id');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');

  console.log(`[PROXY] incoming ${req.method} ${req.originalUrl} -> upstream ${upstreamUrl}`);

    const timeoutMs = Number(process.env.PROXY_UPSTREAM_TIMEOUT_MS || 120000);

    // Forward POST body to upstream
    const resp = await axios.post(upstreamUrl, req.body || {}, {
      headers,
      timeout: timeoutMs,
      validateStatus: () => true,
      responseType: 'arraybuffer'
    });

    const latency = Date.now() - start;

    // Build a short preview of the response body (first 200 chars)
    let bodyPreview = '';
    try {
      const ct = (resp.headers && resp.headers['content-type']) || '';
      if (ct.includes('application/json')) {
        const txt = Buffer.from(resp.data || '').toString('utf8');
        bodyPreview = txt.slice(0, 200);
      } else if (typeof resp.data === 'string') {
        bodyPreview = resp.data.slice(0, 200);
      } else if (Buffer.isBuffer(resp.data)) {
        bodyPreview = resp.data.toString('utf8', 0, 200);
      } else {
        bodyPreview = String(resp.data).slice(0, 200);
      }
    } catch (e) {
      bodyPreview = '[unreadable]';
    }

    console.log(`[PROXY] response ${requestId} ${resp.status} ${latency}ms preview="${bodyPreview.replace(/\n/g,' ')}"`);

    if (resp.status === 404) {
      console.warn(`[PROXY] upstream returned 404 for ${upstreamUrl} (requestId=${requestId})`);
    }

    // Copy upstream headers to response (excluding hop-by-hop headers)
    const hopByHop = new Set(['transfer-encoding','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','upgrade','content-length']);
    try {
      Object.keys(resp.headers || {}).forEach((k) => {
        const lk = k.toLowerCase();
        if (!hopByHop.has(lk)) {
          res.setHeader(k, resp.headers[k]);
        }
      });
    } catch (e) {
      console.warn('[PROXY] failed to copy headers', e && e.message ? e.message : e);
    }

    // Send status and body as-is
    res.status(resp.status);
    // If responseType was arraybuffer, resp.data is a Buffer
    if (Buffer.isBuffer(resp.data)) {
      return res.send(resp.data);
    }
    // Attempt to parse JSON if content-type says so
    const contentType = (resp.headers && resp.headers['content-type']) || '';
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(Buffer.from(resp.data || '').toString('utf8'));
        return res.json(parsed);
      } catch (e) {
        // fallback to raw text
        return res.send(Buffer.from(resp.data || '').toString('utf8'));
      }
    }

    // Default: send raw body
    return res.send(Buffer.from(resp.data || '').toString('utf8'));
  } catch (err) {
    const latency = Date.now() - start;
    console.error('[PROXY] error forwarding', err && err.message ? err.message : err, 'latency', latency);
    const status = (err && err.response && err.response.status) ? err.response.status : 502;
    const details = (err && err.code) ? err.code : (err && err.message) ? err.message : 'upstream_error';
    return res.status(status).json({ error: 'upstream unavailable', details });
  }
});

module.exports = router;
