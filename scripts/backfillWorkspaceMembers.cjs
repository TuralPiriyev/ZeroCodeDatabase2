// backfillWorkspaceMembers.cjs
// One-off script to populate Workspace.members denormalized array from Member collection

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Workspace = require('../src/models/Workspace.cjs');
const Member = require('../src/models/Member.cjs');

const MONGO = process.env.MONGO_URL || 'mongodb://localhost:27017/zerocode';

(async () => {
  try {
    await mongoose.connect(MONGO, { dbName: process.env.MONGO_DB_NAME || undefined });
    console.log('Connected to MongoDB for backfill');

    const workspaces = await Workspace.find({}).lean();
    console.log('Found', workspaces.length, 'workspaces');

    let updated = 0;
    for (const ws of workspaces) {
      const wid = ws.id || ws._id;
      const members = await Member.find({ workspaceId: wid }).select('username userId role joinedAt -_id').lean();
      if (!members || members.length === 0) continue;

      const wsDoc = await Workspace.findOne({ id: wid });
      if (!wsDoc) continue;

      wsDoc.members = members.map(m => ({ username: m.username, userId: m.userId, role: m.role, joinedAt: m.joinedAt || new Date() }));
      wsDoc.updatedAt = new Date();
      await wsDoc.save();
      updated++;
      console.log(`Updated workspace ${wid} with ${members.length} members`);
    }

    console.log('Backfill complete. Workspaces updated:', updated);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
})();
