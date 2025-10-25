import crypto from 'crypto';

/**
 * Simple KMS abstraction.
 * - getMasterKey(): prefer real KMS (AWS KMS, Vault) integrations; fallback to env var.
 * - This file contains lightweight stubs and examples. For production, implement the provider integrations.
 */

export async function getMasterKey(): Promise<Buffer> {
  // try environment variable first
  const env = process.env.MASTER_ENCRYPTION_KEY;
  if (env && env.length > 0) {
    // try base64 then hex
    try {
      const buf = Buffer.from(env, 'base64');
      if (buf.length === 32) return buf;
    } catch (e) {
      // ignore
    }
    try {
      const buf = Buffer.from(env, 'hex');
      if (buf.length === 32) return buf;
    } catch (e) {
      // ignore
    }
    // If env var exists but doesn't decode to 32 bytes, throw
    throw new Error('MASTER_ENCRYPTION_KEY provided but does not decode to 32 bytes (base64 or hex).');
  }

  // Placeholder for KMS provider logic.
  // Example: integrate AWS SDK or Vault here to retrieve a 32-byte key.
  // For now, fail fast because we require a key.
  throw new Error('No MASTER_ENCRYPTION_KEY found in environment. Configure KMS provider or set MASTER_ENCRYPTION_KEY.');
}

export function generateLocalTestKey(): string {
  // returns base64 32 bytes for local/dev use
  return crypto.randomBytes(32).toString('base64');
}
