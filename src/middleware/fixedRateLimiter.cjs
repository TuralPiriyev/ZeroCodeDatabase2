// fixedRateLimiter.cjs - clean rate limiter exports
const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' }},
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: { code: 'OTP_ATTEMPTS_EXCEEDED', message: 'Too many verification attempts. Please request a new code.' }},
  standardHeaders: true,
  legacyHeaders: false
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: { code: 'RESEND_LIMIT_EXCEEDED', message: 'Maximum resend attempts reached. Please try again later.' }},
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { globalLimiter, authLimiter, otpLimiter, resendLimiter };
