const rateLimit = require('express-rate-limit');

// Global rate limiter for all routes
const globalLimiter = rateLimit({
    const rateLimit = require('express-rate-limit');

    // Global rate limiter for API routes
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    });

    // Strict limiter for auth endpoints (register/login)
    const authLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // limit each IP to 5 requests per hour
      message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' }},
      standardHeaders: true,
      legacyHeaders: false
    });

    // OTP verification limiter
    const otpLimiter = rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 5, // limit attempts to 5 per 10 minutes
      message: { error: { code: 'OTP_ATTEMPTS_EXCEEDED', message: 'Too many verification attempts. Please request a new code.' }},
      standardHeaders: true,
      legacyHeaders: false
    });

    const rateLimit = require('express-rate-limit');

    // Global rate limiter for API routes
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    });

    // Strict limiter for auth endpoints (register/login)
    const authLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // limit each IP to 5 requests per hour
      message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' }},
      standardHeaders: true,
      legacyHeaders: false
    });

    // OTP verification limiter
    const otpLimiter = rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 5, // limit attempts to 5 per 10 minutes
      message: { error: { code: 'OTP_ATTEMPTS_EXCEEDED', message: 'Too many verification attempts. Please request a new code.' }},
      standardHeaders: true,
      legacyHeaders: false
    });

    // Resend OTP limiter
    const resendLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // limit resends to 3 per hour
      message: { error: { code: 'RESEND_LIMIT_EXCEEDED', message: 'Maximum resend attempts reached. Please try again later.' }},
      standardHeaders: true,
      legacyHeaders: false
    });

    module.exports = {
      globalLimiter,
      authLimiter,
      otpLimiter,
      resendLimiter
    };