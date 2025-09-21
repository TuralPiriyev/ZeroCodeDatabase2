const express = require('express');
const request = require('supertest');
const nock = require('nock');

async function run() {
  const app = express();
  app.use(express.json());
  const proxy = require('../server/proxy');
  app.use('/api/proxy', proxy);

  console.log('Running proxy smoke tests...');

  // Test 1: Authorization header passed
  process.env.MYSTER_API_KEY = 'test-token-123';
  let upstream = nock('https://api.myster.example')
    .post('/models/x/y')
    .reply(function(uri, body) {
      if (this.req.headers.authorization !== 'Bearer test-token-123') {
        return [401, { error: 'missing auth' }];
      }
      return [200, { ok: true, received: body }];
    });

  const res1 = await request(app)
    .post('/api/proxy/models/x/y')
    .send({ inputs: 'hi' })
    .set('Content-Type', 'application/json');

  console.log('Test 1 status:', res1.status);
  console.log('Test 1 body:', res1.body);

  if (res1.status !== 200 || !res1.body || !res1.body.ok) {
    console.error('Test 1 failed');
    process.exit(2);
  }

  nock.cleanAll();

  // Test 2: upstream 503 forwarded
  process.env.MYSTER_API_KEY = 'test-token-123';
  nock('https://api.myster.example')
    .post('/models/x/y')
    .reply(503, { error: 'service unavailable' });

  const res2 = await request(app)
    .post('/api/proxy/models/x/y')
    .send({ inputs: 'x' });

  console.log('Test 2 status:', res2.status);
  console.log('Test 2 body:', res2.body);

  if (res2.status !== 503) {
    console.error('Test 2 failed');
    process.exit(3);
  }

  console.log('Proxy smoke tests passed');
  process.exit(0);
}

run().catch(err => { console.error('Smoke tests error', err); process.exit(4); });
