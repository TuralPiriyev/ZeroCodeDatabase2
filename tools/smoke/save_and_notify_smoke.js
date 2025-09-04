/*
  Smoke script: POST save a shared schema then listen via socket for workspace-updated.
  Usage:
    node tools/smoke/save_and_notify_smoke.js
  Environment variables:
    SERVER - optional, default http://localhost:5000
    WORKSPACE_ID - optional, default ws-smoke
    SCHEMA_ID - optional, default shop_db
*/

const io = require('socket.io-client');
const axios = require('axios');

const SERVER = process.env.SERVER || 'http://localhost:5000';
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'ws-smoke';
const SCHEMA_ID = process.env.SCHEMA_ID || 'shop_db';

(async () => {
  try {
    console.log('Smoke: saving shared schema via HTTP...');
    const payload = {
      schemaId: SCHEMA_ID,
      name: 'Shop DB (smoke)',
      scripts: JSON.stringify({ tables: [{ name: 'users' }] })
    };
    const res = await axios.post(`${SERVER}/api/workspaces/${WORKSPACE_ID}/schemas`, payload, { timeout: 10000 });
    console.log('HTTP save response:', res.data && res.data.success ? 'ok' : JSON.stringify(res.data));

    console.log('Connecting socket to listen for workspace-updated...');
    const socket = io(SERVER, { path: '/ws/portfolio-updates', transports: ['websocket','polling'] });

    socket.on('connect', () => {
      console.log('socket connected, joining room:', WORKSPACE_ID);
      try { socket.emit('join-room', { workspaceId: WORKSPACE_ID }); } catch (e) {}
      try { socket.emit('join_workspace', WORKSPACE_ID); } catch (e) {}
    });

    const timeout = setTimeout(() => {
      console.error('Timed out waiting for workspace-updated');
      socket.close();
      process.exit(2);
    }, 15000);

    socket.on('workspace-updated', (data) => {
      console.log('Received workspace-updated:', data);
      clearTimeout(timeout);
      socket.close();
      process.exit(0);
    });

    socket.on('connect_error', (err) => {
      console.error('socket connect_error', err);
    });

  } catch (err) {
    console.error('Smoke script error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
