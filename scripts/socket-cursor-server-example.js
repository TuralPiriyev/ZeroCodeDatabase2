// scripts/socket-cursor-server-example.js
// Minimal Socket.IO server that emits canonical cursor_update messages for testing.

const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('join_workspace', (workspaceId) => {
    socket.join(workspaceId);
    console.log('Joined workspace', workspaceId);
  });

  // echo received cursor_update messages to room (canonicalize)
  socket.on('cursor_update', (payload) => {
    // example canonicalization: ensure payload has type and cursor
    const canonical = payload && payload.cursor ? payload.cursor : payload;
    const emitPayload = {
      type: 'cursor_update',
      cursor: {
        userId: canonical.userId || canonical.uid || 'unknown',
        displayName: canonical.displayName || canonical.username || 'Anonymous',
        avatar: canonical.avatar || null,
        coordsType: canonical.coordsType || (canonical.x && canonical.y && canonical.x <= 1 && canonical.y <=1 ? 'normalized' : 'client'),
        x: canonical.x,
        y: canonical.y,
        timestamp: Date.now()
      }
    };
    // broadcast to the room(s)
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(r => io.to(r).emit('cursor_update', emitPayload));
  });

  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});

server.listen(3001, () => console.log('Example cursor server listening on :3001'));
