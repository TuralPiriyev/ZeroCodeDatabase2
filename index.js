// subscription-backend/index.js
// Express.js backend for subscription payment integration (e.g., Stripe)

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 4242;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Mock database for users/subscriptions
const users = new Map(); // key: userId, value: { plan: string }

// 1. Create Checkout Session
app.post('/api/subscription/create', async (req, res) => {
  const { userId, plan } = req.body;
  if (!userId || !plan) {
    return res.status(400).json({ error: 'Missing userId or plan' });
  }

  // Define price IDs in Stripe dashboard
  const PRICE_IDS = {
    free: null,
    pro: 'price_1Hh1XYZproMonthly',
    ultimate: 'price_1Hh1XYZultimateMonthly',
  };

  if (!PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      customer_email: req.body.email, // optional
      metadata: { userId, plan },
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,  
    });
    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

// 2. Stripe Webhook for subscription updates
typeof endpointSecret;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.sendStatus(400);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, plan } = session.metadata;
    // Update user subscription in database
    users.set(userId, { plan });
    console.log(`User ${userId} subscribed to ${plan}`);
  }

  // Handle customer.subscription.updated or deleted
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const { userId } = subscription.metadata;
    users.set(userId, { plan: 'free' });
    console.log(`User ${userId} downgraded to free`);
  }

  res.sendStatus(200);
});

// 3. Get User Subscription Status
app.get('/api/subscription/status/:userId', (req, res) => {
  const { userId } = req.params;
  const record = users.get(userId) || { plan: 'free' };
  res.json({ userId, plan: record.plan });
});

app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

/*
.env example:

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLIENT_URL=http://localhost:3000

*/
