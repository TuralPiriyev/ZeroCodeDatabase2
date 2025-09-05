// scripts/migrate_add_sharedid.cjs
// Run with: node scripts/migrate_add_sharedid.cjs

const mongoose = require('mongoose');
const SchemaModel = require('../src/models/Schema.cjs');
const { v4: uuidv4 } = require('uuid');

async function run() {
  const MONGO = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zc_dev';
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to Mongo:', MONGO);

  // Ensure index exists
  try {
    await SchemaModel.syncIndexes();
    console.log('Indexes synced');
  } catch (e) {
    console.warn('Index sync failed', e.message || e);
  }

  // Find existing docs that are shared but missing sharedId
  const toUpdate = await SchemaModel.find({ isShared: true, $or: [{ sharedId: { $exists: false } }, { sharedId: null }, { sharedId: '' }] }).limit(1000).lean();
  console.log('Found', toUpdate.length, 'shared docs missing sharedId');
  let updated = 0;
  for (const d of toUpdate) {
    try {
      const sid = uuidv4();
      await SchemaModel.updateOne({ _id: d._id }, { $set: { sharedId: sid } }).exec();
      updated++;
    } catch (e) {
      console.warn('Failed to update', d._id, e.message || e);
    }
  }
  console.log('Assigned sharedId to', updated, 'documents');
  await mongoose.disconnect();
  console.log('Done');
}

run().catch(e => { console.error('Migration failed', e); process.exit(1); });
