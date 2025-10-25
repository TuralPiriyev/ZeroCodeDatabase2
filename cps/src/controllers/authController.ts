import { Request, Response } from 'express';
import * as storage from '../services/storage';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.MASTER_ENCRYPTION_KEY || 'dev_secret_change';
const JWT_EXPIRES = '4h';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const admin = storage.findAdminByUsername(username);
  if (!admin) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const csrf = uuidv4();
  const token = jwt.sign({ sub: admin.username, role: admin.role, csrf }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  // set HTTP-only cookie
  res.cookie('cps_token', token, { httpOnly: true, secure: false /* set true in prod with TLS */, sameSite: 'lax' });
  // return csrf token to UI (client should set header X-CSRF-Token)
  res.json({ csrf });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie('cps_token');
  res.json({ ok: true });
}
