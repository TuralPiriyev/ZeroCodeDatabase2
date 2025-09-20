// server/utils/mysterClient.js
const axios = require('axios');
const pkg = require('../../package.json');

const BASE = (process.env.MYSTER_API_BASE_URL || 'https://api.myster.example').replace(/\/+$/, '');
const KEY = (process.env.MYSTER_API_KEY || '').trim();

if (!KEY && process.env.NODE_ENV !== 'production') {
  console.warn('[mysterClient] MYSTER_API_KEY not set');
}

const axiosInstance = axios.create({
  baseURL: BASE,
  timeout: Number(process.env.MYSTER_API_TIMEOUT_MS || 30000),
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': `zero-db/${pkg.version}`,
    ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
  },
  validateStatus: null,
});

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function retry(fn, retries = 3, baseDelay = 500) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

async function generateText({ model, messages, inputs, options = {} } = {}) {
  if (!messages && !inputs) throw new Error('generateText requires messages or inputs');

  const payload = {};
  if (messages) {
    payload.type = 'chat';
    payload.messages = messages;
  } else {
    payload.type = 'text';
    payload.input = inputs;
  }
  if (model) payload.model = model;
  if (options) payload.options = options;

  const res = await retry(() => axiosInstance.post('/v1/generate', payload), Number(process.env.MYSTER_API_RETRIES || 3));
  if (!res) throw new Error('No response from Myster API');

  if (res.status >= 500) {
    const err = new Error(`Myster upstream error ${res.status}`);
    err.status = res.status;
    err.body = res.data;
    throw err;
  }

  const data = res.data || {};

  return {
    raw: data,
    text: data.output?.[0]?.content || data.text || (Array.isArray(data.outputs) ? data.outputs.join('\n') : undefined),
    meta: data.meta || {},
    status: res.status,
  };
}

module.exports = {
  generateText,
  axiosInstance,
};
