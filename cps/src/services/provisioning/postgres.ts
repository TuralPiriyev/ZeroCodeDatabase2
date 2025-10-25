import { Pool } from 'pg';
import { DatabaseEntry } from '../../types';
import { generateUsername, generatePassword } from './helper';

// Note: adminUri should be a Postgres connection string for a role with CREATEROLE and sufficient privileges.

export async function provisionPostgresUser(dbEntry: DatabaseEntry, usernamePrefix: string, roles?: string[], ttlSeconds?: number) {
  const username = generateUsername(usernamePrefix || 'app');
  const password = generatePassword(24);
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for Postgres database entry');

  const pool = new Pool({ connectionString: adminUri });
  try {
    // Create role with login and password
    await pool.query(`CREATE ROLE "${username}" WITH LOGIN PASSWORD $1`, [password]);
    // Grant CONNECT on database
    await pool.query(`GRANT CONNECT ON DATABASE "${dbEntry.name}" TO "${username}"`);
    // Grant default table privileges in public schema (future tables)
    await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${username}"`);
  } finally {
    await pool.end();
  }

  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  const connectionString = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${dbEntry.host}:${dbEntry.port || 5432}/${encodeURIComponent(dbEntry.name)}`;
  return { username, password, expiresAt, connectionString };
}

export async function revokePostgresUser(dbEntry: DatabaseEntry, username: string) {
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for Postgres database entry');
  const pool = new Pool({ connectionString: adminUri });
  try {
    await pool.query(`DROP ROLE IF EXISTS "${username}"`);
    return true;
  } finally {
    await pool.end();
  }
}

export async function rotatePostgresUserPassword(dbEntry: DatabaseEntry, username: string, newPassword: string) {
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for Postgres database entry');
  const pool = new Pool({ connectionString: adminUri });
  try {
    await pool.query(`ALTER ROLE "${username}" WITH PASSWORD $1`, [newPassword]);
    return true;
  } finally {
    await pool.end();
  }
}
