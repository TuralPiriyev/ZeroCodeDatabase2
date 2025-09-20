// server/utils/hfClient.js
const axios = require('axios');
const http = require('http');
const https = require('https');
const opossum = require('opossum');

function createClient({ baseURL, token, timeout = 30000 }){
  const instance = axios.create({
    baseURL,
    timeout,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 60000 }),
    httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 60000 }),
  });

  // simple retry interceptor for 429/503
  instance.interceptors.response.use(undefined, async (err) => {
    const status = err.response && err.response.status;
    const config = err.config || {};
    config.__retryCount = config.__retryCount || 0;
    if (status === 429 || status === 503) {
      if (config.__retryCount >= 4) return Promise.reject(err);
      config.__retryCount += 1;
      const ra = err.response.headers && (err.response.headers['retry-after'] || err.response.headers['Retry-After']);
      let waitMs = ra ? (parseInt(ra) * 1000) : Math.min(500 * (2 ** config.__retryCount), 30000);
      // full jitter
      waitMs = Math.random() * waitMs;
      await new Promise(r => setTimeout(r, waitMs));
      return instance(config);
    }
    return Promise.reject(err);
  });

  return instance;
}

// circuit breaker wrapper
function breakerWrap(fn, opts = {}){
  const breaker = new opossum(fn, Object.assign({ timeout: 10000, errorThresholdPercentage: 50, resetTimeout: 30000 }, opts));
  breaker.fallback(() => ({ error: 'service_unavailable' }));
  breaker.on('open', () => console.warn('[CB] Circuit opened'));
  breaker.on('halfOpen', () => console.warn('[CB] Circuit half-open'));
  breaker.on('close', () => console.warn('[CB] Circuit closed'));
  return breaker;
}

module.exports = { createClient, breakerWrap };
