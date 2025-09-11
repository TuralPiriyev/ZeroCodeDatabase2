/*
Database AI router (CommonJS .cjs)
*/
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

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

function safeLog() {
  console.log.apply(console, arguments);
}

// escapeRegExp used when building regexes from user input
function escapeRegExp(str) {
  if (!str) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function callOpenAIChat(messages, max_tokens = 800) {
  const key = (process.env.OPENAI_API_KEY || OPENAI_API_KEY || '').toString().trim();
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  // Basic sanity: no whitespace or control characters allowed in header value
  if (/\s/.test(key) || key.length > 500) {
    throw new Error('Invalid OPENAI_API_KEY format');
  }

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens,
      temperature: 0.2,
    }),
  });
  } catch (e) {
    safeLog('OpenAI fetch error (likely malformed header or network issue):', e && e.message ? e.message : String(e));
    throw e;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const j = await res.json();
  return j;
}

router.get('/health', (req, res) => {
  return res.json({ status: 'ok' });
});

async function handleDbQuery(req, res) {
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
    console.log('[AI_ROUTE] incoming', JSON.stringify(interesting));
  } catch (e) {}

  const { question, language = 'en', userId, contextSuggestions, _health_test } = req.body || {};

  if (process.env.NODE_ENV === 'development' || _health_test === true) {
    return res.json({ status: 'ok - backend route works' });
  }

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ answer: REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en });
  }

  // If the client supplied contextSuggestions, we no longer short-circuit by
  // echoing the question. The model will be allowed to generate a proper
  // database-focused answer (the SYSTEM_PROMPT prefers canned responses when
  // available, but the handler should not return the literal question back).

  try {
    const systemPrompt = `You are Database Assistant. Answer only with YES or NO and a one-line reason.`;
    const classifierMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Is the following question related to databases? Answer only with YES or NO and a one-line reason.\n\nQuestion: ${question}` },
    ];

    let classifierResp;
    try {
      const j = await callOpenAIChat(classifierMessages, 50);
      classifierResp = j.choices?.[0]?.message?.content || '';
    } catch (e) {
      safeLog('Classifier call failed: ', e.message || e.toString());
      if (e && /Invalid OPENAI_API_KEY format|Missing OPENAI_API_KEY/i.test(e.message)) {
        return res.status(500).json({ answer: 'Server misconfigured: invalid or missing OpenAI API key.' });
      }
      return res.status(503).json({ answer: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    const classifierText = (classifierResp || '').trim().toUpperCase();
    const isYes = classifierText.startsWith('YES');

    if (!isYes) {
      return res.json({ answer: REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en });
    }

  const SYSTEM_PROMPT = `You are "Database Assistant". RULES:
1) ONLY answer questions about databases: schema design, SQL queries, normalization, indexing, transactions, authentication tables, migrations, database best practices, OR database programming. If the user's question is NOT about databases, reply exactly with the rejection sentence in the user's language (the server will provide a mapping for languages). DO NOT answer anything else.
2) Do NOT repeat, paraphrase, or echo the user's question in your answer. Reply directly with the answer content only.
3) Always respond in the same language as the user's question. The server will provide the language code in the 'language' field. Use that language for all text, including error/rejection messages.
4) If the user's question exactly matches one of the 'contextSuggestions' passed by the client, prefer the canned localized response (client-provided).
5) When returning SQL examples, provide read-only examples and never attempt to access or run queries on the user's systems.
6) Keep answers concise and include code blocks for SQL where helpful. Do not provide unrelated commentary.`;

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      // explicit instruction to the model about language and not repeating the question
      { role: 'user', content: `Please answer the following question directly in the user's language (${language}). Do NOT repeat the question; provide a concise database-focused answer (SQL examples when relevant).\n\nQuestion: ${question}` },
    ];

    let answerText = '';
    try {
      const j = await callOpenAIChat(chatMessages, 800);
      answerText = j.choices?.[0]?.message?.content || '';
      // basic sanitization
      answerText = answerText.replace(/<[^>]*>/g, '');
      answerText = answerText.replace(/```(?:sql)?/gi, '```sql');

      // Post-process to remove accidental echo of the user's question.
      try {
        const q = (question || '').trim();
        let cleaned = answerText.trim();

        // If the assistant prefixed the question or repeated it verbatim, strip common patterns.
        const patterns = [
          `Question:\s*${escapeRegExp(q)}`,
          `Q:\s*${escapeRegExp(q)}`,
          `You asked:\s*${escapeRegExp(q)}`,
          `Вопрос:\s*${escapeRegExp(q)}`,
        ];

        for (const p of patterns) {
          const re = new RegExp('^' + p, 'i');
          cleaned = cleaned.replace(re, '').trim();
        }

        // If the entire assistant reply equals the question (case-insensitive), treat as empty.
        if (cleaned.replace(/\s+/g, ' ').toLowerCase() === q.replace(/\s+/g, ' ').toLowerCase()) {
          cleaned = '';
        }

        // If cleaned is empty, respond with a concise fallback rejection in user's language.
        if (!cleaned) {
          cleaned = REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en;
        }

        answerText = cleaned;
      } catch (e) {
        // ignore any cleaning errors and fall back to raw answer
      }
    } catch (e) {
      safeLog('Answer generation failed:', e.message || e.toString());
      if (e && /Invalid OPENAI_API_KEY format|Missing OPENAI_API_KEY/i.test(e.message)) {
        return res.status(500).json({ answer: 'Server misconfigured: invalid or missing OpenAI API key.' });
      }
      return res.status(503).json({ answer: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    return res.json({ answer: answerText });
  } catch (err) {
    safeLog('Unexpected error in /api/ai/dbquery:', err && err.message ? err.message : String(err));
    return res.status(503).json({ answer: SERVICE_UNAVAILABLE.en });
  }
}

router.post('/dbquery', express.json(), handleDbQuery);
router.handleDbQuery = handleDbQuery;
module.exports = router;
