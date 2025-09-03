// collab_smoke_test.js
// Simple smoke test that opens two socket clients, listens for db_update, triggers a schema save via API

const io = require('socket.io-client');
const axios = require('axios');

const SERVER = process.env.TEST_SERVER || 'http://localhost:5000';
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || 'test-ws-1';
const TOKEN = process.env.TEST_TOKEN || '';

async function run() {
  console.log('Connecting two clients to', SERVER);
  const opts = { path: '/ws/portfolio-updates', transports: ['websocket'], extraHeaders: { Authorization: `Bearer ${TOKEN}` } };
  const c1 = io(`${SERVER}`, opts);
  const c2 = io(`${SERVER}`, opts);

  let c1Received = false;
  let c2Received = false;

  const onDbUpdate = (d) => {
    console.log('db_update received:', d);
    if (!c1Received) c1Received = true;
    else if (!c2Received) c2Received = true;
  };

  c1.on('connect', () => {
    console.log('c1 connected', c1.id);
    c1.emit('join_workspace', WORKSPACE_ID);
    c1.emit('user_join', { username: 'tester1', userId: 'tester1', workspaceId: WORKSPACE_ID });
  });
  c2.on('connect', () => {
    console.log('c2 connected', c2.id);
    c2.emit('join_workspace', WORKSPACE_ID);
    c2.emit('user_join', { username: 'tester2', userId: 'tester2', workspaceId: WORKSPACE_ID });
  });

  c1.on('db_update', (msg) => { console.log('c1 db_update:', msg); c1Received = true; });
  c2.on('db_update', (msg) => { console.log('c2 db_update:', msg); c2Received = true; });

  // wait for connections
  await new Promise(res => setTimeout(res, 1500));

  console.log('Triggering schema save via API...');
  try {
    const payload = {
      schemaId: 'smoke-schema',
      name: 'Smoke Schema',
      scripts: JSON.stringify({ id: 'smoke-schema', name: 'Smoke Schema', tables: [] })
    };
    const headers = {};
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
    const r = await axios.post(`${SERVER}/api/workspaces/${WORKSPACE_ID}/schemas`, payload, { headers });
    console.log('API response status:', r.status);
  } catch (e) {
    console.error('API call failed:', e.response ? e.response.data : e.message);
  }

  // wait for events
  await new Promise(res => setTimeout(res, 2000));

  console.log('Results: c1Received=', c1Received, 'c2Received=', c2Received);

  c1.disconnect();
  c2.disconnect();

  process.exit((c1Received && c2Received) ? 0 : 2);
}

run();
