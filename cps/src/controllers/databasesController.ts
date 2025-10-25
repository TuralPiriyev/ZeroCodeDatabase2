import { Request, Response } from 'express';
import * as storage from '../services/storage';
import { encrypt } from '../utils/crypto';

export async function createDatabase(req: Request, res: Response) {
  const { name, type, host, port, adminUri } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

  let encrypted = null;
  if (adminUri) {
    try {
      encrypted = await encrypt(adminUri);
    } catch (e: any) {
      return res.status(500).json({ error: 'failed to encrypt adminUri' });
    }
  }

  const { id, created_at } = storage.addDatabase({ name, type, host, port, admin_uri_encrypted: encrypted || undefined });
  res.json({ id, created_at });
}

export async function listDatabases(req: Request, res: Response) {
  const rows = storage.listDatabases();
  // Do not return admin URI
  const safe = rows.map((r) => ({ ...r, admin_uri_encrypted: undefined }));
  res.json(safe);
}
