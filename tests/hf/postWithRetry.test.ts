import { postWithRetry } from '../../src/utils/hf-retry/postWithRetry';
import mockApp from '../../tools/diag-hf/mock_hf_server';
import http from 'http';

let server: http.Server;
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = mockApp.listen(8088, () => resolve());
  });
});
afterAll(async () => {
  if (server && server.close) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('succeeds on 200', async () => {
  const res = await postWithRetry('http://localhost:8088/models/x/x?mode=ok', { inputs: 'x' }, undefined, { maxAttempts: 3 });
  expect(res.status).toBe(200);
});

test('retries on 503 and eventually throws if upstream remains down', async () => {
  const start = Date.now();
  await expect(postWithRetry('http://localhost:8088/models/x/x?mode=503', { inputs: 'x' }, undefined, { maxAttempts: 3, baseDelayMs: 100 })).rejects.toBeTruthy();
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(100);
});

test('honors Retry-After on 429', async () => {
  const start = Date.now();
  await expect(postWithRetry('http://localhost:8088/models/x/x?mode=429', { inputs: 'x' }, undefined, { maxAttempts: 2, baseDelayMs: 100 })).rejects.toBeTruthy();
  const elapsed = Date.now() - start;
  // Retry-After=3s set in mock server -> should wait at least ~3s on first retry
  expect(elapsed).toBeGreaterThanOrEqual(2000);
});
