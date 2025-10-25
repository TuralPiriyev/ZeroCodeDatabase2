import mysql from 'mysql2/promise';
import { DatabaseEntry } from '../../types';
import { generateUsername, generatePassword } from './helper';

// Notes: Creating users requires GLOBAL/CREATE USER privileges on the MySQL server.
// The admin URI must point to a user that can CREATE USER and GRANT privileges.

export async function provisionMySQLUser(dbEntry: DatabaseEntry, usernamePrefix: string, roles?: string[], ttlSeconds?: number) {
  const username = generateUsername(usernamePrefix || 'app');
  const password = generatePassword(24);

  // decrypt admin URI outside and pass as admin connection string
  const adminUri = dbEntry.admin_uri_encrypted || '';
  // expected form: mysql://user:pass@host:port
  if (!adminUri) throw new Error('No admin URI configured for MySQL database entry');

  const conn = await mysql.createConnection(adminUri);
  try {
    // MySQL identifiers cannot be parameterized; ensure username is safe (generated above)
    // Create user and grant privileges; default DB name is dbEntry.name
    const dbName = dbEntry.name;
    const createSql = `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`;
    // Note: mysql2 parameterization only binds values, but identifiers (user@host) are values so ok.
    await conn.query(createSql, [username, password]);
    const grantSql = `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO ?@'%'`;
    await conn.query(grantSql, [username]);
    await conn.query('FLUSH PRIVILEGES');
  } finally {
    await conn.end();
  }

  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  const connectionString = `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${dbEntry.host}:${dbEntry.port || 3306}/${encodeURIComponent(dbEntry.name)}`;
  return { username, password, expiresAt, connectionString };
}

export async function revokeMySQLUser(dbEntry: DatabaseEntry, username: string) {
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for MySQL database entry');
  const conn = await mysql.createConnection(adminUri);
  try {
    // DROP USER requires proper privileges
    const dropSql = `DROP USER IF EXISTS ?@'%'`;
    await conn.query(dropSql, [username]);
    await conn.query('FLUSH PRIVILEGES');
    return true;
  } finally {
    await conn.end();
  }
}

export async function rotateMySQLUserPassword(dbEntry: DatabaseEntry, username: string, newPassword: string) {
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for MySQL database entry');
  const conn = await mysql.createConnection(adminUri);
  try {
    // ALTER USER ... IDENTIFIED BY ? is available on newer MySQL; fallback to SET PASSWORD may be necessary.
    const alterSql = `ALTER USER ?@'%' IDENTIFIED BY ?`;
    await conn.query(alterSql, [username, newPassword]);
    await conn.query('FLUSH PRIVILEGES');
    return true;
  } finally {
    await conn.end();
  }
}
