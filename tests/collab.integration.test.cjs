// tests/collab.integration.test.cjs - Jest integration outline
const { createCollabClient } = require('../client/services/collab.cjs');
const mongoose = require('mongoose');
const WorkspaceSchema = require('../server/models/WorkspaceSchema.cjs');
const Y = require('yjs');

let serverProcess;
let server;
let ioClient;

beforeAll(async () => {
  // start server (assume server/index.cjs exports start function or run via child_process)
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zc_test';
  await mongoose.connect(process.env.MONGO_URI);
  await WorkspaceSchema.deleteMany({});
  // require server
  server = require('../server/index.cjs');
});

afterAll(async () => {
  await mongoose.disconnect();
  // TODO: stop server if needed
});

test('collaboration: client A edits are seen by client B and persisted', async () => {
  const serverUrl = 'http://127.0.0.1:5000';
  const workspaceId = 'test-ws-1';

  const a = createCollabClient({ serverUrl, workspaceId });
  const b = createCollabClient({ serverUrl, workspaceId });

  // wait for sockets to connect
  await new Promise(res => setTimeout(res, 500));

  // client A modifies Y map
  const mapA = a.doc.getMap('schema');
  mapA.set('table1', { name: 'users' });

  // wait for update propagation
  await new Promise(res => setTimeout(res, 500));

  // assert B has the change
  const mapB = b.doc.getMap('schema');
  expect(mapB.get('table1')).toBeDefined();
  expect(mapB.get('table1').name).toBe('users');

  // assert DB persisted snapshot eventually
  await new Promise(res => setTimeout(res, 2000));
  const rec = await WorkspaceSchema.findOne({ workspaceId });
  expect(rec).toBeTruthy();
  const doc = new Y.Doc();
  Y.applyUpdate(doc, rec.docState);
  const map = doc.getMap('schema');
  expect(map.get('table1').name).toBe('users');

  // cleanup
  a.socket.disconnect();
  b.socket.disconnect();
});
