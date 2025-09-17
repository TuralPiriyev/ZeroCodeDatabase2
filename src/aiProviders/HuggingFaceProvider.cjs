const fetch = require('node-fetch');
const AIProvider = require('./AIProvider.cjs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class HuggingFaceProvider extends AIProvider {
  constructor(opts = {}) {
    super({ name: 'huggingface' });
    this.apiKey = (opts.apiKey || process.env.HF_KEY || '').trim();
    this.model = opts.model || process.env.HF_MODEL || 'gpt2';
    this.timeoutMs = opts.timeoutMs || 30000;
    this.cache = new Map(); // simple in-memory cache
    this.cacheTtl = opts.cacheTtl || 60 * 1000; // 60s
  }

  _cacheKey(payload) {
    try { return JSON.stringify(payload); } catch (e) { return String(Date.now()); }
  }

  async _fetchWithRetries(url, opts, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeoutMs);
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const status = res.status;
          if ([429, 502, 503].includes(status) && attempt < maxAttempts) {
            const backoff = Math.pow(2, attempt) * 100 + Math.floor(Math.random()*100);
            await sleep(backoff);
            continue;
          }
          const err = new Error(`HF error ${status}: ${String(text).slice(0,200)}`);
          err.status = status;
          throw err;
        }
        const j = await res.json();
        return j;
      } catch (err) {
        if (attempt >= maxAttempts) throw err;
        const m = (err && err.message) ? String(err.message).toLowerCase() : '';
        if (/abort|timeout/.test(m)) {
          // retry
          const backoff = Math.pow(2, attempt) * 100 + Math.floor(Math.random()*100);
          await sleep(backoff);
          continue;
        }
        // For other network issues, retry
        const backoff = Math.pow(2, attempt) * 100 + Math.floor(Math.random()*100);
        await sleep(backoff);
      }
    }
  }

  async chat({ system, user, language, schema }) {
    if (!this.apiKey) throw new Error('Missing HF_KEY');

    const payload = { system, user, language, schema, model: this.model };
    const key = this._cacheKey(payload);
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.ts) < this.cacheTtl) {
      return cached.value;
    }

    // Hugging Face inference HTTP API - use text generation endpoint
    const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(this.model)}`;
    const body = { inputs: `${system}\n\n${user}`, parameters: { max_new_tokens: 512, temperature: 0.2 } };
    const opts = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    };

    const j = await this._fetchWithRetries(url, opts, 4);

    // HF returns an array of { generated_text } for text generation models
    let out = '';
    try {
      if (Array.isArray(j) && j.length > 0 && j[0].generated_text) {
        out = j[0].generated_text;
      } else if (j && j.generated_text) {
        out = j.generated_text;
      } else if (typeof j === 'string') {
        out = j;
      } else {
        out = JSON.stringify(j);
      }
    } catch (e) {
      out = String(j || '');
    }

    // cache
    try { this.cache.set(key, { ts: Date.now(), value: out }); } catch (e) {}

    return out;
  }
}

module.exports = HuggingFaceProvider;
