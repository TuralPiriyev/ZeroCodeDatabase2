const express = require('express');
const request = require('supertest');
const nock = require('nock');

describe('server proxy integration', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    const proxy = require('../../server/proxy');
    app.use('/api/proxy', proxy);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('forwards request and attaches Authorization from env', async () => {
    process.env.MYSTER_API_KEY = 'test-token-123';
    const upstream = nock('https://api.myster.example')
      .post('/models/x/y')
      .reply(function(uri, body) {
        // assert Authorization header was set
        if (this.req.headers.authorization !== 'Bearer test-token-123') {
          return [401, { error: 'missing auth' }];
        }
        return [200, { ok: true, received: body }];
      });

    const res = await request(app)
      .post('/api/proxy/models/x/y')
      .send({ inputs: 'hi' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBeTruthy();
  });

  test('forwards 503 upstream status', async () => {
    process.env.MYSTER_API_KEY = 'test-token-123';
    nock('https://api.myster.example')
      .post('/models/x/y')
      .reply(503, { error: 'service unavailable' });

    const res = await request(app)
      .post('/api/proxy/models/x/y')
      .send({ inputs: 'x' });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });
});
