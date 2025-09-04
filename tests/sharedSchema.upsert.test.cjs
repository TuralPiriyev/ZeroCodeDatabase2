const mongoose = require('mongoose');
const request = require('supertest');
const http = require('http');
const express = require('express');

// This test assumes server.cjs exports an Express app or can be required in test mode.
// As a lightweight integration, we'll require the workspaceRoutes and mount it on a test app.

const Workspace = require('../src/models/Workspace.cjs');
const SharedSchema = require('../src/models/SharedSchema.cjs');
const workspaceRoutes = require('../src/routes/workspaceRoutes.cjs');

let app;
let server;

beforeAll(async () => {
  const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zc_test';
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  await SharedSchema.deleteMany({});
  await Workspace.deleteMany({});

  app = express();
  app.use(express.json());
  // stub authentication middleware to allow tests without tokens
  app.use((req, res, next) => { req.userId = 'test-user'; req.user = { username: 'test-user' }; next(); });
  app.use('/api/workspaces', workspaceRoutes);
  server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
});

afterAll(async () => {
  await mongoose.connection.close();
  server.close();
});

test('save snapshot upserts and does not create duplicate SharedSchema docs', async () => {
  // create workspace
  const ws = new Workspace({ id: 'ws-123', name: 'Test WS', ownerId: 'test-user' });
  await ws.save();

  // create existing shared schema
  const existing = new SharedSchema({ workspaceId: 'ws-123', schemaId: 'shop_db', name: 'Shop DB', scripts: JSON.stringify({ tables: [] }), version: 1 });
  await existing.save();

  // call save endpoint with same workspaceId + schemaId
  const agent = request(app);
  const payload = { schemaId: 'shop_db', name: 'Shop DB v2', scripts: JSON.stringify({ tables: [{ name: 'users' }] }) };

  const res = await agent.post('/api/workspaces/ws-123/schemas').send(payload).expect(200);
  expect(res.body.success).toBe(true);

  // count records for workspace+schema
  const docs = await SharedSchema.find({ workspaceId: 'ws-123', schemaId: 'shop_db' });
  expect(docs.length).toBe(1);
  const doc = docs[0];
  expect(doc.name).toBe('Shop DB v2');
  expect(doc.version).toBeGreaterThanOrEqual(2);
});
