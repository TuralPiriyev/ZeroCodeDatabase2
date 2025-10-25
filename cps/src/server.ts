import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { createDatabase, listDatabases } from './controllers/databasesController';
import { provisionUser, revokeUser, rotateUser } from './controllers/usersController';
import { login, logout } from './controllers/authController';
import { requireAdmin } from './middleware/auth';
import { requireCsrf } from './middleware/csrf';

import path from 'path';

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Simple admin auth middleware
// parse cookies (simple)
import cookieParser from 'cookie-parser';
app.use(cookieParser());

// Keep health and static open; auth required for admin endpoints
app.use((req, res, next) => {
  if (req.path.startsWith('/health') || req.path.startsWith('/cps/frontend') || req.path.startsWith('/cps/snippets')) return next();
  return next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/databases', requireAdmin, requireCsrf, createDatabase);
app.get('/api/databases', listDatabases);
app.post('/api/databases/:dbId/provision-user', requireAdmin, requireCsrf, provisionUser);
app.post('/api/databases/:dbId/revoke-user', requireAdmin, requireCsrf, revokeUser);
app.post('/api/databases/:dbId/rotate-user', requireAdmin, requireCsrf, rotateUser);

// Auth endpoints
app.post('/api/auth/login', login);
app.post('/api/auth/logout', requireAdmin, logout);
app.get('/api/csrf-token', requireAdmin, (req, res) => { res.json({ csrf: (req as any).user?.csrf }); });
app.get('/api/audit', require('./controllers/auditController').listAudit);
app.get('/api/audit/export', require('./controllers/auditController').exportAudit);
app.get('/api/metrics', require('./controllers/auditController').metrics);
// serve snippets and frontend static files
app.use('/cps/snippets', express.static(path.join(__dirname, '..', 'snippets')));
app.use('/cps/frontend', express.static(path.join(__dirname, '..', 'frontend')));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`CPS server listening on ${port}`);
});
