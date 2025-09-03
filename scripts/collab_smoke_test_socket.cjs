// collab_smoke_test_socket.cjs
// Smoke test that opens two socket clients, has one emit 'schema_change' with full schema, and verifies both receive db_update

const io = require('socket.io-client');

const SERVER = process.env.TEST_SERVER || 'http://localhost:5000';
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || 'test-ws-1';

async function run() {
  console.log('Connecting two clients to', SERVER);
  const opts = { path: '/ws/portfolio-updates', transports: ['websocket'] };
  const c1 = io(`${SERVER}`, opts);
  const c2 = io(`${SERVER}`, opts);

  let c1Received = false;
  let c2Received = false;

  c1.on('connect', () => {
    console.log('c1 connected', c1.id);
    c1.emit('join_workspace', WORKSPACE_ID);
    c1.emit('user_join', { username: 'tester1', userId: 'tester1', workspaceId: WORKSPACE_ID });
  });
  c1.on('connect_error', (err) => { console.error('c1 connect_error:', err && err.message ? err.message : err); });
  c1.on('error', (err) => { console.error('c1 error:', err); });
  c2.on('connect', () => {
    console.log('c2 connected', c2.id);
    c2.emit('join_workspace', WORKSPACE_ID);
    c2.emit('user_join', { username: 'tester2', userId: 'tester2', workspaceId: WORKSPACE_ID });
  });
  c2.on('connect_error', (err) => { console.error('c2 connect_error:', err && err.message ? err.message : err); });
  c2.on('error', (err) => { console.error('c2 error:', err); });

  c1.on('db_update', (msg) => { console.log('c1 db_update:', msg); c1Received = true; });
  c2.on('db_update', (msg) => { console.log('c2 db_update:', msg); c2Received = true; });

  // wait for connections
  await new Promise(res => setTimeout(res, 1500));

  console.log('c1 emitting schema_change with full schema...');
  const payload = {
    schemaId: 'socket-smoke-schema',
    name: 'Socket Smoke Schema',
    schema: JSON.stringify({ id: 'socket-smoke-schema', name: 'Socket Smoke Schema', tables: [] }),
    workspaceId: WORKSPACE_ID
  };
  c1.emit('schema_change', payload);

  // wait for events
  await new Promise(res => setTimeout(res, 2000));

  console.log('Results: c1Received=', c1Received, 'c2Received=', c2Received);

  c1.disconnect();
  c2.disconnect();

  process.exit((c1Received && c2Received) ? 0 : 2);
}

run();
