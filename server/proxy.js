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
    const upstreamUrl = 'https://zerocodedb.online/api/ai/dbquery';
    const apiKey = (process.env.ZEROCODEDB_API_KEY || '').trim();

    // If no API key is configured, operate in mock mode and simulate upstream rate limits
    if (!apiKey) {
      // Use client IP or userId as key
      const key = (req.body && req.body.userId) ? `uid:${req.body.userId}` : `ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
      const bucket = getBucket(key);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        // Simulate some processing delay
        await new Promise(r => setTimeout(r, 120 + Math.floor(Math.random() * 200)));
        // Return a mock structured response similar to upstream
        res.setHeader('X-Mock-Mode', 'true');
        return res.json({ answer: { sql: '', params: {}, explanation: 'Mock AI response (no upstream API key configured).', language: req.body && req.body.language || 'en' } });
      }
      // Not enough tokens: compute retry-after seconds
      const missing = 1 - bucket.tokens;
      const retryAfterSec = Math.ceil(missing / TOKEN_REFILL_PER_SEC) || 1;
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: `Rate limit exceeded (mock). Try again in ${retryAfterSec} seconds.` });
    }

    // Real upstream proxying when API key is present
    const upstream = await axios.post(upstreamUrl, req.body || {}, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 30000
    });

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
