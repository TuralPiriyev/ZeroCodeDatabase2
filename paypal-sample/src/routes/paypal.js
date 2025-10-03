const express = require('express');
const router = express.Router();
const { verifySubscriptionHandler, webhookHandler } = require('../services/paypalService');
const { authenticate } = require('../middleware/auth');

// Verify subscription endpoint called by frontend onApprove
router.post('/verify-subscription', authenticate, async (req, res) => {
  try {
    const { subscriptionID } = req.body || {};
    if (!subscriptionID) return res.status(400).json({ message: 'subscriptionID required' });
    const userId = req.user && req.user._id;
    const result = await verifySubscriptionHandler(subscriptionID, userId);
    return res.json(result);
  } catch (err) {
    console.error('verify-subscription error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Webhook endpoint
router.post(process.env.WEBHOOK_PATH || '/webhook/paypal', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const handled = await webhookHandler(req.headers, req.body);
    if (handled) return res.status(200).send('OK');
    return res.status(400).send('ignored');
  } catch (err) {
    console.error('webhook handler error', err && err.message ? err.message : err);
    return res.status(500).send('error');
  }
});

module.exports = router;
