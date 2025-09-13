const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: { type: String, required: true, unique: true }, // PayPal subscription ID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['Pro','Ultimate'], required: true },
  planId: { type: String }, // PayPal plan id (P-...)
  status: { type: String },
  startTime: { type: Date },
  nextBillingTime: { type: Date, default: null },
  raw: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
