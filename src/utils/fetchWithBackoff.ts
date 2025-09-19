export async function fetchWithBackoff(url: string, opts: RequestInit = {}, maxRetries = 3, baseDelayMs = 500): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const controller = new AbortController();
      const timeout = (opts as any).timeoutMs || 30000;
      const id = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);

      if (res.status === 429) {
        return res; // let caller handle Retry-After
      }

      if (!res.ok && (res.status >= 500 && res.status < 600) && attempt < maxRetries) {
        attempt++;
        const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1));
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      attempt++;
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1));
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
