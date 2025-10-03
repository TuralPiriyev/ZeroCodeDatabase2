const axios = require('axios');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'live';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID_LIVE || '';

const PAYPAL_API_BASE = PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

async function getAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID_LIVE;
  const secret = process.env.PAYPAL_SECRET_LIVE;
  if (!client || !secret) throw new Error('PayPal credentials not configured');
  const tokenUrl = `${PAYPAL_API_BASE}/v1/oauth2/token`;
  const auth = Buffer.from(`${client}:${secret}`).toString('base64');
  const resp = await axios({
    url: tokenUrl,
    method: 'post',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'grant_type=client_credentials'
  });
  return resp.data.access_token;
}

async function verifyWebhookSignature(headers, body) {
  const accessToken = await getAccessToken();
  const url = `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`;
  const payload = {
    auth_algo: headers['paypal-auth-algo'] || headers['Paypal-Auth-Algo'],
    cert_url: headers['paypal-cert-url'] || headers['Paypal-Cert-Url'],
    transmission_id: headers['paypal-transmission-id'] || headers['Paypal-Transmission-Id'],
    transmission_sig: headers['paypal-transmission-sig'] || headers['Paypal-Transmission-Sig'],
    transmission_time: headers['paypal-transmission-time'] || headers['Paypal-Transmission-Time'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID_LIVE || WEBHOOK_ID,
    webhook_event: body
  };
  const resp = await axios.post(url, payload, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
  return resp.data && resp.data.verification_status === 'SUCCESS';
}

async function getSubscriptionDetails(subscriptionID) {
  const accessToken = await getAccessToken();
  const resp = await axios.get(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionID}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.data;
}

async function verifySubscriptionHandler(subscriptionID, userId) {
  const data = await getSubscriptionDetails(subscriptionID);
  const status = data.status; // ACTIVE, APPROVAL_PENDING, SUSPENDED, CANCELLED, EXPIRED etc
  const planId = data.plan_id || (data.plan && data.plan.id) || (data.subscription_details && data.subscription_details.plan_id) || null;

  const startsAt = data.start_time ? new Date(data.start_time) : new Date();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (['ACTIVE', 'APPROVAL_PENDING'].includes(status)) {
    // create subscription record
    const sub = new Subscription({
      user_id: userId,
      paypal_subscription_id: subscriptionID,
      plan_id: planId,
      status,
      starts_at: startsAt,
      expires_at: expiresAt,
      last_payment_status: 'COMPLETED',
      last_payment_at: new Date()
    });
    await sub.save();

    // update user
    const user = await User.findById(userId);
    if (user) {
      user.subscription_status = planId === process.env.PRO_PLAN_ID ? 'Pro' : (planId === process.env.ULTIMATE_PLAN_ID ? 'Ultimate' : 'Pro');
      user.updated_at = new Date();
      await user.save();
    }

    return { success: true, id: sub._id };
  } else {
    // insert record with status
    const sub = new Subscription({
      user_id: userId,
      paypal_subscription_id: subscriptionID,
      plan_id: planId,
      status,
      starts_at: startsAt,
      expires_at: expiresAt
    });
    await sub.save();
    return { success: false, message: 'Subscription not active', status, id: sub._id };
  }
}

async function webhookHandler(headers, body) {
  // verify signature
  const ok = await verifyWebhookSignature(headers, body);
  if (!ok) {
    console.warn('Webhook verification failed');
    return false;
  }
  const eventType = body.event_type;
  const resource = body.resource || {};

  if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED' || eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED') {
    const subscriptionID = resource.subscription_id || resource.billing_agreement_id || (resource && resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.subscription_id);
    if (!subscriptionID) return false;
    const now = new Date();
    const sub = await Subscription.findOne({ paypal_subscription_id: subscriptionID });
    if (sub) {
      sub.last_payment_status = 'COMPLETED';
      sub.last_payment_at = now;
      sub.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      sub.updated_at = now;
      await sub.save();
      // update user
      await User.findByIdAndUpdate(sub.user_id, { subscription_status: 'Pro', updated_at: now });
      return true;
    }
  }

  if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
    const subscriptionID = resource.id || resource.subscription_id || resource.billing_agreement_id || (resource && resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.subscription_id);
    if (!subscriptionID) return false;
    const sub = await Subscription.findOne({ paypal_subscription_id: subscriptionID });
    const now = new Date();
    if (sub) {
      sub.status = eventType;
      sub.updated_at = now;
      await sub.save();
      await User.findByIdAndUpdate(sub.user_id, { subscription_status: 'Free', updated_at: now });
      return true;
    }
  }

  // Ignore other events by default
  return true;
}

module.exports = { getAccessToken, verifyWebhookSignature, getSubscriptionDetails, verifySubscriptionHandler, webhookHandler };
