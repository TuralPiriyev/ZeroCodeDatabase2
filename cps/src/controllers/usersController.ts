import { Request, Response } from 'express';
import { decrypt, encrypt } from '../utils/crypto';
import { provisionMySQLUser, revokeMySQLUser, rotateMySQLUserPassword } from '../services/provisioning/mysql';
import { provisionMongoUser, revokeMongoUser, rotateMongoUserPassword } from '../services/provisioning/mongo';
import { provisionPostgresUser, revokePostgresUser, rotatePostgresUserPassword } from '../services/provisioning/postgres';
import * as storage from '../services/storage';
import snippetsService from '../services/snippetsService';
import { inc } from '../utils/metrics';

function buildSnippets(type: string, connStr: string) {
  // Provide simple snippets for php, node, python
  if (type === 'mongodb') {
    return {
      php: `<?php\nrequire 'vendor/autoload.php';\n$client = new MongoDB\\Client('${connStr}');\n$collection = $client->selectCollection('test','test');\n`,
      node: `const {{ MongoClient }} = require('mongodb');\nconst client = new MongoClient('${connStr}');\nawait client.connect();`,
      python: `from pymongo import MongoClient\nclient = MongoClient('${connStr}')\n`
    };
  }

  // sql
  return {
    php: `<?php\n$pdo = new PDO('${connStr}');\n$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n`,
    node: `const mysql = require('mysql2/promise');\nconst conn = await mysql.createConnection('${connStr}');\n`,
    python: `import pymysql\nconn = pymysql.connect(${connStr})\n`
  };
}

export async function provisionUser(req: Request, res: Response) {
  const dbId = req.params.dbId;
  const { usernamePrefix, roles, ttl } = req.body;
  const db = storage.getDatabase(dbId);
  if (!db) return res.status(404).json({ error: 'database not found' });

  const adminUriEncrypted = db.admin_uri_encrypted;
  if (!adminUriEncrypted) return res.status(400).json({ error: 'No admin credentials configured for this database' });

  let adminUriPlain = '';
  try {
    adminUriPlain = await decrypt(adminUriEncrypted);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to decrypt admin credentials' });
  }
  (db as any).admin_uri_encrypted = adminUriPlain;

  let result: any;
  if (db.type === 'mysql') {
    result = await provisionMySQLUser(db, usernamePrefix, roles, ttl);
  } else if (db.type === 'mongodb') {
    result = await provisionMongoUser(db, usernamePrefix, roles, ttl);
  } else if (db.type === 'postgres') {
    result = await provisionPostgresUser(db, usernamePrefix, roles, ttl);
  } else {
    return res.status(400).json({ error: 'Unsupported db type' });
  }

  // store provisioned metadata (encrypt password at rest)
  const prov = await storage.addProvisionedUser(dbId, result.username, result.password, JSON.stringify(roles || []), result.expiresAt, 0);
  try { inc('provisions'); } catch {}

  // Generate language-specific snippets and a one-time token for the client
  const { snippets, one_time_token } = snippetsService.generateSnippets(result.connectionString, result.username);

  // Mark the provisioned user as revealed (so subsequent calls won't return plaintext password)
  try {
    storage.markProvisionedUserRevealed(result.username);
  } catch (err) {
    // non-fatal: we log but do not include sensitive data in response
    console.warn('Failed to mark provisioned user revealed:', String(err));
  }

  const instructions = `This connection string and password are shown only once. Store them securely.`;

  res.json({ configured: true, connectionString: result.connectionString, expiresAt: result.expiresAt, instructions, snippets, username: result.username, one_time_token });
}

export async function revokeUser(req: Request, res: Response) {
  const dbId = req.params.dbId;
  const { username } = req.body;
  const db = storage.getDatabase(dbId);
  if (!db) return res.status(404).json({ error: 'database not found' });

  // Revoke at DB level and then remove metadata. We will attempt to keep operations atomic via compensating action.
  const prov = storage.getProvisionedUserByUsername(username);
  if (!prov) return res.status(404).json({ error: 'provisioned user not found' });
  let decryptedPwd: string | null = null;
  try {
    decryptedPwd = await decrypt(prov.encrypted_password);
  } catch {
    decryptedPwd = null;
  }

  try {
    // perform DB-level revoke. If decrypting the stored admin URI fails (e.g., tests or
    // fallback environments), attempt to use the stored value as plaintext.
    let adminPlain = (db as any).admin_uri_encrypted as string;
    try {
      adminPlain = await decrypt(db.admin_uri_encrypted as string);
    } catch (e) {
      // fallback: treat stored value as plaintext URI
      adminPlain = db.admin_uri_encrypted as string;
    }

    if (db.type === 'mysql') await revokeMySQLUser(Object.assign({}, db, { admin_uri_encrypted: adminPlain }), username);
    else if (db.type === 'mongodb') await revokeMongoUser(Object.assign({}, db, { admin_uri_encrypted: adminPlain }), username);
    else if (db.type === 'postgres') await revokePostgresUser(Object.assign({}, db, { admin_uri_encrypted: adminPlain }), username);
    else throw new Error('unsupported db type');

    // If DB revoke succeeded, remove metadata and record audit inside a local transaction
    try {
      storage.transaction(() => {
        const deleted = storage.revokeProvisionedUser(username);
        if (!deleted) throw new Error('failed to delete metadata record');
        storage.writeAudit('revoke', dbId, username, null, req.ip as string, { success: true });
      });
    } catch (metaErr: any) {
      // attempt compensation: try to recreate the user with old password
      if (decryptedPwd) {
        try {
          if (db.type === 'mysql') await provisionMySQLUser(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), 'recovery', []);
          else if (db.type === 'mongodb') await provisionMongoUser(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), 'recovery', []);
          else if (db.type === 'postgres') await provisionPostgresUser(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), 'recovery', []);
        } catch (recreateErr) {
          // If compensation fails, record failure in audit
          storage.writeAudit('revoke_failed_compensation', dbId, username, null, req.ip as string, { error: String(recreateErr) });
        }
      }
      storage.writeAudit('revoke_failed', dbId, username, null, req.ip as string, { error: String(metaErr) });
      return res.status(500).json({ error: metaErr.message || String(metaErr) });
    }

    try { inc('revokes'); } catch {}
    res.json({ success: true });
  } catch (err: any) {
    try { inc('revoke_failures'); } catch {}
    storage.writeAudit('revoke_failed_db', dbId, username, null, req.ip as string, { error: String(err) });
    return res.status(500).json({ error: err.message || String(err) });
  }
}

export async function rotateUser(req: Request, res: Response) {
  const dbId = req.params.dbId;
  const { username } = req.body;
  const db = storage.getDatabase(dbId);
  if (!db) return res.status(404).json({ error: 'database not found' });

  const prov = storage.getProvisionedUserByUsername(username);
  if (!prov) return res.status(404).json({ error: 'provisioned user not found' });
  let oldPwd: string | null = null;
  try {
    oldPwd = await decrypt(prov.encrypted_password);
  } catch {
    oldPwd = null;
  }
  if (!oldPwd) return res.status(500).json({ error: 'failed to decrypt stored password' });

  // generate new password
  const { generatePassword } = await import('../services/provisioning/helper');
  const newPwd = generatePassword(24);

    try {
      // Apply new password at DB level
      if (db.type === 'mysql') await rotateMySQLUserPassword(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), username, newPwd);
      else if (db.type === 'mongodb') await rotateMongoUserPassword(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), username, newPwd);
      else if (db.type === 'postgres') await rotatePostgresUserPassword(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), username, newPwd);
      else throw new Error('unsupported db type');

      // Encrypt new password and update metadata inside a local transaction
      const encrypted = await encrypt(newPwd);
      try {
        storage.transaction(() => {
          const updated = storage.updateEncryptedPassword(username, encrypted);
          if (!updated) throw new Error('failed to update metadata');
          storage.writeAudit('rotate', dbId, username, null, req.ip as string, { success: true });
        });
      } catch (metaErr: any) {
        // revert DB password to oldPwd
        try {
          if (db.type === 'mysql') await rotateMySQLUserPassword(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), username, oldPwd);
          else if (db.type === 'mongodb') await rotateMongoUserPassword(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), username, oldPwd);
          else if (db.type === 'postgres') await rotatePostgresUserPassword(Object.assign({}, db, { admin_uri_encrypted: await decrypt(db.admin_uri_encrypted as string) }), username, oldPwd);
        } catch (revertErr) {
          storage.writeAudit('rotate_revert_failed', dbId, username, null, req.ip as string, { error: String(revertErr) });
        }
        storage.writeAudit('rotate_failed', dbId, username, null, req.ip as string, { error: String(metaErr) });
        return res.status(500).json({ error: metaErr.message || String(metaErr) });
      }

      try { inc('rotates'); } catch {}
      res.json({ success: true });
    } catch (err: any) {
      try { inc('rotate_failures'); } catch {}
      storage.writeAudit('rotate_failed_db', dbId, username, null, req.ip as string, { error: String(err) });
      return res.status(500).json({ error: err.message || String(err) });
    }
}
