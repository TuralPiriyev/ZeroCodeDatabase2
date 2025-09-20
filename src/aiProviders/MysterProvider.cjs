const AIProvider = require('./AIProvider.cjs');
const { generateText } = require('../../server/utils/mysterClient');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class MysterProvider extends AIProvider {
  constructor(opts = {}) {
    super({ name: 'myster' });
    this.apiKey = (opts.apiKey || process.env.MYSTER_API_KEY || '').trim();
    this.model = opts.model || process.env.MYSTER_MODEL || 'gpt2';
    this.timeoutMs = opts.timeoutMs || 30000;
    this.cache = new Map();
    this.cacheTtl = opts.cacheTtl || 60 * 1000;
  }

  _cacheKey(payload) {
    try { return JSON.stringify(payload); } catch (e) { return String(Date.now()); }
  }

  async chat({ system, user, language, schema }) {
    if (!this.apiKey) throw new Error('Missing MYSTER_API_KEY');

    const payload = { system, user, language, schema, model: this.model };
    const key = this._cacheKey(payload);
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.ts) < this.cacheTtl) {
      return cached.value;
    }

    const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
    const j = await generateText({ model: this.model, messages, options: { temperature: 0.2, max_tokens: 512 } });

    let out = '';
    try {
      if (j && j.text) out = j.text;
      else if (j && j.raw) out = JSON.stringify(j.raw);
      else out = String(j || '');
    } catch (e) {
      out = String(j || '');
    }

    try { this.cache.set(key, { ts: Date.now(), value: out }); } catch (e) {}

    return out;
  }
}

module.exports = MysterProvider;
