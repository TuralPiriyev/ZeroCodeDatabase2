// client/services/collab.cjs - minimal Yjs client helper using socket.io-client
const io = require('socket.io-client');
const Y = require('yjs');

function createCollabClient({ serverUrl, workspaceId }) {
  const socket = io(serverUrl, { path: '/ws/replicate' });
  const doc = new Y.Doc();

  socket.on('connect', () => console.log('collab socket connected', socket.id));
  socket.on('disconnect', () => console.log('collab socket disconnected'));

  // When we receive a full snapshot from server, apply it
  socket.on('snapshot', (state) => {
    try {
      const buf = Buffer.isBuffer(state) ? state : Buffer.from(state);
      Y.applyUpdate(doc, buf);
      console.log('Applied snapshot from server');
    } catch (e) {
      console.error('Failed apply snapshot', e);
    }
  });

  // When we receive updates from other clients, apply
  socket.on('y-update', ({ update }) => {
    try {
      const buf = Buffer.isBuffer(update) ? update : Buffer.from(update);
      Y.applyUpdate(doc, buf);
      console.log('Applied remote update');
    } catch (e) {
      console.error('Failed apply remote update', e);
    }
  });

  // send local updates to server
  doc.on('update', (update) => {
    try {
      // send Buffer
      socket.emit('y-update', { workspaceId, update: Buffer.from(update) });
    } catch (e) {
      console.error('Failed to send update', e);
    }
  });

  // join room once connected
  socket.on('connect', () => {
    socket.emit('join-room', { workspaceId });
  });

  return { socket, doc };
}

module.exports = { createCollabClient };
