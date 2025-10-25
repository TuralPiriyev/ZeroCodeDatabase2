import crypto from 'crypto';
import { getMasterKey } from './kms';

const ENC_ALGO = 'aes-256-gcm';

async function getKey(): Promise<Buffer> {
  const key = await getMasterKey();
  if (!key || key.length !== 32) throw new Error('MASTER_ENCRYPTION_KEY must be 32 bytes (base64 or hex decoded) or provided by KMS');
  return key;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as base64 iv:tag:cipher
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export async function decrypt(payload: string): Promise<string> {
  const key = await getKey();
  const [ivB, tagB, dataB] = payload.split(':');
  if (!ivB || !tagB || !dataB) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB, 'base64');
  const tag = Buffer.from(tagB, 'base64');
  const data = Buffer.from(dataB, 'base64');
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString('utf8');
}

