const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.sub) return res.status(401).json({ message: 'Invalid token' });
    const user = await User.findById(payload.sub).exec();
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (e) {
    console.error('auth error', e && e.message ? e.message : e);
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = { authenticate };
