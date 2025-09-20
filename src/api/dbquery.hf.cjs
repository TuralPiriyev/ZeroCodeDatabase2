/*
  HF-backed AI router. This router is provider-agnostic and will use
  Hugging Face if HF_KEY is configured. It returns structured JSON when possible:
  { sql: string, params: object, explanation: string, language: string }
*/
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const HuggingFaceProvider = require('../aiProviders/HuggingFaceProvider.cjs');
const MysterProvider = require('../aiProviders/MysterProvider.cjs');
const AIProvider = require('../aiProviders/AIProvider.cjs');

require('dotenv').config();

const MYSTER_KEY = (process.env.MYSTER_API_KEY || '').trim();
const MYSTER_MODEL = process.env.MYSTER_MODEL || process.env.HF_MODEL || 'gpt2';
const HF_KEY = (process.env.HF_KEY || '').trim();
const HF_MODEL = process.env.HF_MODEL || 'gpt2';

// 30s timeout, 60s cache
const myster = MYSTER_KEY ? new MysterProvider({ apiKey: MYSTER_KEY, model: MYSTER_MODEL, timeoutMs: 30000, cacheTtl: 60*1000 }) : null;
const hf = HF_KEY ? new HuggingFaceProvider({ apiKey: HF_KEY, model: HF_MODEL, timeoutMs: 30000, cacheTtl: 60*1000 }) : null;

const RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60*1000;
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX) || 30;
// Token-bucket based limiter: allows short bursts while enforcing sustained rate.
const TOKEN_BUCKET_CAPACITY = Number(process.env.AI_TOKEN_BUCKET_CAPACITY) || 10; // tokens
const TOKEN_REFILL_PER_SEC = Number(process.env.AI_TOKEN_REFILL_PER_SEC) || (RATE_LIMIT_MAX / (RATE_LIMIT_WINDOW_MS / 1000));
// Map key -> { tokens: number, lastRefill: epoch_ms }
const tokenBuckets = new Map();

function getBucketKey(req) {
  // Prefer authenticated userId if present, otherwise IP address
  const uid = (req.body && req.body.userId) || (req.userId);
  if (uid) return `uid:${String(uid)}`;
  // fallback to remote IP
  return `ip:${req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'}`;
}

function aiTokenBucketLimiter(req, res, next) {
  try {
    const key = getBucketKey(req);
    const now = Date.now();
    let bucket = tokenBuckets.get(key);
    if (!bucket) {
      bucket = { tokens: TOKEN_BUCKET_CAPACITY, lastRefill: now };
      tokenBuckets.set(key, bucket);
    }

    // refill
    const elapsedMs = Math.max(0, now - bucket.lastRefill);
    const refillTokens = elapsedMs / 1000 * TOKEN_REFILL_PER_SEC;
    if (refillTokens > 0) {
      bucket.tokens = Math.min(TOKEN_BUCKET_CAPACITY, bucket.tokens + refillTokens);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return next();
    }

    // Not enough tokens: compute time until next token (sec)
    const missing = 1 - bucket.tokens;
    const retryAfterSec = Math.ceil(missing / TOKEN_REFILL_PER_SEC) || 1;
    const keySample = key;
    console.warn('[HF_ROUTE] token-bucket rate limit exceeded', { key: keySample, ip: req.ip, userId: req.body && req.body.userId });
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.` });
  } catch (e) {
    console.error('[HF_ROUTE] rate limiter error', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Rate limiter error' });
  }
}

const REJECTION_MESSAGES = {
  en: "I only answer questions related to databases (SQL and database programming).",
  az: "Mən yalnız verilənlər bazası (SQL və verilənlər bazası proqramlaşdırması) ilə bağlı suallara cavab verirəm.",
  tr: "Sadece veritabanı (SQL ve veritabanı programlama) ile ilgili soruları cevaplıyorum.",
  ru: "Я отвечаю только на вопросы, связанные с базами данных (SQL и программированием баз данных).",
};

const SERVICE_UNAVAILABLE = { en: 'Service temporarily unavailable. Try again later.', az: 'Xidmət müvəqqəti əlçatan deyil. Sonra yenidən cəhd edin.' };

function safeLog() { console.log.apply(console, arguments); }

function looksDestructive(sql) {
  if (!sql) return false;
  const s = String(sql).toLowerCase();
  // Simple heuristics: DDL/DML that modifies schema or deletes data
  return /\b(drop|delete|truncate|alter|create|update|insert|replace)\b/.test(s);
}

router.get('/health', (req, res) => res.json({ status: 'ok', provider: MYSTER_KEY ? 'myster' : (HF_KEY ? 'huggingface' : 'none') }));

async function handleDbQuery(req, res) {
  try {
    const { question, language = 'en', userId, contextSuggestions, schema } = req.body || {};

    if (process.env.NODE_ENV === 'development' && req.body && req.body._health_test) {
      return res.json({ status: 'ok - hf router' });
    }

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en });
    }

    // Basic safety: avoid destructive SQL generation
    const lowerQ = question.toLowerCase();
    if (/delete|drop|truncate|alter|insert|update|create/.test(lowerQ)) {
      return res.status(400).json({ error: 'Please ask read-only database questions. Destructive operations are not allowed.' });
    }

    // Build system prompt per existing rules (concise DB assistant)
    const system = `You are \"Database Assistant\". RULES:\n1) ONLY answer questions about databases: schema design, SQL queries, normalization, indexing, transactions, authentication tables, migrations, database best practices, OR database programming. If the user's question is NOT about databases, reply exactly with the rejection sentence in the user's language. DO NOT answer anything else.\n2) For SQL responses, return a JSON object EXACTLY with keys: sql, params, explanation, language. sql should be a read-only SELECT statement or explanatory empty string if not applicable. params should be an object mapping parameter names to example values. explanation should be a short, user-friendly explanation in the user's language. language should be the language code.`;

    const user = `Language: ${language}\nSchema: ${schema ? JSON.stringify(schema) : 'none'}\nQuestion: ${question}\nReturn JSON only.`;

    // Prefer Myster provider if configured, otherwise HF
    const provider = myster || hf;
    if (!provider) {
      return res.status(503).json({ error: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    let raw;
    try {
      raw = await provider.chat({ system, user, language, schema });
    } catch (e) {
      safeLog('[HF_ROUTE] provider error', e && e.message ? e.message : e);
      return res.status(503).json({ error: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    // Attempt to extract JSON from provider output
    let extracted = '';
    try {
      // look for a JSON block in raw
      const js = String(raw);
      const jsonMatch = js.match(/\{[\s\S]*\}/m);
      if (jsonMatch) extracted = jsonMatch[0]; else extracted = js;
    } catch (e) { extracted = String(raw); }

    let parsed = null;
    try { parsed = JSON.parse(extracted); } catch (e) { parsed = null; }

    // If parsed and safe, validate shape
    if (parsed && typeof parsed === 'object') {
      const sql = (parsed.sql || '').toString();
      const params = parsed.params || {};
      const explanation = (parsed.explanation || '').toString();
      const lang = parsed.language || language;

      if (looksDestructive(sql)) {
        return res.status(400).json({ error: 'Generated SQL looks destructive. Aborting.' });
      }

      return res.json({ answer: { sql, params, explanation, language: lang } });
    }

    // Fallback: return raw text as explanation
    const fallbackExplanation = String(raw || '').slice(0, 2000);
    return res.json({ answer: { sql: '', params: {}, explanation: fallbackExplanation, language } });
  } catch (err) {
    safeLog('[HF_ROUTE] unexpected error', err && err.message ? err.message : err);
    return res.status(503).json({ error: SERVICE_UNAVAILABLE.en });
  }
}

router.post('/dbquery', aiTokenBucketLimiter, express.json(), handleDbQuery);
router.handleDbQuery = handleDbQuery;
module.exports = router;
