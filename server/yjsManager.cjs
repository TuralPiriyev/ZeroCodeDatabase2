const Y = require('yjs');
const { encodeStateAsUpdate, applyUpdate, encodeStateVectorFromUpdate } = require('yjs');
const WorkspaceState = require('../src/models/WorkspaceState.cjs');

const docs = new Map(); // workspaceId -> Y.Doc
const persistTimers = new Map();
let ioInstance = null;
let changeStream = null;

function toUint8Array(b64) {
  return Buffer.from(b64, 'base64');
}
function toBase64(u8) {
  return Buffer.from(u8).toString('base64');
}

async function init(io, mongooseConn) {
  ioInstance = io;

  // Load existing workspace states into memory lazily when requested.
  // Watch change stream for cross-instance propagation if supported
  try {
    if (mongooseConn && mongooseConn.connection) {
      const coll = mongooseConn.connection.collection('workspacestates');
      changeStream = coll.watch([], { fullDocument: 'updateLookup' });
      changeStream.on('change', async (ch) => {
        try {
          if (ch.operationType === 'update' || ch.operationType === 'replace') {
            const doc = ch.fullDocument;
            if (!doc || !doc.workspaceId) return;
            const wsId = doc.workspaceId;
            // Emit to local clients the updated state so other instances get notified
            if (ioInstance) {
              try {
                // Broadcast workspace-updated-meta
                ioInstance.to(`workspace_${wsId}`).emit('workspace-updated-meta', { workspaceId: wsId, version: doc.version, lastModified: doc.lastModified });
                // Broadcast full snapshot as base64
                if (doc.state) {
                  const b64 = Buffer.from(doc.state).toString('base64');
                  ioInstance.to(`workspace_${wsId}`).emit('yjs-snapshot', b64);
                }
              } catch (e) {
                console.warn('yjsManager changeStream emit failed', e);
              }
            }
          }
        } catch (e) { /* ignore */ }
      });
      console.log('yjsManager: ChangeStream watcher started for workspace_states');
    }
  } catch (e) {
    console.warn('yjsManager: ChangeStream not available — configure Redis adapter for multi-instance broadcasting', e);
  }
}

async function ensureDoc(workspaceId) {
  if (docs.has(workspaceId)) return docs.get(workspaceId);
  const doc = new Y.Doc();
  // Try to load persisted state
  try {
    const ws = await WorkspaceState.findOne({ workspaceId }).lean().exec();
    if (ws && ws.state) {
      const u8 = Buffer.from(ws.state);
      try { Y.applyUpdate(doc, u8); } catch (e) { console.warn('yjsManager.applyUpdate failed on load', e); }
    }
  } catch (e) {
    console.warn('yjsManager.ensureDoc load failed', e);
  }
  docs.set(workspaceId, doc);
  return doc;
}

async function getDoc(workspaceId) { return ensureDoc(workspaceId); }

async function persistState(workspaceId) {
  const doc = await ensureDoc(workspaceId);
  try {
    const encoded = Y.encodeStateAsUpdate(doc);
    const buf = Buffer.from(encoded);
    const updated = await WorkspaceState.findOneAndUpdate(
      { workspaceId },
      { $set: { state: buf, lastModified: new Date(), shared: true }, $inc: { version: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
    return updated;
  } catch (e) {
    console.warn('yjsManager.persistState failed', e);
    throw e;
  }
}

function schedulePersist(workspaceId, delay = 300) {
  if (persistTimers.has(workspaceId)) clearTimeout(persistTimers.get(workspaceId));
  persistTimers.set(workspaceId, setTimeout(() => { persistState(workspaceId).catch(() => {}); persistTimers.delete(workspaceId); }, delay));
}

async function applyUpdateFromClient(workspaceId, updateUint8Array, meta = {}) {
  try {
    const doc = await ensureDoc(workspaceId);
    try { Y.applyUpdate(doc, updateUint8Array); } catch (e) { console.warn('yjsManager.applyUpdate failed', e); }
    // Broadcast update to others
    if (ioInstance) {
      try { ioInstance.to(`workspace_${workspaceId}`).emit('yjs-update', Buffer.from(updateUint8Array).toString('base64')); } catch (e) { /* ignore */ }
      try { ioInstance.to(`workspace_${workspaceId}`).emit('workspace-updated-meta', { workspaceId, version: null, lastModified: new Date() }); } catch (e) {}
    }
    // Schedule persistence (coalesced)
    schedulePersist(workspaceId, 300);
  } catch (e) { console.warn('yjsManager.applyUpdateFromClient failed', e); }
}

function encodeState(workspaceId) {
  const doc = docs.get(workspaceId);
  if (!doc) return null;
  const encoded = Y.encodeStateAsUpdate(doc);
  return Buffer.from(encoded).toString('base64');
}

module.exports = { init, getDoc, applyUpdateFromClient, persistState, encodeState };
