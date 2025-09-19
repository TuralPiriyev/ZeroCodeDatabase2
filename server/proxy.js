const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

// Ensure JSON body parsing available for this router
router.use(express.json({ limit: '2mb' }));

router.post('/dbquery', async (req, res) => {
  try {
    const upstreamUrl = 'https://zerocodedb.online/api/ai/dbquery';
    const apiKey = process.env.ZEROCODEDB_API_KEY || '';

    const upstream = await axios.post(upstreamUrl, req.body || {}, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      // Accept all statuses so we can proxy them through
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
