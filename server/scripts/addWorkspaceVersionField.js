/**
 * Run this script with: node server/scripts/addWorkspaceVersionField.js
 * It will set version:0 for any workspaces missing the version field.
 */
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGO_URL;
  const dbName = process.env.MONGO_DBNAME || process.env.MONGO_DB || 'test';
  if (!uri) { console.error('MONGO_URI missing'); process.exit(1); }
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection('workspaces');
  const res = await coll.updateMany({ version: { $exists: false } }, { $set: { version: 0 } });
  console.log('updated', res.modifiedCount, 'documents');
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
