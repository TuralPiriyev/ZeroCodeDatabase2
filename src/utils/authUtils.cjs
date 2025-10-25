const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const randomBytes = promisify(crypto.randomBytes);

const generateOTP = () => {
    // Generate a cryptographically secure 6-digit OTP
    return String(Math.floor(100000 + crypto.randomInt(0, 900000))).padStart(6, '0');
};

const hashOTP = (otp, secret) => {
    if (!secret) {
        throw new Error('hashOTP: secret is required and must be a non-empty string');
    }
    return crypto.createHmac('sha256', String(secret))
        .update(String(otp))
        .digest('hex');
};

const verifyOTP = (providedOtp, storedHash, secret) => {
    if (!secret) throw new Error('verifyOTP: secret is required');
    if (!storedHash) return false;
    const providedHash = hashOTP(providedOtp, secret);
    // Use constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );
    } catch (e) {
        // If buffers differ in length or format, fail safely
        return false;
    }
};

const generateTempToken = (userId, secret, expiresIn = '15m') => {
    return jwt.sign({ userId, type: 'temp' }, secret, { expiresIn });
};

const generateAuthToken = (userId, username, email, secret, expiresIn = '7d') => {
    return jwt.sign({ userId, username, email }, secret, { expiresIn });
};

const verifyTempToken = (token, secret) => {
    try {
        const decoded = jwt.verify(token, secret);
        if (decoded.type !== 'temp') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    generateOTP,
    hashOTP,
    verifyOTP,
    generateTempToken,
    generateAuthToken,
    verifyTempToken
};