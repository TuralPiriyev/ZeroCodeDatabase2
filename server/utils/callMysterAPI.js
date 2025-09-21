const axios = require('axios');
const qs = require('querystring');
const crypto = require('crypto');

/**
 * callMysterAPI(options)
 * - options: {
 *     path: string (required) - path suffix on MYSTER_API_BASE_URL, or full URL
 *     method: 'GET'|'POST' (default: 'POST')
 *     body: object | string
 *     headers: object
 *     timeoutMs: number (request-level timeout)
 *     maxRetries: number
 *     retryDelayBaseMs: number
 *   }
 *
 * Returns: { status, headers, body }
 * Throws: Error with .status, .error_id and .details on failures
 */

function ensureBaseUrl() {
  const base = (process.env.MYSTER_API_BASE_URL || '').trim();
  if (!base) return null;
  return base.replace(/\/+$/, '');
}

function ensureKey() {
  const k = (process.env.MYSTER_API_KEY || '').trim();
  if (!k) return null;
  if (/\s/.test(k)) return null;
  return k;
}

function makeError(message, status) {
  const err = new Error(message);
  if (status) err.status = status;
  err.error_id = (crypto.randomUUID) ? crypto.randomUUID() : require('uuid').v4();
  return err;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callMysterAPI(opts = {}) {
  const base = ensureBaseUrl();
  const key = ensureKey();
  if (!base) throw makeError('MYSTER_API_BASE_URL not configured', 500);
  if (!key) throw makeError('MYSTER_API_KEY not configured', 500);

  const path = opts.path || '/';
  const method = (opts.method || 'POST').toUpperCase();
  const maxRetries = Number(opts.maxRetries || process.env.MYSTER_MAX_RETRIES || 3);
  const retryBase = Number(opts.retryDelayBaseMs || 200);
  const timeoutMs = Number(opts.timeoutMs || process.env.MYSTER_REQUEST_TIMEOUT_MS || 30000);

  // Build URL: if path already looks like a full URL, use it; otherwise join with base
  let url;
  if (/^https?:\/\//i.test(path)) {
    url = path;
  } else {
    url = base + (path.startsWith('/') ? path : ('/' + path));
  }

  const headers = Object.assign({}, opts.headers || {});
  headers['Authorization'] = headers['Authorization'] || `Bearer ${key}`;
  if (!headers['Content-Type'] && method === 'POST') headers['Content-Type'] = 'application/json';
  headers['User-Agent'] = headers['User-Agent'] || `myster-client/1 project-proxy`;

  let attempt = 0;
  let lastErr;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const axiosConfig = {
        url,
        method,
        headers,
        data: (typeof opts.body === 'object' && headers['Content-Type'] && headers['Content-Type'].includes('application/json')) ? JSON.stringify(opts.body) : opts.body,
        responseType: 'json',
        signal: controller.signal,
        validateStatus: () => true,
      };

      const resp = await axios(axiosConfig);
      clearTimeout(timer);

      // If upstream sent Retry-After, parse and use it for backoff on 429/503
      const retryAfter = parseRetryAfterSeconds(resp.headers && resp.headers['retry-after']);

      // Success statuses
      if (resp.status >= 200 && resp.status < 300) {
        return { status: resp.status, headers: resp.headers || {}, body: resp.data };
      }

      // Terminal client errors (4xx except 429) -> surface to caller with details
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        const err = makeError(`Upstream client error ${resp.status}`, resp.status);
        err.details = resp.data;
        // Attach raw body text for easier diagnostics when JSON parsing fails
        try {
          err.bodyText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        } catch (e) {
          err.bodyText = String(resp.data);
        }
        throw err;
      }

      // 429 or 5xx -> retryable
      if (resp.status === 429 || resp.status >= 500) {
        lastErr = makeError(`Upstream retryable error ${resp.status}`, resp.status);
        lastErr.details = resp.data;
        const when = retryAfter != null ? retryAfter * 1000 : (retryBase * Math.pow(2, attempt - 1));
        // Respect maximum backoff cap 60s
        const delay = Math.min(when, 60000);
        if (attempt > maxRetries) break;
        await sleep(delay);
        continue;
      }

  // Other statuses -> treat as error and include body for diagnostics
  const errOther = makeError(`Unexpected upstream status ${resp.status}`, resp.status);
  errOther.details = resp.data;
  try { errOther.bodyText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data); } catch (e) { errOther.bodyText = String(resp.data); }
  throw errOther;

    } catch (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') {
        lastErr = makeError('request_timeout', 504);
        lastErr.details = 'timeout';
      } else if (e && e.isAxiosError && e.code) {
        lastErr = makeError(`axios_error_${e.code}`, 502);
        lastErr.details = e.message;
      } else {
        lastErr = e;
      }

      // For abort/timeouts and network errors, decide retry
      const isRetryable = (!lastErr.status || lastErr.status >= 500 || lastErr.status === 429 || lastErr.message === 'request_timeout');
      attempt = attempt; // no-op to allow debugging
      if (!isRetryable) {
        throw lastErr;
      }
      if (attempt > maxRetries) break;
      const backoff = Math.min(retryBase * Math.pow(2, attempt - 1), 60000);
      await sleep(backoff);
      continue;
    }
  }

  // If we reach here, we exhausted retries
  const finalErr = makeError('upstream_unavailable', 502);
  finalErr.details = (lastErr && (lastErr.details || lastErr.message)) || lastErr;
  throw finalErr;
}

function parseRetryAfterSeconds(val) {
  if (!val) return null;
  const v = String(val).trim();
  const num = Number(v);
  if (!isNaN(num)) return Math.max(0, Math.floor(num));
  // Try parse date
  const d = Date.parse(v);
  if (!isNaN(d)) {
    const secs = Math.floor((d - Date.now()) / 1000);
    return Math.max(0, secs);
  }
  return null;
}

module.exports = { callMysterAPI };
