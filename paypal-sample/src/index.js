require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const paypalRoutes = require('./routes/paypal');
const { scheduleExpireJob } = require('./jobs/expireSubscriptions');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const app = express();

// Basic middleware
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Static minimal frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// PayPal routes
app.use('/', paypalRoutes);

// Runtime config for frontend
app.get('/runtime-config', (req, res) => {
  res.json({
    PAYPAL_CLIENT_ID_LIVE: process.env.PAYPAL_CLIENT_ID_LIVE || '',
    PRO_PLAN_ID: process.env.PRO_PLAN_ID || '',
    ULTIMATE_PLAN_ID: process.env.ULTIMATE_PLAN_ID || ''
  });
});

// Demo login - create/find a demo user and return a JWT for testing
app.post('/auth/demo-login', express.json(), async (req, res) => {
  try {
    const email = req.body.email || 'demo@example.com';
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: 'Demo User', subscription_status: 'Free' });
      await user.save();
    }
    const token = jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user._id, email: user.email, subscription_status: user.subscription_status } });
  } catch (e) {
    console.error('demo login err', e);
    return res.status(500).json({ message: 'error' });
  }
});

// Demo token (GET) - easier to call from static frontend without body parsing conflicts
app.get('/auth/demo-token', async (req, res) => {
  try {
    const email = 'demo@example.com';
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: 'Demo User', subscription_status: 'Free' });
      await user.save();
    }
    const token = jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user._id, email: user.email, subscription_status: user.subscription_status } });
  } catch (e) {
    console.error('demo token err', e);
    return res.status(500).json({ message: 'error' });
  }
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Start server and connect to MongoDB
const port = process.env.PORT || 3000; // default for local dev
const MONGO_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/paypal_sample';

mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

    // Schedule cron job (uses mongoose internally)
    scheduleExpireJob();
  })
  .catch(err => {
    console.error('Mongo connect err', err);
    process.exit(1);
  });

// Run migrations helper when asked
if (process.argv.includes('--migrate')) {
  require('./migrations/runMigrations') // runs and exits
}

module.exports = app;
