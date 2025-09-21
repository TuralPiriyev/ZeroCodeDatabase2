const express = require('express');
const bodyParser = require('body-parser');

async function run() {
  process.env.MYSTER_API_BASE_URL = 'http://localhost:8088/mistral.ai';
  process.env.MYSTER_API_KEY = 'testkey';
  process.env.MYSTER_OWNER = 'owner';
  process.env.MYSTER_MODEL = 'model';

  // mount the dbquery router
  const app = express();
  app.use(bodyParser.json());
  const dbquery = require('../../src/api/dbquery.cjs');
  app.use('/api/dbquery', dbquery);

  const mock = require('./mock_mistral_422');
  const server = mock.listen(8088, async () => {
    console.log('Mock Mistral started on 8088');
    const srv = app.listen(9090, async () => {
      console.log('Test server started on 9090');

      // POST a body that would normally be forwarded as messages
      const fetch = require('node-fetch');
      const body = { question: 'Give me a simple SQL select', language: 'en' };
      try {
        const r = await fetch('http://localhost:9090/api/dbquery/dbquery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        console.log('Response status:', r.status);
        const j = await r.json().catch(()=>null);
        console.log('Response body:', j);
      } catch (e) {
        console.error('Request failed', e);
      }

      srv.close(()=>console.log('Test server stopped'));
      server.close(()=>console.log('Mock server stopped'));
    });
  });
}

run().catch(e=>{ console.error(e); process.exit(1); });
