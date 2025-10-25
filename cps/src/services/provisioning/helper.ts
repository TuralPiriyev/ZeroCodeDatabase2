import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export function generateUsername(prefix = 'u') {
  // keep safe characters
  const id = uuidv4().split('-')[0];
  return `${prefix}_${id}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function generatePassword(length = 24) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
