/*
SYSTEM_PROMPT (used exactly as a system message for model calls):
"""
You are "Database Assistant". RULES:
1) ONLY answer questions about databases: schema design, SQL queries, normalization, indexing, transactions, authentication tables, migrations, database best practices, OR database programming. If the user's question is NOT about databases, reply exactly with the rejection sentence in the user's language (the server will provide a mapping for languages). DO NOT answer anything else.
2) If the user's question exactly matches one of the contextSuggestions passed by the client, prefer the canned localized response (client-provided).
3) When returning SQL examples, provide read-only examples and never attempt to access or run queries on the user's systems.
4) Keep answers concise and include code blocks for SQL where helpful.
"""

/*
  Note to developer: store your OPENAI_API_KEY in environment variables or host secrets.
  Do NOT hardcode the key in source. The server reads it from process.env.OPENAI_API_KEY.
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

// Minimal sanitizer for logs
function safeLog() {
  console.log.apply(console, arguments);
}

async function callOpenAIChat(messages, max_tokens = 800) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const j = await res.json();
  return j;
}

// Lightweight health check for this router
router.get('/health', (req, res) => {
  return res.json({ status: 'ok' });
});

// Main endpoint logic exported so other servers (or a root POST) can re-use it
async function handleDbQuery(req, res) {
  // Lightweight debug logging to help diagnose 404 / proxy rewrite issues in production.
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

  // Dev-only health shortcut: allow quick verification without OpenAI calls
  if (process.env.NODE_ENV === 'development' || _health_test === true) {
    return res.json({ status: 'ok - backend route works' });
  }

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ answer: REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en });
  }

  // If contextSuggestions contains an exact match, prefer it
  if (Array.isArray(contextSuggestions) && contextSuggestions.includes(question)) {
    return res.json({ answer: question });
  }

  try {
    // Step 1: quick model classification (YES/NO)
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
      return res.status(503).json({ answer: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    const classifierText = (classifierResp || '').trim().toUpperCase();
    const isYes = classifierText.startsWith('YES');

    if (!isYes) {
      return res.json({ answer: REJECTION_MESSAGES[language] || REJECTION_MESSAGES.en });
    }

    // Step 2: generate the answer using SYSTEM_PROMPT rules
    const SYSTEM_PROMPT = `You are "Database Assistant". RULES:\n1) ONLY answer questions about databases: schema design, SQL queries, normalization, indexing, transactions, authentication tables, migrations, database best practices, OR database programming. If the user's question is NOT about databases, reply exactly with the rejection sentence in the user's language (the server will provide a mapping for languages). DO NOT answer anything else.\n2) If the user's question exactly matches one of the contextSuggestions passed by the client, prefer the canned localized response (client-provided).\n3) When returning SQL examples, provide read-only examples and never attempt to access or run queries on the user's systems.\n4) Keep answers concise and include code blocks for SQL where helpful.`;

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ];

    let answerText = '';
    try {
      const j = await callOpenAIChat(chatMessages, 800);
      answerText = j.choices?.[0]?.message?.content || '';
      // Ensure plain text and no HTML
      answerText = answerText.replace(/<[^>]*>/g, '');

      // Ensure SQL code blocks are fenced with ```sql
      answerText = answerText.replace(/```(?:sql)?/gi, '```sql');
    } catch (e) {
      safeLog('Answer generation failed:', e.message || e.toString());
      return res.status(503).json({ answer: SERVICE_UNAVAILABLE[language] || SERVICE_UNAVAILABLE.en });
    }

    return res.json({ answer: answerText });
  } catch (err) {
    safeLog('Unexpected error in /api/ai/dbquery:', err && err.message ? err.message : String(err));
    return res.status(503).json({ answer: SERVICE_UNAVAILABLE.en });
  }
}

// Main endpoint: POST /api/ai/dbquery
router.post('/dbquery', express.json(), handleDbQuery);

// Attach handler to router object so external code can forward to it
router.handleDbQuery = handleDbQuery;

// Export the router
module.exports = router;
