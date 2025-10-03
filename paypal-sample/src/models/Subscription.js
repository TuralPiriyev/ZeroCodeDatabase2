const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paypal_subscription_id: { type: String, required: true, index: true },
  plan_id: { type: String },
  status: { type: String },
  starts_at: { type: Date },
  expires_at: { type: Date },
  last_payment_status: { type: String },
  last_payment_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
