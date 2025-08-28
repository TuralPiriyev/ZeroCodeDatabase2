// test-socket-client.js
const { io } = require("socket.io-client");

const socket = io("https://startup-1-j563.onrender.com", {
  path: "/ws/portfolio-updates",
  transports: ['websocket','polling'],
  reconnectionAttempts: 3,
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ connected:', socket.id);
  socket.emit('join_workspace', 'default-workspace'); // optional
});

socket.on('connect_error', (err) => {
  console.error('❌ connect_error:', err && err.message ? err.message : err);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('❌ disconnected:', reason);
});
