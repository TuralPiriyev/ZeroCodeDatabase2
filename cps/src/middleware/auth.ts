import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.MASTER_ENCRYPTION_KEY || 'dev_secret_change';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // allow API key as fallback for automation
  const apiKey = process.env.ADMIN_API_KEY;
  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (apiKey && provided === apiKey) {
    // attach a lightweight system user
    (req as any).user = { username: 'automation', role: 'admin', csrf: apiKey };
    return next();
  }

  const token = req.cookies?.cps_token || req.headers['authorization']?.toString().replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    (req as any).user = { username: payload.sub, role: payload.role, csrf: payload.csrf };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}
