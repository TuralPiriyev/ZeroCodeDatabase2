const express = require('express');
const axios = require('axios');
const router = express.Router();
const crypto = require('crypto');

// Parse JSON bodies for this router
router.use(express.json({ limit: '2mb' }));

const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_KEY || '';
const PROXY_UPSTREAM = process.env.PROXY_UPSTREAM || 'https://api-inference.huggingface.co';
const PROXY_PREFIX = process.env.PROXY_PREFIX || '/api/proxy';

// Simple health check
router.get('/health', (req, res) => {
  return res.json({ status: 'ok', proxy: true });
});

// Generic proxy for POST endpoints under /api/proxy/*
router.post('/*', async (req, res) => {
  const start = Date.now();
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = incomingId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random()*100000)}`);

  try {
    // Determine target path: map /api/proxy/<path> -> PROXY_UPSTREAM/<path>
    const proxiedPath = req.path.replace(/^\//, ''); // remove leading slash
    const upstreamUrl = `${PROXY_UPSTREAM}/${proxiedPath}`;

    // Build headers
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'X-Request-Id': requestId,
      'X-Correlation-Id': requestId
    };

    if (HF_TOKEN) {
      headers['Authorization'] = `Bearer ${HF_TOKEN}`;
    }

    // Forward the request body
    const timeoutMs = Number(process.env.PROXY_UPSTREAM_TIMEOUT_MS || 120000);
    const resp = await axios.post(upstreamUrl, req.body || {}, {
      headers,
      timeout: timeoutMs,
      validateStatus: () => true
    });

    // Log
    const latency = Date.now() - start;
    console.log(`[PROXY] ${requestId} -> ${upstreamUrl} ${resp.status} (${latency}ms)`);

    // Forward important headers
    try {
      Object.keys(resp.headers || {}).forEach((k) => {
        if (/^retry-after$/i.test(k) || /^x-ratelimit/i.test(k) || /^x-request-id$/i.test(k)) {
          res.setHeader(k, resp.headers[k]);
        }
      });
    } catch (e) {}

    // Return response
    if (typeof resp.data === 'string') return res.status(resp.status).send(resp.data);
    return res.status(resp.status).json(resp.data);
  } catch (err) {
    const latency = Date.now() - start;
    console.error('[PROXY] error forwarding', err && err.message ? err.message : err, 'latency', latency);
    const status = (err && err.response && err.response.status) ? err.response.status : 502;
    const details = (err && err.code) ? err.code : (err && err.message) ? err.message : 'upstream_error';
    return res.status(status).json({ error: 'upstream unavailable', details });
  }
});

module.exports = router;


module.exports = router;
