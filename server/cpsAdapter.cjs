const fs = require('fs');
const path = require('path');

const cpsDistRoot = path.resolve(__dirname, '..', 'cps', 'dist', 'src');

function loadDist(subPath) {
  return require(path.join(cpsDistRoot, subPath));
}

const snippetsModule = loadDist('services/snippetsService.js');
const { provisionMySQLUser } = loadDist('services/provisioning/mysql.js');
const { provisionMongoUser } = loadDist('services/provisioning/mongo.js');
const { provisionPostgresUser } = loadDist('services/provisioning/postgres.js');
const generateSnippets = snippetsModule.generateSnippets || (snippetsModule.default && snippetsModule.default.generateSnippets);

if (!generateSnippets) {
  throw new Error('Failed to load CPS snippets service');
}

function defaultPort(type) {
  if (type === 'mongodb') return 27017;
  if (type === 'postgres') return 5432;
  return 3306;
}

function normalizeEntry(entry) {
  if (!entry) return null;
  const type = (entry.type || process.env.CPS_DB_TYPE || 'mysql').toLowerCase();
  const id = entry.id || entry.name || `db-${type}`;
  const name = entry.name || process.env.CPS_DB_NAME || 'default';
  const host = entry.host || process.env.CPS_DB_HOST;
  const port = Number(entry.port || process.env.CPS_DB_PORT) || defaultPort(type);
  const adminUri = entry.adminUri || entry.admin_uri || entry.adminConnectionString || process.env.CPS_DB_ADMIN_URI;
  if (!host || !adminUri) return null;
  return {
    id,
    name,
    type,
    host,
    port,
    adminUri
  };
}

function loadConfigFile() {
  const configPath = process.env.CPS_DATABASES_PATH || path.resolve(__dirname, '..', 'cps', 'databases.config.json');
  if (!fs.existsSync(configPath)) return [];
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[CPS_ADAPTER] Failed to parse databases config', err && err.message ? err.message : err);
    return [];
  }
}

function loadFromEnvJson() {
  const json = process.env.CPS_DATABASES_JSON;
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[CPS_ADAPTER] Failed to parse CPS_DATABASES_JSON', err && err.message ? err.message : err);
    return [];
  }
}

let cached = null;

function loadDatabases() {
  if (cached) return cached;
  const envList = loadFromEnvJson();
  const fileList = envList.length ? envList : loadConfigFile();
  const normalized = fileList.map(normalizeEntry).filter(Boolean);
  if (normalized.length) {
    cached = normalized;
    return cached;
  }
  const legacy = normalizeEntry({});
  cached = legacy ? [legacy] : [];
  return cached;
}

function listDatabases() {
  return loadDatabases().map(db => ({ id: db.id, name: db.name, type: db.type, host: db.host, port: db.port }));
}

function findDatabase(dbId) {
  const all = loadDatabases();
  if (!all.length) return null;
  if (!dbId) return all[0];
  const match = all.find(db => db.id === dbId);
  if (match) return match;
  if (all.length === 1) {
    console.warn(`[CPS_ADAPTER] Requested dbId "${dbId}" not found; falling back to the only configured database (${all[0].id}).`);
    return all[0];
  }
  console.warn(`[CPS_ADAPTER] Requested dbId "${dbId}" not found among ${all.length} configured databases.`);
  return null;
}

async function provisionConnection({ dbId, usernamePrefix, ttl }) {
  const db = findDatabase(dbId);
  if (!db) throw new Error('database_not_found');
  const enriched = {
    id: db.id,
    name: db.name,
    type: db.type,
    host: db.host,
    port: db.port,
    admin_uri_encrypted: db.adminUri
  };

  let result;
  if (db.type === 'mysql') {
    result = await provisionMySQLUser(enriched, usernamePrefix, undefined, ttl);
  } else if (db.type === 'mongodb') {
    result = await provisionMongoUser(enriched, usernamePrefix, undefined, ttl);
  } else if (db.type === 'postgres') {
    result = await provisionPostgresUser(enriched, usernamePrefix, undefined, ttl);
  } else {
    throw new Error('unsupported_db_type');
  }

  const { snippets, one_time_token } = generateSnippets(result.connectionString, result.username);
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
