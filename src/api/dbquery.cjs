/*
Database AI router (CommonJS .cjs)
Myster-only implementation — sends all model calls to Myster via server-side util callMysterAPI.
*/
const express = require('express');
const router = express.Router();
const { callMysterAPI } = require('../../server/utils/callMysterAPI');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

require('dotenv').config();

const MODEL = (process.env.MYSTER_MODEL || '').trim();
const OWNER = (process.env.MYSTER_OWNER || '').trim();
const MYSTER_KEY = (process.env.MYSTER_API_KEY || '').trim();

const REJECTION_MESSAGES = {
  en: "I only answer questions related to databases (SQL and database programming).",
  az: "Mən yalnız verilənlər bazası (SQL və verilənlər bazası proqramlaşdırması) ilə bağlı suallara cavab verirəm.",
  tr: "Sadece veritabanı (SQL ve veritabanı programlama) ile ilgili soruları cevaplıyorum.",
  ru: "Я отвечаю только на вопросы, связанные с базами данных (SQL и программированием баз данных).",
};

const SERVICE_UNAVAILABLE = {
  en: "Service temporarily unavailable. Try again later.",
  az: "Xidmət müvəqqəti əlçatan deyil. Sonra yenidən cəhd edin.",
};

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_HANDLER_TIMEOUT_MS || 60000);

// util logging & errors
function logError(error_id, err, route) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'api-dbquery',
      route: route || '/api/dbquery',
      error_id,
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined
    };
    console.error(JSON.stringify(payload));
  } catch (e) {
    console.error('[LOG_ERROR] failed to log error', e && e.message ? e.message : e);
  }
}

function sendError(res, status, message, err, route) {
  const error_id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : uuidv4();
  logError(error_id, err || { message }, route);
  return res.status(status).json({ error_id, message });
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
  ]).finally(() => clearTimeout(timer));
}

function safeLog() {
  console.log.apply(console, arguments);
}

function escapeRegExp(str) {
  if (!str) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEnvVal(v) {
  if (!v) return '';
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function looksDestructive(sql) {
  if (!sql) return false;
  const s = String(sql).toLowerCase();
  if (/\b(drop|delete|truncate|alter|create|update|insert|replace)\b/.test(s)) return true;
  if (s.split(';').filter(Boolean).length > 1) return true;
  return false;
}

router.get('/health', (req, res) => {
  return res.json({ status: 'ok', provider: (MYSTER_KEY ? 'myster' : 'none') });
});

async function callMysterWrapped(messages, max_tokens = 800) {
  // Build path for Myster model endpoint
  const owner = normalizeEnvVal(process.env.MYSTER_OWNER || OWNER);
  const model = normalizeEnvVal(process.env.MYSTER_MODEL || MODEL);
  if (!owner || !model) {
    const e = new Error('MYSTER_OWNER or MYSTER_MODEL not configured');
    e.isBadKey = true;
    throw e;
  }

  // Myster util expects a payload object: { path, method, body, timeoutMs }
  // body shape: adapt messages into provider-expected format. We'll send { inputs: messages, parameters: {...} }
  const path = `/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/chat`;// chat path example
  const body = { inputs: messages, parameters: { max_tokens: Number(max_tokens || 800) } };

  // call the util which handles base URL, auth, retries, timeout, etc.
  const resp = await callMysterAPI({ path, method: 'POST', body, timeoutMs: Number(process.env.AI_HANDLER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS) });

  // provider may return multiple shapes. Normalize to an object we can read.
  // Prefer resp.body, resp.choices, resp.data, resp.text, resp[0].generated_text, or resp
  try {
    if (!resp) return { text: '' };
    if (resp.body) return resp.body;
    if (resp.choices) return resp;
    if (resp.data) return resp;
    if (typeof resp === 'string') return { text: resp };
    if (Array.isArray(resp) && resp[0] && resp[0].generated_text) return { text: resp[0].generated_text };
    return resp;
  } catch (e) {
    return { text: '' };
  }
}

async function handleDbQuery(req, res) {
  try {
    // debug info
    try {
      const hdr = req.headers || {};
      const interesting = {
        method: req.method,
        path: req.originalUrl || req.url,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        proxyHeaders: {
          'x-original-url': hdr['x-original-url'],
          'x-original-uri': hdr['x-original-uri'],
          'x-forwarded-url': hdr['x-forwarded-url'],
          'x-rewrite-url': hdr['x-rewrite-url'],
          'x-request-uri': hdr['x-request-uri'],
          'x-forwarded-uri': hdr['x-forwarded-uri'],
        }
      };
      safeLog('[AI_ROUTE] incoming', JSON.stringify(interesting));
    } catch (e) {}

    const { question, language = 'en', userId, contextSuggestions, _health_test } = req.body || {};

    if (process.env.NODE_ENV === 'development' || _health_test === true) {
      return res.json({ status: 'ok - backend route works' });
    }

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: "Missing required field 'question'." });
    }

    // Validate Myster config early and return clear error if missing/malformed
    const normalizedKey = normalizeEnvVal(process.env.MYSTER_API_KEY || MYSTER_KEY);
    if (!normalizedKey) {
      safeLog('[AI_ROUTE] Missing or malformed MYSTER_API_KEY');
      return sendError(res, 500, 'Server misconfiguration: MYSTER_API_KEY not set or malformed', new Error('MYSTER_API_KEY missing or malformed'));
    }
    const owner = normalizeEnvVal(process.env.MYSTER_OWNER || OWNER);
    const model = normalizeEnvVal(process.env.MYSTER_MODEL || MODEL);
    if (!owner || !model) {
      safeLog('[AI_ROUTE] Missing MYSTER_OWNER or MYSTER_MODEL');
      return sendError(res, 500, 'Server misconfiguration: MYSTER_OWNER or MYSTER_MODEL not configured', new Error('MYSTER config missing'));
    }

    // Basic safety: block destructive queries
    const qLower = question.toLowerCase();
    if (/\b(drop|delete|truncate|alter|insert|update|create|replace)\b/.test(qLower) || qLower.split(';').filter(Boolean).length > 1) {
      return res.status(400).json({ error: 'Please ask read-only database questions. Destructive operations are not allowed.' });
    }

    // Step 1: quick model classification (YES/NO)
    const systemPrompt = `You are Database Assistant. Answer only with YES or NO and a one-line reason.`;
    const classifierMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Is the following question related to databases? Answer only with YES or NO and a one-line reason.\n\nQuestion: ${question}` },
    ];

    let classifierRespText = '';
    try {
      const classifierResp = await withTimeout(callMysterWrapped(classifierMessages, 50), DEFAULT_TIMEOUT_MS);
      // try several possible shapes
      classifierRespText =
        classifierResp?.choices?.[0]?.message?.content ||
        classifierResp?.choices?.[0]?.text ||
        classifierResp?.data?.[0]?.generated_text ||
        classifierResp?.text ||
        (typeof classifierResp === 'string' ? classifierResp : '') || '';
    } catch (e) {
      safeLog('Classifier call failed: ', e && e.message ? e.message : String(e));
      if (e.isBadKey) {
        return sendError(res, 500, 'MYSTER_API_KEY appears malformed. Please update environment variable without quotes/newlines.', e);
      }
      if (e.status === 429 || /quota/i.test(String(e.message))) {
        return res.status(429).json({ error: 'Myster quota or rate limit exceeded. Please check billing/usage.' });
      }
      return res.status(503).json({ answer: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    const classifierText = (classifierRespText || '').trim().toUpperCase();
    const isYes = classifierText.startsWith('YES');

    if (!isYes) {
      return res.json({ answer: REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en });
    }

    // Step 2: main chat generation using SYSTEM_PROMPT rules
    const SYSTEM_PROMPT = `You are "Database Assistant". RULES:
1) ONLY answer questions about databases: schema design, SQL queries, normalization, indexing, transactions, authentication tables, migrations, database best practices, OR database programming. If the user's question is NOT about databases, reply exactly with the rejection sentence in the user's language (the server will provide a mapping for languages). DO NOT answer anything else.
2) Do NOT repeat, paraphrase, or echo the user's question in your answer. Reply directly with the answer content only.
3) Always respond in the same language as the user's question. The server will provide the language code in the 'language' field. Use that language for all text, including error/rejection messages.
4) If the user's question exactly matches one of the 'contextSuggestions' passed by the client, prefer the canned localized response (client-provided).
5) When returning SQL examples, provide read-only examples and never attempt to access or run queries on the user's systems.
6) Keep answers concise and include code blocks for SQL where helpful. Do not provide unrelated commentary.`;

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Please answer the following question directly in the user's language (${language}). Do NOT repeat the question; provide a concise database-focused answer (SQL examples when relevant).\n\nQuestion: ${question}` },
    ];

    let answerText = '';
    try {
      const resp = await withTimeout(callMysterWrapped(chatMessages, 800), DEFAULT_TIMEOUT_MS);

      // Extract textual content from many provider shapes
      let rawText =
        resp?.choices?.[0]?.message?.content ||
        resp?.choices?.[0]?.text ||
        resp?.data?.[0]?.generated_text ||
        resp?.text ||
        (typeof resp === 'string' ? resp : '') || '';

      rawText = String(rawText);

      // basic sanitization
      answerText = rawText.replace(/<[^>]*>/g, '');
      answerText = answerText.replace(/```(?:sql)?/gi, '```sql');

      // Post-process to remove accidental echo of the user's question.
      try {
        const q = (question || '').trim();
        let cleaned = answerText.trim();

        const patterns = [
          `Question:\\s*${escapeRegExp(q)}`,
          `Q:\\s*${escapeRegExp(q)}`,
          `You asked:\\s*${escapeRegExp(q)}`,
          `Вопрос:\\s*${escapeRegExp(q)}`,
        ];

        for (const p of patterns) {
          const re = new RegExp('^' + p, 'i');
          cleaned = cleaned.replace(re, '').trim();
        }

        if (cleaned.replace(/\s+/g, ' ').toLowerCase() === q.replace(/\s+/g, ' ').toLowerCase()) {
          cleaned = '';
        }

        if (!cleaned) {
          cleaned = REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en;
        }

        answerText = cleaned;
      } catch (e) {
        // ignore any cleaning errors and fall back to raw answer
      }
    } catch (e) {
      safeLog('Answer generation failed:', e && e.message ? e.message : String(e));
      if (e.isBadKey) {
        return sendError(res, 500, 'MYSTER_API_KEY appears malformed. Please update environment variable without quotes/newlines.', e);
      }
      if (e.status === 429 || /quota/i.test(String(e.message))) {
        return res.status(429).json({ error: 'Myster quota or rate limit exceeded. Please check billing/usage.' });
      }
      return res.status(503).json({ answer: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    return res.json({ answer: answerText });
  } catch (err) {
    return sendError(res, 500, 'Internal server error', err, '/api/dbquery');
  }
}

// CORS preflight support for browser clients
router.options('/dbquery', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.sendStatus(204);
});

router.post('/dbquery', express.json({ limit: '10mb' }), handleDbQuery);
router.handleDbQuery = handleDbQuery;
module.exports = router;
