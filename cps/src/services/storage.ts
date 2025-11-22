import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseEntry, ProvisionedUser } from '../types';
import { encrypt } from '../utils/crypto';

// Try to load better-sqlite3 dynamically. If it's unavailable (e.g., Windows dev
// without build tools), fall back to an in-memory adapter so tests and development
// can run without native builds.
let SqliteDB: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SqliteDB = require('better-sqlite3');
} catch (e) {
  SqliteDB = null;
}

const DB_PATH = process.env.CPS_SQLITE_PATH || path.join(process.cwd(), 'cps_metadata.db');

type Adapter = Record<string, any>;

let adapter: Adapter;

if (SqliteDB) {
  // SQLite-backed adapter (original behavior)
  const db = new SqliteDB(DB_PATH);

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
      revealed INTEGER DEFAULT 0,
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

  db.prepare(
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  ).run();

  adapter = {
    addDatabase(entry: Omit<DatabaseEntry, 'id' | 'created_at'>) {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO databases (id,name,type,host,port,admin_uri_encrypted,created_at) VALUES (?,?,?,?,?,?,?)`
      );
      stmt.run(id, entry.name, entry.type, entry.host, entry.port || null, entry.admin_uri_encrypted || null, created_at);
      return { id, created_at } as { id: string; created_at: string };
    },
    listDatabases(): DatabaseEntry[] {
      const rows = db.prepare(`SELECT * FROM databases ORDER BY created_at DESC`).all();
      return rows as DatabaseEntry[];
    },
    getDatabase(id: string) {
      const row = db.prepare(`SELECT * FROM databases WHERE id = ?`).get(id);
      return row || null;
    },
    async addProvisionedUser(db_id: string, username: string, plaintextPassword: string, roles?: string, expires_at?: string | null, revealed = 0) {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const encrypted_password = await encrypt(plaintextPassword);
      db.prepare(
        `INSERT INTO provisioned_users (id,db_id,username,encrypted_password,revealed,roles,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)`
      ).run(id, db_id, username, encrypted_password, revealed, roles || null, created_at, expires_at || null);
      return { id, db_id, username, created_at, expires_at } as ProvisionedUser;
    },
    getProvisionedUser(id: string) {
      return db.prepare(`SELECT * FROM provisioned_users WHERE id = ?`).get(id);
    },
    getProvisionedUserByUsername(username: string) {
      return db.prepare(`SELECT * FROM provisioned_users WHERE username = ?`).get(username);
    },
    markProvisionedUserRevealed(username: string) {
      const stmt = db.prepare(`UPDATE provisioned_users SET revealed = 1 WHERE username = ?`);
      const info = stmt.run(username);
      return info.changes > 0;
    },
    addAdmin(username: string, passwordHash: string, role = 'admin') {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const stmt = db.prepare(`INSERT INTO admins (id,username,password_hash,role,created_at) VALUES (?,?,?,?,?)`);
      stmt.run(id, username, passwordHash, role, created_at);
      return { id, username, role, created_at };
    },
    findAdminByUsername(username: string) {
      return db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
    },
    listProvisionedUsersForDb(db_id: string) {
      return db.prepare(`SELECT * FROM provisioned_users WHERE db_id = ? ORDER BY created_at DESC`).all(db_id);
    },
    revokeProvisionedUser(username: string) {
      const stmt = db.prepare(`DELETE FROM provisioned_users WHERE username = ?`);
      const info = stmt.run(username);
      return info.changes > 0;
    },
    async rotateProvisionedUserPassword(username: string, newPlaintext: string) {
      const encrypted = await encrypt(newPlaintext);
      const stmt = db.prepare(`UPDATE provisioned_users SET encrypted_password = ? WHERE username = ?`);
      const info = stmt.run(encrypted, username);
      return info.changes > 0;
    },
    updateEncryptedPassword(username: string, encryptedPassword: string) {
      const stmt = db.prepare(`UPDATE provisioned_users SET encrypted_password = ? WHERE username = ?`);
      const info = stmt.run(encryptedPassword, username);
      return info.changes > 0;
    },
    writeAudit(action: string, db_id: string | null, username: string | null, actor: string | null, ip: string | null, details: any) {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const stmt = db.prepare(`INSERT INTO audit (id,action,db_id,username,actor,ip,details,created_at) VALUES (?,?,?,?,?,?,?,?)`);
      stmt.run(id, action, db_id, username, actor, ip, JSON.stringify(details || {}), created_at);
      return { id, created_at };
    },
    listAudit(db_id?: string, limit = 100) {
      if (db_id) return db.prepare(`SELECT * FROM audit WHERE db_id = ? ORDER BY created_at DESC LIMIT ?`).all(db_id, limit);
      return db.prepare(`SELECT * FROM audit ORDER BY created_at DESC LIMIT ?`).all(limit);
    },
    transaction(fn: (...args: any[]) => any) {
      const t = db.transaction(fn);
      return t();
    }
  };
} else {
  // In-memory adapter: simple JS objects/arrays. Not durable; intended for tests/dev only.
  const dbs: any[] = [];
  const provs: any[] = [];
  const audits: any[] = [];
  const admins: any[] = [];

  adapter = {
    addDatabase(entry: Omit<DatabaseEntry, 'id' | 'created_at'>) {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const row = { id, ...entry, created_at };
      dbs.unshift(row);
      return { id, created_at };
    },
    listDatabases() {
      return dbs.slice();
    },
    getDatabase(id: string) {
      return dbs.find(d => d.id === id) || null;
    },
    async addProvisionedUser(db_id: string, username: string, plaintextPassword: string, roles?: string, expires_at?: string | null, revealed = 0) {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const encrypted_password = await encrypt(plaintextPassword);
      const row = { id, db_id, username, encrypted_password, roles, created_at, expires_at };
      provs.unshift(row);
      return row as ProvisionedUser;
    },
    getProvisionedUser(id: string) {
      return provs.find(p => p.id === id) || null;
    },
    getProvisionedUserByUsername(username: string) {
      return provs.find(p => p.username === username) || null;
    },
    addAdmin(username: string, passwordHash: string, role = 'admin') {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const a = { id, username, password_hash: passwordHash, role, created_at };
      admins.push(a);
      return a;
    },
    findAdminByUsername(username: string) {
      return admins.find(a => a.username === username) || null;
    },
    listProvisionedUsersForDb(db_id: string) {
      return provs.filter(p => p.db_id === db_id).slice();
    },
    revokeProvisionedUser(username: string) {
      const idx = provs.findIndex(p => p.username === username);
      if (idx === -1) return false;
      provs.splice(idx, 1);
      return true;
    },
    markProvisionedUserRevealed(username: string) {
      const p = provs.find(p => p.username === username);
      if (!p) return false;
      p.revealed = 1;
      return true;
    },
    async rotateProvisionedUserPassword(username: string, newPlaintext: string) {
      const p = provs.find(p => p.username === username);
      if (!p) return false;
      p.encrypted_password = await encrypt(newPlaintext);
      return true;
    },
    updateEncryptedPassword(username: string, encryptedPassword: string) {
      const p = provs.find(p => p.username === username);
      if (!p) return false;
      p.encrypted_password = encryptedPassword;
      return true;
    },
    writeAudit(action: string, db_id: string | null, username: string | null, actor: string | null, ip: string | null, details: any) {
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const row = { id, action, db_id, username, actor, ip, details: JSON.stringify(details || {}), created_at };
      audits.unshift(row);
      return { id, created_at };
    },
    listAudit(db_id?: string, limit = 100) {
      const list = db_id ? audits.filter(a => a.db_id === db_id) : audits;
      return list.slice(0, limit);
    },
    transaction(fn: (...args: any[]) => any) {
      // No real transaction support in-memory; just call the function.
      return fn();
    }
  };
}

// Export adapter functions with the same surface as before
export const addDatabase = (entry: Omit<DatabaseEntry, 'id' | 'created_at'>) => adapter.addDatabase(entry);
export const listDatabases = (): DatabaseEntry[] => adapter.listDatabases();
export const getDatabase = (id: string) => adapter.getDatabase(id);
export const addProvisionedUser = (db_id: string, username: string, plaintextPassword: string, roles?: string, expires_at?: string | null, revealed = 0) => adapter.addProvisionedUser(db_id, username, plaintextPassword, roles, expires_at, revealed);
export const getProvisionedUser = (id: string) => adapter.getProvisionedUser(id);
export const getProvisionedUserByUsername = (username: string) => adapter.getProvisionedUserByUsername(username);
export const addAdmin = (username: string, passwordHash: string, role = 'admin') => adapter.addAdmin(username, passwordHash, role);
export const findAdminByUsername = (username: string) => adapter.findAdminByUsername(username);
export const listProvisionedUsersForDb = (db_id: string) => adapter.listProvisionedUsersForDb(db_id);
export const revokeProvisionedUser = (username: string) => adapter.revokeProvisionedUser(username);
export const rotateProvisionedUserPassword = (username: string, newPlaintext: string) => adapter.rotateProvisionedUserPassword(username, newPlaintext);
export const updateEncryptedPassword = (username: string, encryptedPassword: string) => adapter.updateEncryptedPassword(username, encryptedPassword);
export const writeAudit = (action: string, db_id: string | null, username: string | null, actor: string | null, ip: string | null, details: any) => adapter.writeAudit(action, db_id, username, actor, ip, details);
export const listAudit = (db_id?: string, limit = 100) => adapter.listAudit(db_id, limit);
export const transaction = (fn: (...args: any[]) => any) => adapter.transaction(fn);
export const markProvisionedUserRevealed = (username: string) => adapter.markProvisionedUserRevealed ? adapter.markProvisionedUserRevealed(username) : false;
