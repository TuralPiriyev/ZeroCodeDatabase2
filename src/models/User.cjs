// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName:        { type: String, required: true },
  username:        { type: String, required: true, unique: true },
  email:           { type: String, required: true, unique: true },
  phone:           { type: String, required: true, unique: true },
  password:        { type: String, required: true },
  subscriptionPlan:{ type: String, enum: ['Free','Pro','Ultimate'], default: 'Free' },
  expiresAt: { type: Date, default: null },
  isOnline:        { type: Boolean, default: false },
  lastSeen:        { type: Date, default: Date.now }
  ,
  // Email verification fields
  isVerified: { type: Boolean, default: false },
  otpHash: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  otpResendCount: { type: Number, default: 0 },
  lastResendAt: { type: Date, default: null },
  registrationToken: { type: String, default: null }

}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
