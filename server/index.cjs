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
  // Simple request logger to help debug routing in production
  app.use((req, res, next) => {
    try {
      console.log('[REQ]', req.method, req.originalUrl);
    } catch (e) {}
    next();
  });

  // Track whether the AI router was mounted successfully
  let aiRouterMounted = false;

  // Capture direct POSTs to the expected production path and provide a helpful
  // debug response when the AI router isn't mounted. This helps diagnose 404s
  // caused by the router not being loaded or by proxy path rewrites.
  app.post('/api/ai/dbquery', (req, res, next) => {
    try {
      console.log('[AI_CAPTURE]', req.method, req.originalUrl, 'bodyKeys=', Object.keys(req.body || {}));
    } catch (e) {}
    if (aiRouterMounted) return next();
    // If the router isn't mounted, return a clear JSON response instead of a vague 404
    return res.status(502).json({ error: 'AI router not mounted on this server instance', triedPath: req.originalUrl });
  });
  // Allow cross-origin from frontend if needed
  try {
    const cors = require('cors');
    app.use(cors());
  } catch (e) {
    // cors not installed; continue without CORS middleware
    console.warn('cors module not available; cross-origin requests may be blocked');
  }

  // Mount AI DBQuery router so POST /api/ai/dbquery is served
  try {
    const dbqueryRouter = require('../src/api/dbquery');
  // Mount at multiple prefixes to tolerate proxy rewrites during debugging
  app.use('/api/ai', dbqueryRouter);
  app.use('/ai', dbqueryRouter);
  app.use('/api', dbqueryRouter);
  aiRouterMounted = true;
  console.log('Mounted AI router at /api/ai, /ai, and /api');
  } catch (e) {
    console.warn('Could not mount AI router:', e && e.message ? e.message : e);
  }

  const server = http.createServer(app);
  const io = new socketIo.Server(server, { path: '/ws/replicate' });

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
  io.on('connection', socket => {
    console.log('Socket connected', socket.id);

    socket.on('join-room', async ({ workspaceId }) => {
      try {
        console.log('join-room', workspaceId, 'socket', socket.id);
        socket.join(`workspace_${workspaceId}`);
        const entry = await ensureDoc(workspaceId);
        // send full snapshot (encode state)
        const state = Y.encodeStateAsUpdate(entry.doc);
        // send as binary Buffer
        socket.emit('snapshot', state);
      } catch (e) {
        console.error('join-room error', e);
      }
    });

    socket.on('y-update', async ({ workspaceId, update }) => {
      try {
        if (!workspaceId || !update) return;
        const entry = await ensureDoc(workspaceId);
        // update may arrive as Buffer or base64 string
        let buf = update;
        if (typeof update === 'string') buf = Buffer.from(update, 'base64');
        // applyUpdate
        Y.applyUpdate(entry.doc, buf);
        entry.version = (entry.version || 0) + 1;
        entry.pending = (entry.pending || 0) + 1;
        // broadcast to others
        socket.to(`workspace_${workspaceId}`).emit('y-update', { workspaceId, update: buf });
        // persist debounced: simple approach - persist every 5 updates or every 5s
        if (entry.pending >= 5) {
          const state = Y.encodeStateAsUpdate(entry.doc);
          await persistSnapshot(workspaceId, state, entry.version);
          entry.pending = 0;
          console.log('Persisted snapshot (count based) for', workspaceId);
        } else {
          // schedule timeout persister per workspace if not set
          if (!entry._persistTimer) {
            entry._persistTimer = setTimeout(async () => {
              try {
                const state = Y.encodeStateAsUpdate(entry.doc);
                await persistSnapshot(workspaceId, state, entry.version);
                entry.pending = 0;
                console.log('Persisted snapshot (timer) for', workspaceId);
              } catch (e) {
                console.error('Persist timer error', e);
              } finally {
                entry._persistTimer = null;
              }
            }, 5000);
          }
        }
      } catch (e) {
        console.error('y-update error', e);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected', socket.id);
    });
  });

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

  // Listen on all interfaces so external requests (including API calls) are reachable
  server.listen(PORT, () => {
    console.log('Server listening on', PORT);
  });
}

start().catch(e => { console.error('Server start failed', e); process.exit(1); });
