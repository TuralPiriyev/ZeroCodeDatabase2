import { MongoClient } from 'mongodb';
import { DatabaseEntry } from '../../types';
import { generateUsername, generatePassword } from './helper';

// Note: adminUri should point to an admin user able to run createUser on the target database

export async function provisionMongoUser(dbEntry: DatabaseEntry, usernamePrefix: string, roles?: any[], ttlSeconds?: number) {
  const username = generateUsername(usernamePrefix || 'app');
  const password = generatePassword(24);

  const adminUri = dbEntry.admin_uri_encrypted || '';
  if (!adminUri) throw new Error('No admin URI configured for MongoDB database entry');

  const client = new MongoClient(adminUri);
  try {
    await client.connect();
    const targetDb = client.db(dbEntry.name);
    const roleSpec = roles && roles.length ? roles : [{ role: 'readWrite', db: dbEntry.name }];
    // createUser command
    await targetDb.command({ createUser: username, pwd: password, roles: roleSpec });
  } finally {
    await client.close();
  }

  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;

  // Build connection string using adminUri as template so we keep SRV and TLS/query options.
  let connectionString = '';
  try {
    const u = new URL(adminUri);
    u.username = encodeURIComponent(username);
    u.password = encodeURIComponent(password);
    // If admin URI points to admin db, override with target db
    if (u.pathname === '/' || u.pathname === '/admin') {
      u.pathname = `/${encodeURIComponent(dbEntry.name)}`;
    }
    connectionString = u.toString();
  } catch (e) {
    // Fallback to basic form if parsing fails
    connectionString = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${dbEntry.host}:${dbEntry.port || 27017}/${encodeURIComponent(dbEntry.name)}`;
  }

  return { username, password, expiresAt, connectionString };
}

export async function revokeMongoUser(dbEntry: DatabaseEntry, username: string) {
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for MongoDB database entry');
  const client = new MongoClient(adminUri);
  try {
    await client.connect();
    const targetDb = client.db(dbEntry.name);
    // dropUser command
    await targetDb.command({ dropUser: username });
    return true;
  } finally {
    await client.close();
  }
}

export async function rotateMongoUserPassword(dbEntry: DatabaseEntry, username: string, newPassword: string) {
  const adminUri = (dbEntry as any).admin_uri_encrypted;
  if (!adminUri) throw new Error('No admin URI configured for MongoDB database entry');
  const client = new MongoClient(adminUri);
  try {
    await client.connect();
    const targetDb = client.db(dbEntry.name);
    // updateUser command to set new password
    await targetDb.command({ updateUser: username, pwd: newPassword });
    return true;
  } finally {
    await client.close();
  }
}
