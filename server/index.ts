import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET;
const PAYPAL_ENV = process.env.REACT_APP_PAYPAL_ENV || process.env.NODE_ENV || 'sandbox';
const PAYPAL_API = process.env.PAYPAL_API_BASE || (PAYPAL_ENV === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error('PayPal server credentials not configured');
  const tokenUrl = `${PAYPAL_API}/v1/oauth2/token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

// Fallback: create subscription server-side and redirect user to approve URL
app.get('/api/pay/fallback-subscription', async (req, res) => {
  try {
    const planId = String(req.query.plan_id || req.query.plan || '');
    if (!planId) return res.status(400).send('plan_id required');
    const token = await getAccessToken();
    const createUrl = `${PAYPAL_API}/v1/billing/subscriptions`;
    const body = {
      plan_id: planId,
      application_context: {
        return_url: `${req.protocol}://${req.get('host')}/api/pay/fallback-return`,
        cancel_url: `${req.protocol}://${req.get('host')}/`,
        shipping_preference: 'NO_SHIPPING'
      }
    };
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await createRes.json();
    if (!createRes.ok) {
      console.error('Create subscription failed', json);
      return res.status(500).json({ error: 'Failed to create PayPal subscription', details: json });
    }
    const approve = (json.links || []).find((l: any) => l.rel === 'approve');
    if (!approve) return res.status(500).json({ error: 'No approve link returned', details: json });
    return res.redirect(approve.href);
  } catch (err: any) {
    console.error('fallback-subscription error', err && err.message ? err.message : err);
    return res.status(500).json({ error: String(err) });
  }
});

// Endpoint for client onApprove to notify server
app.post('/api/subscription/complete', async (req, res) => {
  try {
    const { subscriptionID } = req.body || {};
    if (!subscriptionID) return res.status(400).json({ message: 'subscriptionID required' });
    // Here you would validate with PayPal and save subscription to DB. For now, we'll fetch details and log.
    const token = await getAccessToken();
    const subRes = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionID}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const subJson = await subRes.json();
    console.log('Subscription confirmed on server:', subJson);
    // TODO: save to DB, attach to user
    res.json({ success: true, subscription: subJson });
  } catch (err: any) {
    console.error('subscription/complete error', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to confirm subscription', error: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`PayPal fallback server listening on ${PORT} (API: ${PAYPAL_API})`));
