// src/utils/hf-retry/postWithRetry.ts
export type PostOpts = {
  method?: string;
  headers?: Record<string,string>;
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}

function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

export async function postWithRetry(url:string, body:any, token:string|undefined, opts:PostOpts = {}){
  const maxAttempts = opts.maxAttempts || 6;
  const baseDelay = opts.baseDelayMs || 500; // ms
  const perAttemptTimeout = opts.timeoutMs || 30000;

  for (let attempt=1; attempt<=maxAttempts; attempt++){
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), perAttemptTimeout);
    try{
      const headers: any = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
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
        // honor Retry-After header if present — wait at least that many seconds
        const ra = res.headers.get('Retry-After');
        if (ra) {
          const waitMs = (parseInt(ra, 10) || 1) * 1000;
          await sleep(waitMs);
          continue;
        }
        // deterministic exponential backoff (no full jitter) so tests can rely on minimum delays
        const waitMs = Math.min(baseDelay * (2 ** (attempt - 1)), 30000);
        await sleep(waitMs);
        continue;
      }

      const txt = await res.text().catch(()=>`HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }catch(err:any){
      clearTimeout(timeoutId);
      if (err && err.name === 'AbortError'){
        // treat abort as transient, retry
      }
      if (attempt === maxAttempts) throw err;
      // linear backoff for network errors
      await sleep(baseDelay * attempt + Math.random()*200);
    }
  }
  throw new Error('Unreachable');
}
