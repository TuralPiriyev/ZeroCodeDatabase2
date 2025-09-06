// server/index.cjs - Express + Socket.IO + Yjs collaborative server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { loadSnapshot, persistSnapshot } = require('./replicate.cjs');
const WorkspaceSchema = require('./models/WorkspaceSchema.cjs');
const Y = require('yjs');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;

async function start() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log('✅ Mongo connected');

  const app = express();
  app.use(bodyParser.json({ limit: '10mb' }));

  const server = http.createServer(app);
  const io = new socketIo.Server(server, { path: '/ws/replicate' });

  // expose io on the app so routes can emit events
  app.set('io', io);

  // Redis adapter for scaling (optional)
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('🔁 socket.io redis adapter connected');
      }).catch(err => {
        console.warn('Redis adapter connection failed', err);
      });
    } catch (e) {
      console.warn('Redis adapter not configured or missing packages', e.message);
    }
  }

  // In-memory docs: Map<workspaceId, { doc: Y.Doc, version: Number, pending: Number }>
  const docs = new Map();

  // Helper: ensure a Y.Doc is loaded for workspaceId
  async function ensureDoc(workspaceId) {
    if (docs.has(workspaceId)) return docs.get(workspaceId);
    const doc = new Y.Doc();
    // try load snapshot from DB
    const buf = await loadSnapshot(workspaceId);
    if (buf) {
      try {
        Y.applyUpdate(doc, buf);
        console.log('🔁 Loaded snapshot for', workspaceId);
      } catch (e) {
        console.warn('Failed to apply snapshot for', workspaceId, e);
      }
    }
    const entry = { doc, version: 0, pending: 0 };
    docs.set(workspaceId, entry);
    return entry;
  }

  // Socket handlers
  // Setup workspace sockets (optimistic JSON-patch protocol)
  try {
    const { connectWithRetry } = require('./db/mongo.cjs');
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    const dbName = process.env.MONGO_DBNAME || process.env.MONGO_DB || 'test';
    connectWithRetry(mongoUri, dbName).then(({ client, db, emitter } = {}) => {
      const { setupWorkspaceSockets } = require('./sockets/workspaceSockets.cjs');
      setupWorkspaceSockets(io);

      // forward changeStream events to socket.io rooms
      try {
        emitter.on('workspace:full', ({ workspaceId, doc }) => {
          try {
            io.to(`workspace:${workspaceId}`).emit('workspace:full', { workspaceId, doc });
          } catch (e) { console.error('emit workspace:full failed', e); }
        });
        emitter.on('workspace:deleted', ({ workspaceId }) => {
          try { io.to(`workspace:${workspaceId}`).emit('workspace:deleted', { workspaceId }); } catch (e) { console.error(e); }
        });
        console.log('🔁 ChangeStream -> socket.io wiring established');
      } catch (e) { console.warn('Failed to wire ChangeStream to io', e); }
    }).catch(err => console.warn('workspace sockets init failed', err));
  } catch (e) {
    console.warn('workspace sockets require failed', e.message);
  }

  // REST endpoints
  app.get('/api/workspaces/:id/snapshot', async (req, res) => {
    try {
      const workspaceId = req.params.id;
      const entry = await ensureDoc(workspaceId);
      const state = Y.encodeStateAsUpdate(entry.doc);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.send(state);
    } catch (e) {
      console.error('GET snapshot error', e);
      res.status(500).json({ error: 'Failed to load snapshot' });
    }
  });

  app.post('/api/workspaces/:id/saveSnapshot', async (req, res) => {
    try {
      const workspaceId = req.params.id;
      const entry = await ensureDoc(workspaceId);
      const state = Y.encodeStateAsUpdate(entry.doc);
      await persistSnapshot(workspaceId, state, entry.version);
      return res.json({ success: true });
    } catch (e) {
      console.error('POST saveSnapshot error', e);
      res.status(500).json({ error: 'Failed to save snapshot' });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log('Server listening on', PORT);
  });
}

start().catch(e => { console.error('Server start failed', e); process.exit(1); });
