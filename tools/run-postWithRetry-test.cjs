const mockApp = require('../tools/diag-hf/mock_hf_server');
const { postWithRetry } = require('../src/utils/hf-retry/postWithRetry');

async function run() {
  const server = mockApp.listen(8088, () => console.log('mock server started'));
  try {
    console.log('Test 1: should succeed on 200');
    const r1 = await postWithRetry('http://localhost:8088/models/x/x?mode=ok', { inputs: 'x' }, undefined, { maxAttempts: 3, baseDelayMs: 100 });
    console.log('Test1 status', r1.status);

    console.log('Test 2: 503 should retry and then throw');
    const start = Date.now();
    try {
      await postWithRetry('http://localhost:8088/models/x/x?mode=503', { inputs: 'x' }, undefined, { maxAttempts: 3, baseDelayMs: 100 });
      console.log('Unexpected success');
    } catch (e) {
      const elapsed = Date.now() - start;
      console.log('Test2 elapsed', elapsed);
    }

    console.log('Test 3: 429 honors Retry-After');
    const start2 = Date.now();
    try {
      await postWithRetry('http://localhost:8088/models/x/x?mode=429', { inputs: 'x' }, undefined, { maxAttempts: 2, baseDelayMs: 100 });
      console.log('Unexpected success 429');
    } catch (e) {
      const elapsed2 = Date.now() - start2;
      console.log('Test3 elapsed', elapsed2);
    }
  } finally {
    server.close(() => console.log('mock server stopped'));
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
