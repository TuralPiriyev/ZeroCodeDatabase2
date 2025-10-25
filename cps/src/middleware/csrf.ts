import { Request, Response, NextFunction } from 'express';

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  // only enforce for state-changing methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const header = req.headers['x-csrf-token'] as string | undefined;
  // derive csrf token attached to user by auth middleware
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const expected = user.csrf as string | undefined;
  if (!header || !expected || header !== expected) return res.status(403).json({ error: 'invalid csrf token' });
  return next();
}
