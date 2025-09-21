const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

async function run() {
  // Start mock server (use .cjs explicit to avoid ESM .js resolution)
  const mock = require('./mock_mistral_422.cjs');
  const server = mock.listen(8088, async () => {
    console.log('Mock Mistral started on 8088');

    // Set env to point callMysterAPI to mock
    process.env.MYSTER_API_BASE_URL = 'http://localhost:8088/mistral.ai';
    process.env.MYSTER_API_KEY = 'testkey';

    // Require the callMysterAPI util
    const { callMysterAPI } = require('../../server/utils/callMysterAPI');

    try {
      // Send a payload that includes `parameters` to trigger 422
      const pathUrl = '/chat/completions';
      const body = { model: 'gpt-test', messages: [{ role: 'user', content: 'hi' }], parameters: { max_tokens: 50 } };
      console.log('Calling callMysterAPI with parameters -> expecting 422');
      await callMysterAPI({ path: 'http://localhost:8088/mistral.ai/chat/completions', method: 'POST', body, timeoutMs: 2000 });
      console.log('Unexpected success (should have thrown)');
    } catch (e) {
      console.log('callMysterAPI threw as expected. status=', e.status, 'bodyText=', e.bodyText || JSON.stringify(e.details));
    }

    // Now test fallback flow (messages -> force 422, then fallback to input)
    try {
      const body2 = { model: 'gpt-test', messages: [{ role: 'user', content: 'hello fallback' }] };
      // call directly to endpoint that will 422 when query mode=force_msg_422
      try {
        await callMysterAPI({ path: 'http://localhost:8088/mistral.ai/chat/completions?mode=force_msg_422', method: 'POST', body: body2, timeoutMs: 2000 });
        console.log('Unexpected success in forced messages 422 test');
      } catch (err) {
        console.log('Forced messages 422 received as expected:', err.status, err.bodyText || JSON.stringify(err.details));
        // Now try a simplified input fallback
        const fallback = { model: 'gpt-test', input: 'hello fallback' };
        const res = await callMysterAPI({ path: 'http://localhost:8088/mistral.ai/chat/completions', method: 'POST', body: fallback, timeoutMs: 2000 });
        console.log('Fallback response status=', res.status, 'body=', JSON.stringify(res.body));
      }
    } catch (e) {
      console.error('fallback test failed', e);
    }

    server.close(() => console.log('Mock server stopped'));
  });
}

run().catch(e=>{ console.error(e); process.exit(1); });
