// server/replicate.cjs
const Y = require('yjs');
const WorkspaceSchema = require('./models/WorkspaceSchema.cjs');

/**
 * Load snapshot from MongoDB for workspaceId. Returns a Buffer or null.
 */
async function loadSnapshot(workspaceId) {
  const rec = await WorkspaceSchema.findOne({ workspaceId }).lean();
  if (!rec || !rec.docState) return null;
  return rec.docState; // Buffer
}

/**
 * Persist an encoded Yjs update/state as the authoritative docState.
 * Uses findOneAndUpdate (upsert) to be transactional-safe for simple writes.
 */
async function persistSnapshot(workspaceId, docStateBuffer, version) {
  const now = new Date();
  const update = {
    $set: {
      docState: docStateBuffer,
      version: version != null ? version : 0,
      lastModified: now
    }
  };
  const opts = { upsert: true, new: true };
  return WorkspaceSchema.findOneAndUpdate({ workspaceId }, update, opts).exec();
}

module.exports = { loadSnapshot, persistSnapshot };
