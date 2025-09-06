const jwt = require('jsonwebtoken');
const fastJsonPatch = require('fast-json-patch');
const { ObjectId, getCollection } = require('../db/mongo.cjs');

const MAX_UPDATES_PER_SEC = Number(process.env.MAX_UPDATES_PER_SEC || 5);

function setupWorkspaceSockets(io) {
  io.on('connection', socket => {
    // authenticate on first event if token provided in auth
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'dev_secret';
        const payload = jwt.verify(token, secret);
        socket.data.user = payload;
      } catch (e) {
        console.warn('socket auth failed', e.message);
      }
    }

    // simple per-socket rate limiter
    socket._updatesWindow = { count: 0, ts: Date.now() };

    socket.on('workspace:join', async ({ workspaceId }) => {
      try {
        if (!workspaceId) return socket.emit('error', 'workspaceId required');
        // membership validation: ensure user is part of workspace (basic check)
        const coll = getCollection('workspaces');
        const doc = await coll.findOne({ _id: typeof workspaceId === 'string' ? ObjectId(workspaceId) : workspaceId });
        if (!doc) return socket.emit('error', 'workspace not found');
        // basic membership: owner or members array contains user id
        const uid = socket.data.user && (socket.data.user.id || socket.data.user._id || socket.data.user.userId);
        const isMember = !doc.private || (doc.owner && doc.owner.toString() === (uid && uid.toString())) || (doc.members && Array.isArray(doc.members) && doc.members.includes(uid));
        if (!isMember) return socket.emit('error', 'not a member');
        socket.join(`workspace:${workspaceId}`);
        socket.emit('workspace:full', { workspaceId, doc });
      } catch (e) {
        console.error('workspace:join error', e);
      }
    });

    socket.on('workspace:leave', ({ workspaceId }) => {
      if (!workspaceId) return;
      socket.leave(`workspace:${workspaceId}`);
    });

    socket.on('workspace:requestFull', async ({ workspaceId }, cb) => {
      try {
        const coll = getCollection('workspaces');
        const doc = await coll.findOne({ _id: ObjectId(workspaceId) });
        if (!doc) return cb && cb({ ok: false, error: 'not found' });
        return cb && cb({ ok: true, doc });
      } catch (e) {
        console.error('requestFull error', e);
        return cb && cb({ ok: false, error: e.message });
      }
    });

    socket.on('workspace:update', async (payload, ack) => {
      try {
        // rate limit per-socket
        const now = Date.now();
        if (now - socket._updatesWindow.ts > 1000) {
          socket._updatesWindow.ts = now; socket._updatesWindow.count = 0;
        }
        socket._updatesWindow.count++;
        if (socket._updatesWindow.count > MAX_UPDATES_PER_SEC) {
          return ack && ack({ ok: false, status: 'rate_limited' });
        }

        const { workspaceId, patches, clientVersion, tempId } = payload || {};
        if (!workspaceId || !Array.isArray(patches) || typeof clientVersion !== 'number') {
          return ack && ack({ ok: false, status: 'error', error: 'invalid payload' });
        }

        const coll = getCollection('workspaces');
        const _id = ObjectId(workspaceId);
        const current = await coll.findOne({ _id });
        if (!current) return ack && ack({ ok: false, status: 'error', error: 'workspace not found' });

        if ((current.version || 0) !== clientVersion) {
          // conflict
          socket.emit('workspace:conflict', { workspaceId, version: current.version, doc: current });
          return ack && ack({ ok: false, status: 'conflict', version: current.version });
        }

        // apply patches to a deep clone
        const clone = JSON.parse(JSON.stringify(current));
        delete clone._id; // ensure replace uses filter
        try {
          fastJsonPatch.applyPatch(clone, patches, /*validate*/ true);
        } catch (e) {
          console.error('patch apply failed', e);
          return ack && ack({ ok: false, status: 'error', error: 'patch_apply_failed' });
        }

        clone.version = (current.version || 0) + 1;

        const res = await coll.findOneAndReplace({ _id, version: clientVersion }, clone, { returnDocument: 'after' });
        if (!res.value) {
          // conflict on replace
          const latest = await coll.findOne({ _id });
          socket.emit('workspace:conflict', { workspaceId, version: latest.version, doc: latest });
          return ack && ack({ ok: false, status: 'conflict', version: latest.version });
        }

        const newVersion = res.value.version;
        // broadcast to other clients in room
        socket.to(`workspace:${workspaceId}`).emit('workspace:patched', { workspaceId, patches, version: newVersion, originSocketId: socket.id, tempId });

        // ack to origin
        return ack && ack({ ok: true, version: newVersion, tempId });
      } catch (e) {
        console.error('workspace:update error', e);
        return ack && ack({ ok: false, status: 'error', error: e.message });
      }
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });
}

module.exports = { setupWorkspaceSockets };
