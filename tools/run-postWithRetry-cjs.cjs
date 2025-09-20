const express = require('express');

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function postWithRetry(url, body, token, opts = {}){
  const maxAttempts = opts.maxAttempts || 6;
  const baseDelay = opts.baseDelayMs || 500;
  const perAttemptTimeout = opts.timeoutMs || 30000;

  for (let attempt=1; attempt<=maxAttempts; attempt++){
    let timedOut = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>{ timedOut = true; controller.abort(); }, perAttemptTimeout);
    try{
      const headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method: opts.method || 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok){
        const j = await res.json().catch(()=>null);
        return { status: res.status, body: j };
      }
      if (res.status === 429 || res.status === 503){
        const ra = res.headers.get('Retry-After');
        if (ra) {
          const waitMs = (parseInt(ra,10) || 1) * 1000;
          await sleep(waitMs);
          continue;
        }
        const waitMs = Math.min(baseDelay * (2 ** (attempt - 1)), 30000);
        await sleep(waitMs);
        continue;
      }
      const txt = await res.text().catch(()=>`HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }catch(err){
      clearTimeout(timeoutId);
      if (timedOut) {
        // treat as transient
      }
      if (attempt === maxAttempts) throw err;
      await sleep(baseDelay * attempt);
    }
  }
  throw new Error('Unreachable');
}

// --- setup mock server ---
const app = express();
app.use(express.json());
app.post('/models/:owner/:model', async (req, res) => {
  const mode = req.query.mode || 'ok';
  if (mode === 'ok') return res.json({ generated_text: 'ok' });
  if (mode === 'slow') { await new Promise(r=>setTimeout(r,5000)); return res.json({ generated_text:'slow' }); }
  if (mode === '503') return res.status(503).send({ error: 'Service temporarily unavailable' });
  if (mode === '429') { res.setHeader('Retry-After','3'); return res.status(429).send({ error: 'Rate limited' }); }
  return res.status(500).send({ error: 'unknown mode' });
});

async function run(){
  const server = app.listen(8088, ()=>console.log('mock server started on 8088'));
  try{
    console.log('Test1: success on 200');
    const r1 = await postWithRetry('http://localhost:8088/models/x/x?mode=ok', { inputs: 'x' }, undefined, { maxAttempts:3, baseDelayMs:100 });
    console.log('Test1', r1.status);

    console.log('Test2: 503 retries and throws');
    const start = Date.now();
    try{
      await postWithRetry('http://localhost:8088/models/x/x?mode=503', { inputs: 'x' }, undefined, { maxAttempts:3, baseDelayMs:100 });
      console.log('Unexpected success');
    } catch(e){
      console.log('Test2 elapsed', Date.now()-start);
    }

    console.log('Test3: 429 Retry-After honored');
    const start2 = Date.now();
    try{
      await postWithRetry('http://localhost:8088/models/x/x?mode=429', { inputs: 'x' }, undefined, { maxAttempts:2, baseDelayMs:100 });
      console.log('Unexpected success 429');
    } catch(e){
      console.log('Test3 elapsed', Date.now()-start2);
    }
  } finally{
    server.close(()=>console.log('mock server stopped'));
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
