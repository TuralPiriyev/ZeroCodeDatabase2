// src/middleware/auth.cjs
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'defaultSecret';

function authenticate(req, res, next) {
  // 1) Header-dən oxu
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  // 2) Əgər header-də yoxdursa, cookie-dən yoxla
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: token missing' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.user   = { id: payload.userId, email: payload.email };
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}

module.exports = { authenticate };
