const path = require('path');

const cpsDistRoot = path.resolve(__dirname, '..', 'cps', 'dist', 'src');

function loadDist(subPath) {
  return require(path.join(cpsDistRoot, subPath));
}

const storage = loadDist('services/storage.js');
const { decrypt } = loadDist('utils/crypto.js');
const snippetsModule = loadDist('services/snippetsService.js');
const { provisionMySQLUser } = loadDist('services/provisioning/mysql.js');
const { provisionMongoUser } = loadDist('services/provisioning/mongo.js');
const { provisionPostgresUser } = loadDist('services/provisioning/postgres.js');

const generateSnippets = snippetsModule.generateSnippets || (snippetsModule.default && snippetsModule.default.generateSnippets);

function ensureSnippetsService() {
  if (!generateSnippets) throw new Error('snippets service unavailable');
  return generateSnippets;
}

function listDatabases() {
  try {
    const rows = storage.listDatabases();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn('[CPS_ADAPTER] Failed to list databases', err && err.message ? err.message : err);
    return [];
  }
}

async function provisionConnection({ dbId, usernamePrefix, roles, ttl }) {
  const db = storage.getDatabase(dbId);
  if (!db) throw new Error('database_not_found');
  if (!db.admin_uri_encrypted) throw new Error('missing_admin_credentials');

  let adminUriPlain = '';
  try {
    adminUriPlain = await decrypt(db.admin_uri_encrypted);
  } catch (err) {
    const msg = err && err.message ? err.message : 'Failed to decrypt admin credentials';
    throw new Error(msg);
  }

  const enrichedDb = Object.assign({}, db, { admin_uri_encrypted: adminUriPlain });
  let result;
  if (db.type === 'mysql') result = await provisionMySQLUser(enrichedDb, usernamePrefix, roles, ttl);
  else if (db.type === 'mongodb') result = await provisionMongoUser(enrichedDb, usernamePrefix, roles, ttl);
  else if (db.type === 'postgres') result = await provisionPostgresUser(enrichedDb, usernamePrefix, roles, ttl);
  else throw new Error('unsupported_db_type');

  await storage.addProvisionedUser(dbId, result.username, result.password, JSON.stringify(roles || []), result.expiresAt, 0);
  try { storage.markProvisionedUserRevealed(result.username); } catch (err) {
    console.warn('[CPS_ADAPTER] Failed to mark provisioned user revealed', err && err.message ? err.message : err);
  }

  const { snippets, one_time_token } = ensureSnippetsService()(result.connectionString, result.username);
  const instructions = 'This connection string and password are shown only once. Store them securely.';

  return {
    configured: true,
    connectionString: result.connectionString,
    expiresAt: result.expiresAt,
    instructions,
    snippets,
    username: result.username,
    one_time_token
  };
}

module.exports = {
  listDatabases,
  provisionConnection
};
