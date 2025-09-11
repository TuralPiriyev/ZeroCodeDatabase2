// Quick test harness to invoke the AI handler directly without starting the full server.
const router = require('../src/api/dbquery.cjs');
const handler = router.handleDbQuery;

// Mock request/response
function mkReq(body) { return { body, headers: {}, method: 'POST', originalUrl: '/api/ai/dbquery' }; }
function mkRes() {
  let statusCode = 200;
  return {
    status(code) { statusCode = code; return this; },
    json(obj) { console.log('RESPONSE', statusCode, JSON.stringify(obj, null, 2)); }
  };
}

(async () => {
  console.log('Running test 1: DB question (AZ)');
  await handler(mkReq({ question: 'Hansı sütun əsas açar olmalıdır?', language: 'az' }), mkRes());

  console.log('\nRunning test 2: Non-DB question (EN)');
  await handler(mkReq({ question: 'What is the weather today?', language: 'en' }), mkRes());
})();
