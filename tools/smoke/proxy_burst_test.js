const fetch = require('node-fetch');

async function runBurst({ url, count = 30, concurrency = 6 }) {
  console.log('Running burst test', { url, count, concurrency });
  let idx = 0;
  let results = { 200: 0, 429: 0, other: 0 };

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= count) return;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'List users', language: 'en' })
        });
        if (res.status === 200) results[200]++;
        else if (res.status === 429) results[429]++;
        else results.other++;
        console.log(i, '->', res.status);
      } catch (e) {
        results.other++;
        console.log(i, '-> error', e && e.message ? e.message : e);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  console.log('Results:', results);
}

const url = process.argv[2] || 'http://localhost:5000/api/proxy/dbquery';
runBurst({ url, count: 40, concurrency: 8 }).catch(err => { console.error(err); process.exit(1); });
