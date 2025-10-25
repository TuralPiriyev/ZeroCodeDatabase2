import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseEntry, ProvisionedUser } from '../types';
import { encrypt } from '../utils/crypto';

const DB_PATH = process.env.CPS_SQLITE_PATH || path.join(process.cwd(), 'cps_metadata.db');

const db = new Database(DB_PATH);

// initialize tables
db.prepare(
  `CREATE TABLE IF NOT EXISTS databases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    host TEXT,
    port INTEGER,
    admin_uri_encrypted TEXT,
    created_at TEXT
  )`
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS provisioned_users (
    id TEXT PRIMARY KEY,
    db_id TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    roles TEXT,
    created_at TEXT,
    expires_at TEXT
  )`
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    db_id TEXT,
    username TEXT,
    actor TEXT,
    ip TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`
).run();

// Admin users table for CPS admin authentication
db.prepare(
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`
).run();

export function addDatabase(entry: Omit<DatabaseEntry, 'id' | 'created_at'>) {
  const id = uuidv4();
  const created_at = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO databases (id,name,type,host,port,admin_uri_encrypted,created_at) VALUES (?,?,?,?,?,?,?)`
  );
  stmt.run(id, entry.name, entry.type, entry.host, entry.port || null, entry.admin_uri_encrypted || null, created_at);
  return { id, created_at } as { id: string; created_at: string };
}

export function listDatabases(): DatabaseEntry[] {
  const rows = db.prepare(`SELECT * FROM databases ORDER BY created_at DESC`).all();
  return rows as DatabaseEntry[];
}

export function getDatabase(id: string): DatabaseEntry | null {
  const row = db.prepare(`SELECT * FROM databases WHERE id = ?`).get(id);
  return row || null;
}

export async function addProvisionedUser(db_id: string, username: string, plaintextPassword: string, roles?: string, expires_at?: string | null) {
  const id = uuidv4();
  const created_at = new Date().toISOString();
  const encrypted_password = await encrypt(plaintextPassword);
  db.prepare(
    `INSERT INTO provisioned_users (id,db_id,username,encrypted_password,roles,created_at,expires_at) VALUES (?,?,?,?,?,?,?)`
  ).run(id, db_id, username, encrypted_password, roles || null, created_at, expires_at || null);
  return { id, db_id, username, created_at, expires_at } as ProvisionedUser;
}

export function getProvisionedUser(id: string) {
  return db.prepare(`SELECT * FROM provisioned_users WHERE id = ?`).get(id);
}

export function getProvisionedUserByUsername(username: string) {
  return db.prepare(`SELECT * FROM provisioned_users WHERE username = ?`).get(username);
}

export function addAdmin(username: string, passwordHash: string, role = 'admin') {
  const id = uuidv4();
  const created_at = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO admins (id,username,password_hash,role,created_at) VALUES (?,?,?,?,?)`);
  stmt.run(id, username, passwordHash, role, created_at);
  return { id, username, role, created_at };
}

export function findAdminByUsername(username: string) {
  return db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
}

export function listProvisionedUsersForDb(db_id: string) {
  return db.prepare(`SELECT * FROM provisioned_users WHERE db_id = ? ORDER BY created_at DESC`).all(db_id);
}

export function revokeProvisionedUser(username: string) {
  // soft delete: remove record
  const stmt = db.prepare(`DELETE FROM provisioned_users WHERE username = ?`);
  const info = stmt.run(username);
  return info.changes > 0;
}

export async function rotateProvisionedUserPassword(username: string, newPlaintext: string) {
  const encrypted = await encrypt(newPlaintext);
  const stmt = db.prepare(`UPDATE provisioned_users SET encrypted_password = ? WHERE username = ?`);
  const info = stmt.run(encrypted, username);
  return info.changes > 0;
}

// synchronous helper to update encrypted password inside a transaction when we already have the ciphertext
export function updateEncryptedPassword(username: string, encryptedPassword: string) {
  const stmt = db.prepare(`UPDATE provisioned_users SET encrypted_password = ? WHERE username = ?`);
  const info = stmt.run(encryptedPassword, username);
  return info.changes > 0;
}

export function writeAudit(action: string, db_id: string | null, username: string | null, actor: string | null, ip: string | null, details: any) {
  const id = uuidv4();
  const created_at = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO audit (id,action,db_id,username,actor,ip,details,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  stmt.run(id, action, db_id, username, actor, ip, JSON.stringify(details || {}), created_at);
  return { id, created_at };
}

export function listAudit(db_id?: string, limit = 100) {
  if (db_id) return db.prepare(`SELECT * FROM audit WHERE db_id = ? ORDER BY created_at DESC LIMIT ?`).all(db_id, limit);
  return db.prepare(`SELECT * FROM audit ORDER BY created_at DESC LIMIT ?`).all(limit);
}

export function transaction(fn: (...args: any[]) => any) {
  const t = db.transaction(fn);
  return t();
}
