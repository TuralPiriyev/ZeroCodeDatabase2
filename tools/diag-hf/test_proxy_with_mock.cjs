const express = require('express');

async function run() {
  // configure env to point proxy upstream to mock
  process.env.PROXY_UPSTREAM = 'http://localhost:8088';
  process.env.MYSTER_API_BASE_URL = 'http://localhost:8088/mistral.ai';
  process.env.MYSTER_API_KEY = 'testkey';
  process.env.MYSTER_OWNER = 'owner';
  process.env.MYSTER_MODEL = 'model';

  // start mock
  const mock = require('./mock_mistral_422.cjs');
  const mockServer = mock.listen(8088, async () => {
    console.log('Mock Mistral started');

    // start proxy app mounting server/proxy.js
    const proxyRouter = require('../../server/proxy');
    const app = express();
    // global error handlers to surface unexpected crashes
    process.on('uncaughtException', (err) => { console.error('uncaughtException', err && err.stack ? err.stack : err); });
    process.on('unhandledRejection', (err) => { console.error('unhandledRejection', err && err.stack ? err.stack : err); });
    app.use('/api/proxy', proxyRouter);
    const srv = app.listen(7070, async () => {
      console.log('Proxy test server listening on 7070');

      const fetch = require('node-fetch');

      // Test 1: send body that will cause server to include parameters in upstream (simulate old behavior)
      const badBody = { question: 'Test bad', language: 'en', messages: [{ role: 'user', content: 'hi' }], parameters: { max_tokens: 50 } };
      try {
        const r1 = await fetch('http://localhost:7070/api/proxy/dbquery', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(badBody) });
        console.log('Bad request to proxy status', r1.status);
        const j1 = await r1.json().catch(()=>null);
        console.log('Bad response body', j1);
      } catch (e) { console.error('Bad test failed', e); }

      // Test 2: send normal body (no parameters) should succeed or fallback
      const goodBody = { question: 'How to select distinct users?', language: 'en' };
      try {
        const r2 = await fetch('http://localhost:7070/api/proxy/dbquery', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(goodBody) });
        console.log('Good request to proxy status', r2.status);
        const j2 = await r2.json().catch(()=>null);
        console.log('Good response body', j2);
      } catch (e) { console.error('Good test failed', e); }

      srv.close(()=>console.log('Proxy server stopped'));
      mockServer.close(()=>console.log('Mock server stopped'));
    });
  });
}

run().catch(e=>{ console.error(e); process.exit(1); });
