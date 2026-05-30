// server.cjs - Complete Express + Socket.IO + MongoDB server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Load environment variables as early as possible so modules that read process.env work correctly
dotenv.config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const axios = require('axios');
const cron = require('node-cron');
const cookieParser = require('cookie-parser');
const cpsAdapter = require('./server/cpsAdapter.cjs');
// Authentication helpers (OTP, token utilities)
let generateOTP, hashOTP, generateTempToken, verifyTempToken, verifyOTP;
try {
  const authUtils = require('./src/utils/authUtils.cjs');
  generateOTP = authUtils.generateOTP;
  hashOTP = authUtils.hashOTP;
  generateTempToken = authUtils.generateTempToken;
  verifyTempToken = authUtils.verifyTempToken;
  verifyOTP = authUtils.verifyOTP;
} catch (e) {
  console.warn('authUtils helpers not available:', e && e.message ? e.message : e);
}
// Load environment variables
dotenv.config();

// Models & middleware
const User = require('./src/models/User.cjs');
const Workspace = require('./src/models/Workspace.cjs');
const { authenticate } = require('./src/middleware/auth.cjs');
const portfolioRoutes = require('./src/routes/portfolioRoutes.cjs');
const workspaceRoutes = require('./src/routes/workspaceRoutes.cjs');
const schemaRoutes = require('./src/routes/schemaRoutes.cjs');
const Invitation = require('./src/models/Invitation.cjs');
const Member = require('./src/models/Member.cjs');
const Subscription = require('./src/models/Subscription.cjs');

// Yjs manager (production helper)
const yjsManager = require('./server/yjsManager.cjs');

// Try to require AI handler (if present) so we can mount at known paths
let aiHandler = null;
try {
  const aiRouter = require('./src/api/dbquery.cjs');
  aiHandler = aiRouter.handleDbQuery || null;
  console.log('AI handler loaded for potential root mount');
} catch (e) {
  console.warn('AI handler not available for root mount:', e && e.message ? e.message : e);
}
// NOTE: mounting the router requires `app` to exist. We defer mounting until
// after Express app is created below (see deferred mount further down).

// Configuration
const PORT = Number(process.env.PORT) || 5000;
// Allow override of host binding (Render requires 0.0.0.0)
const HOST = process.env.HOST || '0.0.0.0';
const MONGO_URL = process.env.MONGO_URL;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SMTP_PORT = Number(process.env.SMTP_PORT);
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_PLAN_PRO_ID = process.env.PAYPAL_PLAN_PRO_ID;
const PAYPAL_PLAN_ULTIMATE_ID = process.env.PAYPAL_PLAN_ULTIMATE_ID;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const DISABLE_EMAIL_VERIFICATION = String(process.env.DISABLE_EMAIL_VERIFICATION || 'true').toLowerCase() !== 'false';

// Ensure OTP secret is present. In production, require it. In development, auto-generate a temporary one and log a warning.
if (!process.env.OTP_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: OTP_SECRET is not set in environment. Aborting start to avoid insecure defaults.');
    process.exit(1);
  } else {
    // Generate a temporary OTP secret to allow local/dev runs
    const tempSecret = crypto.randomBytes(32).toString('hex');
    process.env.OTP_SECRET = tempSecret;
    console.warn('OTP_SECRET not found in environment. Using a generated temporary OTP_SECRET for development. Set OTP_SECRET in production.');
  }
}

// Express setup
const app = express();
// When behind proxies (Render, Cloudflare), trust proxy to get correct remote addresses and protocol
app.set('trust proxy', true);
const server = http.createServer(app);

// TEMPORARY DEBUG ROUTE (opt-in)
// Set FORCE_AI_DEBUG=true in the environment to enable this short-circuit
if (process.env.FORCE_AI_DEBUG === 'true') {
  app.post('/api/ai/dbquery', express.json(), (req, res) => {
    try {
      console.log('[TEMP_AI_DEBUG] incoming request to /api/ai/dbquery', {
        path: req.path,
        originalUrl: req.originalUrl,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        headersSample: {
          host: req.headers.host,
          origin: req.headers.origin,
          'x-original-url': req.headers['x-original-url'],
          'x-forwarded-uri': req.headers['x-forwarded-uri']
        }
      });
    } catch (e) { console.warn('[TEMP_AI_DEBUG] log error', e && e.message ? e.message : e); }
    return res.json({ debug: 'TEMP_AI_DEBUG_ROUTE', ok: true, timestamp: new Date().toISOString() });
  });
  console.log('⚠️ TEMP_AI_DEBUG route enabled at /api/ai/dbquery (FORCE_AI_DEBUG=true)');
}


require('dotenv').config();
const HF_KEY = process.env.HF_KEY;
const HF_MODEL = process.env.HF_MODEL;
const MYSTER_API_KEY = process.env.MYSTER_API_KEY;
const MYSTER_API_BASE_URL = process.env.MYSTER_API_BASE_URL;




// Socket.IO setup with CORS
const io = socketIo(server, {
  path: '/ws/portfolio-updates',   // frontend ilə eyni olmalıdır
  cors: {
    origin: [
      process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      // avoid listing external production host by default; include only if explicitly configured
    ],
    methods: ['GET','POST'],
    credentials: true
  },
  transports: ['websocket','polling'],
  // Accept older engine.io protocol if behind some proxies/load balancers
  allowEIO3: true,
  // Disable perMessageDeflate to avoid some proxy issues with large frames
  perMessageDeflate: false
});




// Make io available to routes
app.set('io', io);

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://startup-1-j563.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
    FRONTEND_ORIGIN
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Essential middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiter middlewares (ensure these are defined before route usage)
let globalLimiter, authLimiter, otpLimiter, resendLimiter;
try {
  // Prefer the new fixedRateLimiter if present (clean replacement for corrupted file)
  const rl = require('./src/middleware/fixedRateLimiter.cjs');
  globalLimiter = rl.globalLimiter;
  authLimiter = rl.authLimiter;
  otpLimiter = rl.otpLimiter;
  resendLimiter = rl.resendLimiter;
  if (globalLimiter) app.use('/api', globalLimiter);
} catch (e1) {
  try {
    const rl = require('./src/middleware/rateLimiter.cjs');
    globalLimiter = rl.globalLimiter;
    authLimiter = rl.authLimiter;
    otpLimiter = rl.otpLimiter;
    resendLimiter = rl.resendLimiter;
    if (globalLimiter) app.use('/api', globalLimiter);
  } catch (e2) {
    console.warn('Rate limiter module not available, continuing without rate limiting:', (e2 && e2.message) || (e1 && e1.message) || e2 || e1);
    // Provide safe no-op fallbacks so routes that reference these middlewares don't break
    const noop = (req, res, next) => next();
    if (!globalLimiter) globalLimiter = noop;
    if (!authLimiter) authLimiter = noop;
    if (!otpLimiter) otpLimiter = noop;
    if (!resendLimiter) resendLimiter = noop;
  }
}

// Request logging middleware
// Response logger (status + time)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});


// Serve a tiny runtime-config JS file that bootstraps window.__APP_ENV__ from process.env.
app.get('/runtime-config.js', (req, res) => {
  const cfg = {
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID || '',
    PAYPAL_PLAN_PRO_ID: process.env.PAYPAL_PLAN_PRO_ID || process.env.PAYPAL_PRO_PLAN_ID || process.env.VITE_PAYPAL_PLAN_PRO_ID || process.env.REACT_APP_PAYPAL_PLAN_PRO_ID || '',
    PAYPAL_PLAN_ULTIMATE_ID: process.env.PAYPAL_PLAN_ULTIMATE_ID || process.env.VITE_PAYPAL_PLAN_ULTIMATE_ID || process.env.REACT_APP_PAYPAL_PLAN_ULTIMATE_ID || ''
  };
  res.setHeader('Content-Type', 'application/javascript');
  // Provide runtime config and a small helper to rewrite bad upstream URLs to local proxy
  const js = [];
  js.push(`window.__APP_ENV__ = ${JSON.stringify(cfg)};`);
  js.push(`(function(){
    // client-side proxy helpers
    const BAD_HOST = (function(){ try { return String(process && process.env && process.env.BAD_HOST) || 'https://zerocodedb.online'; } catch(e){ return 'https://zerocodedb.online'; } })();
    const PROXY_PREFIX = '/api/proxy';

    function buildProxyUrl(original) {
      try {
        if (!original) return original;
        if (original.startsWith('/')) return original;
        const u = new URL(original, window.location.origin);
        if (u.origin === BAD_HOST) {
          // preserve path + query
          return PROXY_PREFIX + u.pathname + u.search;
        }
        return original;
      } catch (e) {
        console.debug('buildProxyUrl error', e && e.message ? e.message : e);
        return original;
      }
    }

    // Small helper: retry fetch on 429/503 with exponential backoff and jitter
    async function fetchWithRetries(input, init, attempts = 3, baseDelay = 500) {
      let lastErr = null;
      for (let i=1;i<=attempts;i++) {
        try {
          const r = await window._origFetch(input, init);
          if (r.status === 429 || r.status === 503) {
            const ra = r.headers.get('Retry-After');
            const wait = ra ? (parseInt(ra,10)||1)*1000 : Math.min(baseDelay * 2**(i-1), 30000);
            const jitter = Math.floor(Math.random()*300);
            await new Promise(r => setTimeout(r, wait + jitter));
            lastErr = new Error('Upstream ' + r.status);
            continue;
          }
          return r;
        } catch (e) {
          lastErr = e;
          const wait = Math.min(baseDelay * 2**(i-1), 30000) + Math.floor(Math.random()*300);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
      }
      throw lastErr;
    }

    try {
      if (window.fetch) {
        window._origFetch = window.fetch.bind(window);
        window.fetch = function(input, init){
          try {
            let url = (typeof input === 'string') ? input : (input && input.url) ? input.url : input;
            const newUrl = buildProxyUrl(url);
            if (newUrl !== url) {
              console.debug('[runtime-proxy] rewriting', url, '->', newUrl);
            }
            if (typeof input === 'string') input = newUrl;
            else if (input && input.url) input = new Request(newUrl, input);
          } catch(e) { console.debug('runtime-proxy fetch rewrite failed', e && e.message ? e.message : e); }
          // Use fetchWithRetries for transient upstream errors
          return fetchWithRetries(input, init, Number(window.__APP_ENV__ && window.__APP_ENV__.PROXY_RETRY_ATTEMPTS) || 3);
        };
      }

      const XOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype && window.XMLHttpRequest.prototype.open;
      if (XOpen) {
        window.XMLHttpRequest.prototype.open = function(method, url){
          try {
            if (typeof url === 'string') {
              const newUrl = buildProxyUrl(url);
              if (newUrl !== url) {
                console.debug('[runtime-proxy XHR] rewriting', url, '->', newUrl);
                url = newUrl;
              }
            }
          } catch(e) { console.debug('runtime-proxy xhr rewrite failed', e && e.message ? e.message : e); }
          return XOpen.apply(this, [method, url].concat(Array.prototype.slice.call(arguments,2)));
        };
      }
    } catch (e) { console.debug('runtime-proxy init failed', e && e.message ? e.message : e); }
  })();`);

  res.send(js.join('\n'));
});

// Dev-only extra logger and route enumeration
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    try { console.log('[DEV REQ]', req.method, req.originalUrl); } catch (e) {}
    next();
  });
  try {
    const routes = (app._router && app._router.stack)
      ? app._router.stack.filter(r => r && r.route).map(r => Object.keys(r.route.methods).join(',').toUpperCase() + ' ' + r.route.path)
      : [];
    console.log('DEV Registered routes:', routes);
  } catch (e) {}
}

// Proxy/header normalization middleware: some hosts/proxies rewrite the path to '/'
// but add headers containing the original URI. Inspect common headers and
// rewrite req.url so API routing still works.
app.use((req, res, next) => {
  try {
    // Only run when request path is root; avoid interfering with normal routing
    if (req.path === '/' || req.originalUrl === '/') {
      const hdrs = req.headers;
      const candidates = [
        'x-original-url', 'x-original-uri', 'x-forwarded-url', 'x-rewrite-url',
        'x-request-uri', 'x-forwarded-path', 'x-forwarded-prefix', 'x-proxy-url',
        'x-url', 'x-forwarded-uri'
      ];
      for (const h of candidates) {
        const val = hdrs[h];
        if (!val) continue;
        const s = Array.isArray(val) ? val[0] : String(val || '');
        if (s.includes('/api/ai') || s.includes('/api/api/ai') || s.includes('/api/')) {
          const orig = req.url;
          // Extract path portion if header contains full URL
          const m = s.match(/https?:\/\/[^/]+(\/.*)/);
          const newPath = m ? m[1] : s;
          req.url = newPath;
          console.log('[PROXY_HEADER_REWRITE] header:', h, '-> rewriting', orig, 'to', req.url);
          break;
        }
      }
    }
  } catch (e) {
    console.warn('Proxy header normalization error', e && e.message ? e.message : e);
  }
  next();
});

// Deferred mount of AI router: do this after app and proxy normalization middleware
try {
  // Prefer HF-backed router if present
  let mounted = false;
  try {
    const hfRouter = require('./src/api/dbquery.hf.cjs');
    aiHandler = hfRouter.handleDbQuery || aiHandler || null;
    app.use('/api/ai', hfRouter);
    app.use('/ai', hfRouter);
    app.use('/api', hfRouter);
    mounted = true;
    console.log('Mounted HF AI router at /api/ai, /ai, and /api');
  } catch (e) {
    // fallback to existing router
    const aiRouter = require('./src/api/dbquery.cjs');
    // Keep a reference to the handler for root forwarding fallback
    aiHandler = aiRouter.handleDbQuery || aiHandler || null;
    app.use('/api/ai', aiRouter);
    app.use('/ai', aiRouter);
    app.use('/api', aiRouter);
    console.log('Mounted default AI router at /api/ai, /ai, and /api (deferred mount)');
  }
} catch (e) {
  console.warn('Could not mount AI router in server.cjs (deferred):', e && e.message ? e.message : e);
}

// Backward compatibility: if frontend POSTs to /api/proxy/dbquery but our internal
// AI handler is at /api/dbquery, forward internally preserving method/body/headers.
// Register this BEFORE mounting the external proxy router so local AI handler takes precedence
app.post('/api/proxy/dbquery', express.json({ limit: '10mb' }), (req, res, next) => {
  try {
    // If aiHandler exists (was mounted earlier), call it directly
    if (aiHandler && typeof aiHandler === 'function') {
      // Attach forwarded flag so handler can detect original path if needed
      req.headers['x-forwarded-for-proxy'] = 'internal-forward';
      return aiHandler(req, res, next);
    }
    // No ai handler; return 404 so callers see missing route
    return res.status(404).json({ error: 'not_found', message: '/api/dbquery handler not available' });
  } catch (err) {
    console.error('[PROXY_INTERNAL_FORWARD] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'forward_failed', details: err && err.message ? err.message : String(err) });
  }
});

// Mount proxy router for third-party API forwarding (keeps API keys on server)
try {
  const proxyRouter = require('./server/proxy.js');
  app.use('/api/proxy', proxyRouter);
  console.log('Mounted proxy router at /api/proxy');
} catch (e) {
  console.warn('Could not mount proxy router:', e && e.message ? e.message : e);
}
// disable ETag globally (so browsers/proxies less likely to return 304 for API)
app.disable('etag');

// prevent caching on all /api routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// MongoDB connection
if (MONGO_URL) {
  mongoose
      .connect(MONGO_URL)
      .then(async () => {
        console.log('✅ MongoDB connected');

        // Migration: migrate embedded workspace.members -> Member collection
        try {
          console.log('🔁 Checking for embedded workspace.members to migrate...');
          const workspacesWithMembers = await Workspace.find({ 'members.0': { $exists: true } }).lean();
          if (workspacesWithMembers && workspacesWithMembers.length > 0) {
            console.log(`🔁 Found ${workspacesWithMembers.length} workspace(s) with embedded members. Migrating...`);
            let migratedCount = 0;
            for (const ws of workspacesWithMembers) {
              const wid = ws.id || ws._id;
              const members = Array.isArray(ws.members) ? ws.members : [];
              for (const m of members) {
                const uname = m.username;
                if (!uname) continue;
                // avoid duplicates
                const exists = await Member.findOne({ workspaceId: wid, username: new RegExp('^' + uname + '$', 'i') }).lean();
                if (!exists) {
                  const mem = new Member({
                    workspaceId: wid,
                    id: require('uuid').v4(),
                    username: uname,
                    role: m.role || 'viewer',
                    joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
                    updatedAt: new Date()
                  });
                  await mem.save();
                  migratedCount++;
                }
              }

              // remove embedded members array to avoid duplication
              try {
                await Workspace.updateOne({ id: wid }, { $unset: { members: '' } });
              } catch (e) {
                console.warn('⚠️ Failed to unset members for workspace', wid, e.message || e);
              }
            }
            console.log(`✅ Migration complete. Created ${migratedCount} Member records.`);
          } else {
            console.log('🔁 No embedded members found, migration not required.');
          }
        } catch (migErr) {
          console.error('❌ Migration error:', migErr);
        }
      })
    .catch(err => {
      console.warn('⚠️ MongoDB connection failed:', err.message);
      console.log('📡 Continuing without MongoDB (development mode)');
    });
} else {
  console.log('📡 MongoDB not configured, running in development mode without database');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Defensive mount: if a request arrives at root with body that looks like an AI query
// (for example when the proxy rewrites to '/'), we will detect and forward it.
app.post('/', (req, res, next) => {
  try {
    // quick heuristic: body has 'question' and 'language'
    if (aiHandler && req.body && typeof req.body.question === 'string') {
      console.log('[ROOT_AI_FORWARD] forwarding to AI handler from path /');
      return aiHandler(req, res, next);
    }
  } catch (e) {
    console.warn('[ROOT_AI_FORWARD] error', e && e.message ? e.message : e);
  }
  next();
});

// Dev-only unmatched request catcher: logs method, originalUrl, user-agent
// NOTE: do not short-circuit; allow actual route handlers to run. Final 404 is handled later.
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    try {
      console.log('[DEV_UNMATCHED]', req.method, req.originalUrl, req.headers['user-agent'] || 'no-ua');
    } catch (e) {}
    return next();
  });
}

// API debug middleware: logs incoming API requests and route registry snapshot.
app.use('/api/*', (req, res, next) => {
  try {
    const routes = (app._router && app._router.stack)
      ? app._router.stack.filter(r => r && r.route).map(r => Object.keys(r.route.methods).join(',').toUpperCase() + ' ' + r.route.path)
      : [];

    console.log('[API_DEBUG] incoming', req.method, req.originalUrl || req.url, 'path=', req.path);
    console.log('[API_DEBUG] headers excerpt:', JSON.stringify({
      host: req.headers.host,
      origin: req.headers.origin,
      'x-original-url': req.headers['x-original-url'],
      'x-forwarded-url': req.headers['x-forwarded-url'],
      'x-forwarded-uri': req.headers['x-forwarded-uri'],
      referer: req.headers.referer
    }));
    console.log('[API_DEBUG] registered routes count:', routes.length);
    // show first 30 routes for context
    console.log('[API_DEBUG] routes sample:', routes.slice(0,30));
  } catch (e) {
    console.warn('API_DEBUG logging failed', e && e.message ? e.message : e);
  }
  next();
});

// API Routes - All under /api prefix
app.use('/api/portfolios', authenticate, portfolioRoutes);
app.use('/api/workspaces', authenticate, workspaceRoutes);
app.use('/api/schemas', authenticate, schemaRoutes);

const CPS_AUTO_DB_TOKENS = new Set(['', 'auto', 'autodetect', 'default']);
let cachedAutoDbId = null;

function looksLikeAutoToken(value) {
  if (value === undefined || value === null) return true;
  return CPS_AUTO_DB_TOKENS.has(String(value).trim().toLowerCase());
}

async function autoDetectCpsDbId() {
  if (cachedAutoDbId) return cachedAutoDbId;
  const list = cpsAdapter.listDatabases();
  if (Array.isArray(list) && list.length && list[0].id) {
    cachedAutoDbId = list[0].id;
    console.log('[CPS] Auto-selected default DB id', cachedAutoDbId, list[0].name ? `(${list[0].name})` : '');
    return cachedAutoDbId;
  }
  return null;
}

async function resolveCpsDbId(req) {
  const requestOverride = req.query?.dbId || (req.body && req.body.dbId);
  if (!looksLikeAutoToken(requestOverride)) return String(requestOverride).trim();
  const envValue = process.env.CPS_DEFAULT_DB_ID;
  if (!looksLikeAutoToken(envValue)) return envValue.trim();
  return autoDetectCpsDbId();
}

// CPS helper endpoint: provision a per-user one-time connection via embedded CPS adapter
// Requires these env vars to be set in production/deploy:
// CPS_ADMIN_API_KEY - indicates CPS integration configured (also used by legacy admin flows)
// CPS_DEFAULT_DB_ID - the dbId in CPS metadata to provision users for (or "auto")
app.get('/api/cps/connection', authenticate, async (req, res) => {
  try {
    const cpsAdminKey = process.env.CPS_ADMIN_API_KEY || process.env.ADMIN_API_KEY;
    const cpsDbId = await resolveCpsDbId(req);
    if (!cpsAdminKey || !cpsDbId) {
      // Return a friendly non-500 response so frontend doesn't flood console with errors.
      console.warn('CPS proxy endpoint called but CPS_ADMIN_API_KEY or CPS_DEFAULT_DB_ID is not configured. Returning demo placeholders.');
      return res.status(200).json({
        configured: false,
        message: 'CPS not configured on this host. Set CPS_ADMIN_API_KEY and CPS_DEFAULT_DB_ID to enable live provisioning.',
        connectionString: '',
        examples: {
          php_pdo_mysql: "<?php\n// Replace placeholders with real values from your DB admin\n$dsn = 'mysql:host=DB_HOST;port=3306;dbname=DB_NAME;charset=utf8mb4';\n$user = 'DB_USER';\n$pass = 'DB_PASS';\ntry { $pdo = new PDO($dsn,$user,$pass); var_dump($pdo->query('SELECT NOW()')->fetch()); } catch (PDOException $e) { echo $e->getMessage(); }\n?>",
          php_mongodb: "<?php\n// Replace placeholders with real values\nrequire 'vendor/autoload.php';\n$uri = 'mongodb://DB_USER:DB_PASS@DB_HOST:27017/DB_NAME';\n$manager = new MongoDB\\Driver\\Manager($uri);\n$cmd = new MongoDB\\Driver\\Command(['ping' => 1]);\nprint_r($manager->executeCommand('admin',$cmd)->toArray());\n?>",
          node_mysql: "// Replace placeholders with real values\nconst mysql = require('mysql2/promise');\n(async ()=>{ const conn = await mysql.createConnection({host:'DB_HOST',user:'DB_USER',password:'DB_PASS',database:'DB_NAME',port:3306}); const [rows] = await conn.query('SELECT NOW()'); console.log(rows); await conn.end(); })();"
        }
      });
    }

    // username prefix includes user id so provisioned username is unique per-user
    const usernamePrefix = `user_${req.userId || (req.user && req.user.userId) || 'anon'}`;

    try {
      const payload = await cpsAdapter.provisionConnection({ dbId: cpsDbId, usernamePrefix, ttl: 3600 });
      return res.status(200).json(payload);
    } catch (innerErr) {
      const msg = innerErr && innerErr.message ? innerErr.message : 'Unknown error';
      console.error('CPS connection provisioning error:', msg);
      // If CPS is misconfigured (e.g., missing db), return a friendly payload so frontend doesn't hard-fail
      if (innerErr && innerErr.message === 'database_not_found') {
        return res.status(200).json({
          configured: false,
          message: 'CPS is not configured with any databases. Provide CPS_DATABASES_JSON or CPS_DB_HOST/CPS_DB_ADMIN_URI and set CPS_DEFAULT_DB_ID.',
          connectionString: '',
          examples: {
            php_pdo_mysql: "<?php\\n$dsn = 'mysql:host=DB_HOST;port=3306;dbname=DB_NAME;charset=utf8mb4';\\n$user = 'DB_USER';\\n$pass = 'DB_PASS';\\n?>",
            node_mysql: "const mysql = require('mysql2/promise');\\n(async ()=>{ const conn = await mysql.createConnection({host:'DB_HOST',user:'DB_USER',password:'DB_PASS',database:'DB_NAME',port:3306}); const [rows] = await conn.query('SELECT NOW()'); console.log(rows); await conn.end(); })();"
          }
        });
      }
      // Bubble a safe diagnostic so the frontend can show why 502 happened (no secrets leaked)
      return res.status(502).json({
        error: 'CPS provisioning failed',
        details: {
          message: msg,
          code: innerErr && innerErr.code ? innerErr.code : undefined,
          name: innerErr && innerErr.name ? innerErr.name : undefined
        }
      });
    }
  } catch (err) {
    console.error('CPS connection provisioning error:', err && err.message ? err.message : err);
    return res.status(502).json({ error: 'CPS provisioning failed', details: { message: err && err.message ? err.message : 'Unknown error' } });
  }
});

// Server-side fallback to create subscription and redirect to PayPal approval
app.get('/api/pay/fallback-subscription', async (req, res) => {
  try {
    const planId = req.query.plan_id || req.query.plan || '';
    if (!planId) return res.status(400).json({ error: 'plan_id query parameter required' });

    console.log('[FALLBACK] Creating subscription server-side for plan', planId);

    // Get access token from PayPal
    const tokenResp = await axios({
      method: 'post',
      url: `${PAYPAL_API_BASE.replace(/\/+$/, '')}/v1/oauth2/token`,
      auth: { username: PAYPAL_CLIENT_ID, password: PAYPAL_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'grant_type=client_credentials'
    });

    const accessToken = tokenResp && tokenResp.data && tokenResp.data.access_token;
    if (!accessToken) {
      console.error('[FALLBACK] no access token from PayPal', tokenResp && tokenResp.data);
      return res.status(502).json({ error: 'Unable to fetch PayPal access token' });
    }

    // Create subscription server-side
    const createResp = await axios({
      method: 'post',
      url: `${PAYPAL_API_BASE.replace(/\/+$/, '')}/v1/billing/subscriptions`,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      data: {
        plan_id: planId,
        application_context: {
          brand_name: 'ZeroCodeDB',
          return_url: `${FRONTEND_ORIGIN || 'http://localhost:5173'}/account`,
          cancel_url: `${FRONTEND_ORIGIN || 'http://localhost:5173'}/subscribe?cancelled=true`,
          shipping_preference: 'NO_SHIPPING'
        }
      }
    });

    const links = createResp && createResp.data && createResp.data.links;
    const approve = Array.isArray(links) && links.find(l => l.rel === 'approve');
    if (approve && approve.href) {
      console.log('[FALLBACK] Redirecting user to PayPal approve url', approve.href);
      return res.redirect(302, approve.href);
    }

    console.error('[FALLBACK] No approve link in PayPal response', createResp && createResp.data);
    return res.status(502).json({ error: 'No approval URL returned from PayPal', details: createResp && createResp.data });
  } catch (err) {
    console.error('[FALLBACK] error creating subscription', err && err.response && err.response.data ? err.response.data : err);
    const status = err && err.response && err.response.status ? err.response.status : 500;
    const data = err && err.response && err.response.data ? err.response.data : { message: err.message || 'Unknown error' };
    return res.status(status).json({ error: 'PayPal subscription creation failed', details: data });
  }
});

// User validation endpoint
app.post('/api/users/validate', async (req, res) => {
  try {
    console.log('Validating username:', req.body);
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, returning true for development');
      return res.json({ exists: true });
    }
    
    const exists = await User.exists({ username });
    console.log('Username exists check result:', { username, exists: !!exists });
    return res.json({ exists: !!exists });
  } catch (err) {
    console.error('Username validation error:', err);
    return res.status(500).json({ error: 'Server error during validation' });
  }
});

// Authentication routes
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, 'subscriptionPlan expiresAt fullName email username');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('GET /api/users/me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user presence: mark online
app.post('/api/users/online', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/users/online error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update user presence: mark offline
app.post('/api/users/offline', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/users/offline error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/subscription/status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, 'subscriptionPlan expiresAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const isExpired = user.expiresAt && new Date() > user.expiresAt;
    const subscriptionStatus = {
      plan: user.subscriptionPlan || 'free',
      isActive: !isExpired,
      expiresAt: user.expiresAt,
      isExpired
    };
    res.json(subscriptionStatus);
  } catch (err) {
    console.error('GET /api/subscription/status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/paypal/webhook', express.json({ type: 'application/json' }), async (req, res) => {
  try {
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const webhookEvent = req.body;

    if (!PAYPAL_WEBHOOK_ID) {
      console.warn('PAYPAL_WEBHOOK_ID not set');
      return res.status(500).send('Webhook not configured');
    }

    const accessToken = await getPayPalAccessToken();
    const verifyRes = await axios.post(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    if (!verifyRes.data || verifyRes.data.verification_status !== 'SUCCESS') {
      console.warn('Webhook verification failed', verifyRes.data);
      return res.status(400).send('Invalid webhook signature');
    }

    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource || {};

    console.log('PayPal webhook event:', eventType);

    // Handle subscription lifecycle events
    if (eventType.startsWith('BILLING.SUBSCRIPTION')) {
      const subscriptionId = resource.id || resource.subscription_id;
      const status = resource.status || resource.state;
      const planId = resource.plan_id || (resource.plan && resource.plan.id);
      const nextBillingTime = resource.billing_info && resource.billing_info.next_billing_time ? new Date(resource.billing_info.next_billing_time) : null;

      // Update/Upsert Subscription doc
      await Subscription.findOneAndUpdate(
        { subscriptionId },
        {
          $set: {
            subscriptionId,
            planId,
            status,
            nextBillingTime,
            raw: resource
          }
        },
        { upsert: true }
      );

      // If subscription has mapping to user, update user status
      const subDoc = await Subscription.findOne({ subscriptionId });
      if (subDoc && subDoc.userId) {
        const user = await User.findById(subDoc.userId);
        if (user) {
          if (String(status).toUpperCase() === 'ACTIVE') {
            user.subscriptionPlan = subDoc.plan || user.subscriptionPlan || 'Pro';
            user.expiresAt = nextBillingTime || new Date(Date.now() + 30*24*60*60*1000);
            await user.save();
          } else if (['CANCELLED','SUSPENDED','EXPIRED'].includes(String(status).toUpperCase())) {
            user.subscriptionPlan = 'Free';
            user.expiresAt = null;
            await user.save();
          }
        }
      }
    }

    // Handle payment events optionally
    if (eventType === 'PAYMENT.SALE.COMPLETED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      // resource may contain billing_agreement_id / invoice_id depending on flow
      console.log('Payment completed resource:', resource && resource.id);
      // optionally find subscription by id and mark payment processed
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('webhook handler error:', err && (err.response?.data || err.message) ? (err.response?.data || err.message) : err);
    return res.status(500).send('Server error');
  }
});

app.post('/api/paypal/confirm-subscription', authenticate, express.json(), async (req, res) => {
  try {
    const { subscriptionID } = req.body || {};
    const userId = req.userId;
    if (!subscriptionID) return res.status(400).json({ message: 'subscriptionID required' });

    const accessToken = await getPayPalAccessToken();
    const subRes = await axios.get(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionID}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    const subData = subRes.data;
    const status = subData.status;
    const planId = subData.plan_id;
    const startTime = subData.start_time ? new Date(subData.start_time) : null;
    const nextBillingTime = subData.billing_info && subData.billing_info.next_billing_time ? new Date(subData.billing_info.next_billing_time) : null;

    // map planId -> friendly plan name
    const planMap = {};
    if (PAYPAL_PLAN_PRO_ID) planMap[PAYPAL_PLAN_PRO_ID] = 'Pro';
    if (PAYPAL_PLAN_ULTIMATE_ID) planMap[PAYPAL_PLAN_ULTIMATE_ID] = 'Ultimate';
    const planName = planMap[planId] || 'Pro';

    // upsert subscription record
    const saved = await Subscription.findOneAndUpdate(
      { subscriptionId: subscriptionID },
      {
        subscriptionId: subscriptionID,
        userId,
        plan: planName,
        planId,
        status,
        startTime,
        nextBillingTime,
        raw: subData
      },
      { upsert: true, new: true }
    );

    // if active, update user
    if (String(status).toUpperCase() === 'ACTIVE') {
      const user = await User.findById(userId);
      if (user) {
        user.subscriptionPlan = planName;
        user.expiresAt = nextBillingTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await user.save();
      }
    }

    return res.json({ success: true, status, plan: planName, nextBillingTime: saved.nextBillingTime });
  } catch (err) {
    console.error('confirm-subscription error', err && (err.response?.data || err.message) ? (err.response?.data || err.message) : err);
    return res.status(500).json({ message: 'Failed to confirm subscription' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, 'fullName email username subscriptionPlan expiresAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  const payload = { userId: user._id, email: user.email, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
    const uobj = user.toObject();
    delete uobj.password;
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ message: 'Login successful', token, user: uobj });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;
    
    // Validate input
    if (!fullName || !phone || !email || !password || !username) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All fields are required',
          details: {
            required: ['fullName', 'phone', 'email', 'password', 'username']
          }
        }
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long'
        }
      });
    }

    // Check for existing user
    const conflict = await User.findOne({ $or: [{ email }, { username }, { phone }] });
    if (conflict) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_USER',
          message: 'An account with these details already exists'
        }
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Optional MVP mode: register user directly without OTP/email verification flow
    if (DISABLE_EMAIL_VERIFICATION) {
      const createdUser = await new User({
        username,
        email,
        password: hashed,
        fullName,
        phone,
        isVerified: true,
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpResendCount: 0,
        lastResendAt: null
      }).save();

      const payload = { userId: createdUser._id, email: createdUser.email, username: createdUser.username };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

      const userObj = createdUser.toObject();
      delete userObj.password;
      delete userObj.otpHash;

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.status(201).json({
        message: 'Registration successful',
        token,
        user: userObj,
        requiresVerification: false
      });
    }
    
    // Generate secure OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp, process.env.OTP_SECRET);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user with hashed OTP
    const newUser = await new User({
      username,
      email,
      password: hashed,
      fullName,
      phone,
      isVerified: false,
      otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      otpResendCount: 0
    }).save();

    // Generate temporary token for OTP verification
    const tempToken = generateTempToken(newUser._id, process.env.JWT_SECRET);

    // Send verification email
    try {
      if (!process.env.SMTP_HOST) {
        console.warn('SMTP not configured, skipping sendMail');
        throw new Error('SMTP not configured');
      }
      
      const { otpEmailTemplate } = require('./src/templates/otpEmail.cjs');
      const mailRes = await transporter.sendMail({
        from: `"ZeroCodeDB" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Verify Your Email - ZeroCodeDB',
        text: `Your verification code: ${otp}. This code will expire in 10 minutes.`,
        html: otpEmailTemplate(otp)
      });
      
      console.log('Verification email sent:', mailRes.messageId);
      
      res.status(201).json({
        message: 'Registration successful',
        tempToken,
        requiresVerification: true
      });
      
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr.message);
      // Delete user if email fails - they can try again
      await User.deleteOne({ _id: newUser._id });
      return res.status(500).json({
        error: {
          code: 'EMAIL_DELIVERY_FAILED',
          message: 'Could not send verification email. Please try again later.'
        }
      });
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Verify email code
app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { tempToken, otp } = req.body;
    
    if (!tempToken || !otp) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Verification token and OTP are required'
        }
      });
    }

    // Verify and decode temp token
    let decoded;
    try {
      decoded = verifyTempToken(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired verification token'
        }
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'Email already verified'
        }
      });
    }

    // Check OTP expiry
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(410).json({
        error: {
          code: 'OTP_EXPIRED',
          message: 'Verification code has expired. Please request a new one.'
        }
      });
    }

    // Check attempts
    if (user.otpAttempts >= 5) {
      return res.status(403).json({
        error: {
          code: 'MAX_ATTEMPTS',
          message: 'Maximum verification attempts reached. Please request a new code.'
        }
      });
    }

    // Verify OTP
    const isValid = verifyOTP(otp, user.otpHash, process.env.OTP_SECRET);
    
    if (!isValid) {
      user.otpAttempts += 1;
      await user.save();
      
      return res.status(400).json({
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid verification code',
          details: {
            remainingAttempts: 5 - user.otpAttempts
          }
        }
      });
    }

    // OTP is valid - mark as verified and clear OTP fields
    user.isVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.otpResendCount = 0;
    user.lastResendAt = null;
    await user.save();

    // Generate auth token
    const authToken = generateAuthToken(
      user._id,
      user.username,
      user.email,
      process.env.JWT_SECRET
    );

    // Send success response with auth token
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.otpHash;
    
    res.json({
      message: 'Email verified successfully',
      token: authToken,
      user: userObj
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// Resend verification code
app.post('/api/auth/resend-otp', resendLimiter, async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Verification token is required'
        }
      });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = verifyTempToken(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired verification token'
        }
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'Email already verified'
        }
      });
    }

    // Check resend limits
    if (user.otpResendCount >= 5) {
      return res.status(403).json({
        error: {
          code: 'MAX_RESENDS',
          message: 'Maximum resend attempts reached. Please try registering again.'
        }
      });
    }

    // Check cooldown (60 seconds between resends)
    if (user.lastResendAt && Date.now() - user.lastResendAt.getTime() < 60000) {
      return res.status(429).json({
        error: {
          code: 'RESEND_COOLDOWN',
          message: 'Please wait before requesting another code',
          details: {
            retryAfter: Math.ceil((user.lastResendAt.getTime() + 60000 - Date.now()) / 1000)
          }
        }
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp, process.env.OTP_SECRET);
    
    user.otpHash = otpHash;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.otpAttempts = 0;
    user.otpResendCount += 1;
    user.lastResendAt = new Date();
    
    try {
      if (!process.env.SMTP_HOST) {
        throw new Error('SMTP not configured');
      }

      const { otpEmailTemplate } = require('./src/templates/otpEmail.cjs');
      const mailRes = await transporter.sendMail({
        from: `"ZeroCodeDB" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Your New Verification Code - ZeroCodeDB',
        text: `Your new verification code: ${otp}. This code will expire in 10 minutes.`,
        html: otpEmailTemplate(otp)
      });

      await user.save();
      console.log('Resend verification email sent:', mailRes.messageId);

      res.json({
        message: 'New verification code sent',
        details: {
          remainingResends: 5 - user.otpResendCount,
          expiresIn: '10 minutes'
        }
      });

    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr.message);
      return res.status(500).json({
        error: {
          code: 'EMAIL_DELIVERY_FAILED',
          message: 'Could not send verification email. Please try again later.'
        }
      });
    }
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ message: 'Server error during resend' });
  }
});

app.post('/api/logout', (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    });
    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

// Socket.IO workspace management
const workspaceRooms = new Map();
// Map username -> Set of socket ids for notifying specific users
const userSockets = new Map();

// In-memory debounce queue for schema persistence to avoid write storms
// Structure: Map<workspaceId, Map<schemaId, { timer: NodeJS.Timeout, payload: { name, scripts } }>>
const pendingSchemaWrites = new Map();
const SCHEMA_PERSIST_DEBOUNCE_MS = 1000; // wait 1s of quiet before persisting

io.on('connection', (socket) => {
  console.log('🔌 Socket.IO client connected:', socket.id);

  socket.on('join_workspace', (workspaceId) => {
    console.log(`🏠 Socket ${socket.id} joining workspace: ${workspaceId}`);
    socket.join(`workspace_${workspaceId}`);

    // Track socket in workspace
    if (!workspaceRooms.has(workspaceId)) {
      workspaceRooms.set(workspaceId, new Set());
    }
    workspaceRooms.get(workspaceId).add(socket.id);
    
    socket.workspaceId = workspaceId;
  });

  // Register user presence when client emits user_join (contains username)
  socket.on('user_join', (data) => {
    try {
      const username = data && (data.username || data.userId);
      if (username) {
        socket.username = String(username);
        if (!userSockets.has(socket.username)) userSockets.set(socket.username, new Set());
        userSockets.get(socket.username).add(socket.id);
        console.log('🔔 Registered socket for user:', socket.username, socket.id);
      }
      // Continue to relay join to others in workspace
      relayIfInWorkspace('user_joined', data);
    } catch (e) {
      console.warn('Failed to register user socket on user_join', e);
    }
  });

  socket.on('leave_workspace', (workspaceId) => {
    console.log(`🚪 Socket ${socket.id} leaving workspace: ${workspaceId}`);
    socket.leave(`workspace_${workspaceId}`);

    // Remove from tracking
    if (workspaceRooms.has(workspaceId)) {
      workspaceRooms.get(workspaceId).delete(socket.id);
    }
    
    delete socket.workspaceId;
  });

  // Relay collaboration events emitted by clients to other members in the same workspace
  const relayIfInWorkspace = (eventName, payload) => {
    if (socket.workspaceId) {
      console.log(`↔ Relaying ${eventName} from ${socket.id} to workspace ${socket.workspaceId}`);
      // Broadcast to others in the room (exclude sender)
      socket.to(`workspace_${socket.workspaceId}`).emit(eventName, payload);
    } else {
      console.log(`⚠️ Ignoring ${eventName} from ${socket.id} because socket not joined to a workspace`);
    }
  };

  // Compatibility: also accept 'join-room' event name
  socket.on('join-room', (workspaceId) => {
    try {
      console.log(`🏠 (join-room) Socket ${socket.id} joining workspace: ${workspaceId}`);
      // Join the socket.io room
      socket.join(`workspace_${workspaceId}`);
      socket.workspaceId = workspaceId;

      // Ensure server has a Y.Doc for this workspace and send initial snapshot
      try {
        (async () => {
          const snap = yjsManager.encodeState(workspaceId);
          if (snap && socket) {
            socket.emit('yjs-snapshot', snap);
          }
        })();
      } catch (e) {
        console.warn('Failed to send initial yjs snapshot', e);
      }

      // Handle incoming Yjs updates from clients
      socket.on('yjs-update', async (payload) => {
        try {
          if (!payload || !payload.workspaceId || !payload.update) return;
          if (String(payload.workspaceId) !== String(workspaceId)) return;
          const u8 = Buffer.from(payload.update, 'base64');
          await yjsManager.applyUpdateFromClient(workspaceId, u8, { socketId: socket.id });
        } catch (e) {
          console.warn('Failed to handle yjs-update from client', e);
        }
      });

  socket.on('cursor_update', (data) => relayIfInWorkspace('cursor_update', data));
  socket.on('user_join', (data) => relayIfInWorkspace('user_joined', data));
  socket.on('user_leave', (data) => relayIfInWorkspace('user_left', data));
    } catch (e) {
      console.warn('join-room handler error', e);
    }
  });
  // Persist schema_change payloads that include a full schema to the Workspace.sharedSchemas
  socket.on('schema_change', async (data) => {
    try {
      // If payload contains a full schema and schemaId, schedule persistence (debounced)
        if (data && data.schemaId && data.schema) {
        const workspaceId = socket.workspaceId || data.workspaceId;
        const schemaId = String(data.schemaId);
        if (workspaceId) {
          // Enforce server-side authority: reject client attempts to create new canonical docs via socket
          if (data.createNew) {
            try {
              socket.emit('error', { message: 'Cannot create new canonical document for a shared schema; use canonical workspaceId' });
            } catch (e) {}
            return;
          }
          try {
            // Ensure maps exist
            if (!pendingSchemaWrites.has(workspaceId)) pendingSchemaWrites.set(workspaceId, new Map());
            const wsMap = pendingSchemaWrites.get(workspaceId);

            // Clear existing timer if present
            if (wsMap.has(schemaId) && wsMap.get(schemaId).timer) {
              clearTimeout(wsMap.get(schemaId).timer);
            }

            // Store latest payload and schedule upsert
            wsMap.set(schemaId, {
              timer: setTimeout(async () => {
                try {
                  const SharedSchema = require('./src/models/SharedSchema.cjs');
                  const update = {
                    $set: {
                      workspaceId,
                      schemaId,
                      name: data.name || 'Shared Schema',
                      scripts: String(data.schema),
                      lastModified: new Date(),
                      shared: true
                    },
                    $inc: { version: 1 }
                  };
                  const opts = { upsert: true, new: true };
                  const saved = await SharedSchema.findOneAndUpdate({ workspaceId, schemaId }, update, opts).exec();

                  // Update denormalized Workspace.sharedSchemas if present
                  try {
                    const w = await Workspace.findOne({ id: workspaceId });
                    if (w) {
                      w.sharedSchemas = w.sharedSchemas || [];
                      const idx = w.sharedSchemas.findIndex(s => s.schemaId === schemaId);
                      const schemaEntry = { schemaId, name: saved.name, scripts: saved.scripts, lastModified: saved.lastModified };
                      if (idx >= 0) w.sharedSchemas[idx] = schemaEntry; else w.sharedSchemas.push(schemaEntry);
                      w.updatedAt = new Date();
                      await w.save();
                    }
                  } catch (e) {
                    console.warn('Failed to update denormalized workspace.sharedSchemas from socket debounce:', e);
                  }

                  console.log('✅ Debounced shared schema persisted (upsert) for', workspaceId, 'schemaId:', schemaId);
                  try {
                    console.log(`Saved shared schema workspaceId=${workspaceId} schemaId=${schemaId} _id=${saved._id} version=${saved.version}`);
                  } catch (e) {}
                  emitToWorkspace(workspaceId, 'workspace-updated', { workspaceId, schemaId, version: saved.version, lastModified: saved.lastModified });
                } catch (err) {
                  console.warn('Failed to persist debounced shared schema (upsert):', err);
                } finally {
                  const m = pendingSchemaWrites.get(workspaceId);
                  if (m) m.delete(schemaId);
                }
              }, SCHEMA_PERSIST_DEBOUNCE_MS),
              payload: { name: data.name || 'Shared Schema', scripts: String(data.schema) }
            });
          } catch (e) {
            console.warn('Failed to schedule shared schema persistence from schema_change:', e);
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // Also relay the schema_change event to other clients as before
    relayIfInWorkspace('schema_change', data);
  });
  socket.on('user_selection', (data) => relayIfInWorkspace('user_selection', data));
  socket.on('presence_update', (data) => relayIfInWorkspace('presence_update', data));

  socket.on('disconnect', () => {
    console.log('❌ Socket.IO client disconnected:', socket.id);
    
    // Clean up workspace tracking
    if (socket.workspaceId && workspaceRooms.has(socket.workspaceId)) {
      workspaceRooms.get(socket.workspaceId).delete(socket.id);
    }
    // Clean up userSockets mapping
    if (socket.username) {
      const set = userSockets.get(socket.username);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(socket.username);
      }
    }
  });
});

// Helper function to emit to workspace
const emitToWorkspace = (workspaceId, event, data) => {
  console.log(`📡 Emitting ${event} to workspace ${workspaceId}:`, data);
  io.to(`workspace_${workspaceId}`).emit(event, data);
};

// Make emitToWorkspace available to routes
app.set('emitToWorkspace', emitToWorkspace);
// Make userSockets available to routes for direct notifications
app.set('userSockets', userSockets);

// SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// Add a socket timeout to the transport to fail faster on unreachable hosts
if (process.env.SMTP_HOST) {
  transporter.set('socketTimeout', 10_000); // 10s
  transporter.verify((err) => {
    if (err) {
      console.error('SMTP verify error:', err && err.message ? err.message : err);
      console.warn('SMTP appears unavailable. Email sending may fail; registration will revert user creation on email errors.');
    } else {
      console.log('✅ SMTP ready');
    }
  });
} else {
  console.warn('SMTP_HOST not set; email sending is disabled. Registration will skip sending emails and return an error to clients.');
}



async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) throw new Error('PayPal credentials not configured');
  const tokenUrl = `${PAYPAL_API_BASE}/v1/oauth2/token`;
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const res = await axios({
    method: 'post',
    url: tokenUrl,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: 'grant_type=client_credentials'
  });
  return res.data.access_token;
}



// Price map (USD) — adjust as needed
const PLAN_PRICES = {
  Pro: '1.00',
  Ultimate: '19.99'
};

// Create PayPal order (frontend expects { orderID })
app.post('/api/paypal/create-order', authenticate, async (req, res) => {
  try {
    // userId is derived from authenticated token
    const userId = req.userId;
    const { plan } = req.body || {};
    if (!userId || !plan) return res.status(400).json({ message: 'Authenticated user and plan are required' });
    const planKey = String(plan).toLowerCase() === 'ultimate' ? 'Ultimate' : 'Pro';
    const price = PLAN_PRICES[planKey];
    if (!price) return res.status(400).json({ message: 'Unknown plan' });

    const accessToken = await getPayPalAccessToken();
    const orderRes = await axios.post(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'USD', value: price } }]
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    res.json({ orderID: orderRes.data.id });
  } catch (err) {
    console.error('create-order error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to create PayPal order' });
  }
});

// Capture PayPal order and update user's subscription
app.post('/api/paypal/capture-order', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const { orderID, plan } = req.body || {};
    if (!orderID || !userId || !plan) return res.status(400).json({ message: 'orderID, authenticated user and plan are required' });
    const planKey = String(plan).toLowerCase() === 'ultimate' ? 'Ultimate' : 'Pro';

    const accessToken = await getPayPalAccessToken();
    const capRes = await axios.post(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {}, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    // Basic verification of capture status
    const status = capRes.data && (capRes.data.status || (capRes.data.purchase_units && capRes.data.purchase_units[0] && capRes.data.purchase_units[0].payments && capRes.data.purchase_units[0].payments.captures && capRes.data.purchase_units[0].payments.captures[0] && capRes.data.purchase_units[0].payments.captures[0].status));
    if (!status || (String(status).toUpperCase() !== 'COMPLETED' && String(status).toUpperCase() !== 'CAPTURED')) {
      console.warn('PayPal capture returned non-complete status:', status);
      return res.status(400).json({ message: 'Payment not completed', details: capRes.data });
    }

    // Update user subscription: set plan and expiresAt = now + 30 days
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.subscriptionPlan = planKey;
    user.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await user.save();

    res.json({ success: true, expiresAt: user.expiresAt });
  } catch (err) {
    console.error('capture-order error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to capture PayPal order' });
  }
});

// Cron job: daily downgrade of expired subscriptions to Free
try {
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const expiredUsers = await User.find({ expiresAt: { $lte: now }, subscriptionPlan: { $ne: 'Free' } });
      if (expiredUsers && expiredUsers.length > 0) {
        console.log(`⏳ Downgrading ${expiredUsers.length} expired subscription(s) to Free`);
        for (const u of expiredUsers) {
          u.subscriptionPlan = 'Free';
          u.expiresAt = null;
          await u.save();
        }
      }
    } catch (e) {
      console.error('Cron downgrade error:', e && e.message ? e.message : e);
    }
  });
  console.log('✅ Subscription expiry cron scheduled (daily)');
} catch (e) {
  console.warn('Could not schedule subscription cron:', e && e.message ? e.message : e);
}


// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: 'piriyevtural00@gmail.com',
      subject: `New Contact Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `<h3>New Contact Form Message</h3><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error sending contact email:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// API Error handler - Always return JSON
app.use('/api/*', (err, req, res, next) => {
  console.error('❌ API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404 handler for API routes - Return JSON, not HTML
app.use('/api/*', (req, res) => {
  console.log(`❌ API 404: ${req.method} ${req.path}`);
  const base = { error: 'API endpoint not found', path: req.path, method: req.method, timestamp: new Date().toISOString() };
  if (process.env.NODE_ENV !== 'production') {
    try {
      const routes = (app._router && app._router.stack)
        ? app._router.stack.filter(r => r && r.route).map(r => Object.keys(r.route.methods).join(',').toUpperCase() + ' ' + r.route.path)
        : [];
      base['registeredRoutesSample'] = routes.slice(0, 50);
      base['requestHeaders'] = {
        host: req.headers.host,
        origin: req.headers.origin,
        'x-original-url': req.headers['x-original-url'],
        'x-forwarded-url': req.headers['x-forwarded-url'],
        'x-forwarded-uri': req.headers['x-forwarded-uri'],
      };
    } catch (e) {}
  }
  res.status(404).json(base);
});

// Serve static files in production - ONLY for non-API routes
// Frontend-in (React/Vite) statik fayllarını oxutmaq (şərtsiz)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback - API-dan başqa BÜTÜN linkləri birbaşa React-ə (index.html) yönləndirmək
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  // Always return JSON for API routes
  if (req.path.startsWith('/api')) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).send('Internal Server Error');
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server started successfully!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ MongoDB: ${MONGO_URL ? 'Connected' : 'Not configured'}`);
  console.log(`📧 SMTP: ${process.env.SMTP_HOST || 'Not configured'}`);
  console.log(`🔌 Socket.IO: Enabled`);
  console.log(`🌍 CORS Origins: ${FRONTEND_ORIGIN}`);
  try {
    const addr = server.address();
    console.log('🔍 Server address:', addr);
  } catch (e) {
    console.warn('🔍 Could not read server.address()', e && e.message ? e.message : e);
  }
});

// Listen for server errors (for example, EACCES or EADDRINUSE)
server.on('error', (err) => {
  console.error('❌ Server error event:', err && err.message ? err.message : err);
  if (err && err.code) console.error('❌ Server error code:', err.code);
});

// Global exception handlers to help debug crashes in CI or developer machines
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err && err.stack ? err.stack : err);
  // keep process alive for debugging; in production you may want to exit
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, server, io };
