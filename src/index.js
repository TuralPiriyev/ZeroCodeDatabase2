// Entry point for the AI DBQuery service
// Note: ensure OPENAI_API_KEY is set in the environment or hosting secrets.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dbqueryRouter = require('./api/dbquery.cjs');

const PORT = process.env.PORT || 3000;

// Allow requests from frontend origin if provided, otherwise allow all for now.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));

// Dev-only request logger
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    try { console.log('[REQ]', req.method, req.originalUrl); } catch (e) {}
    next();
  });
}

// Mount the router at /api/ai so the router can define /dbquery
app.use('/api/ai', dbqueryRouter);

// Dev-only route enumeration
if (process.env.NODE_ENV === 'development') {
  try {
    const routes = (app._router && app._router.stack)
      ? app._router.stack.filter(r => r && r.route).map(r => Object.keys(r.route.methods).join(',').toUpperCase() + ' ' + r.route.path)
      : [];
    console.log('Registered routes:', routes);
  } catch (e) {}
}

// Dev-only unmatched request catcher for debugging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    // If no route matched, this will run; log minimal info and return JSON
    // Note: keep secret data out of logs
    res.status(404).json({ error: 'API endpoint not found (dev)', path: req.originalUrl, method: req.method });
  });
}

app.get('/_health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`AI DBQuery service listening on port ${PORT}`);
  console.log(`Mounted POST /api/ai/dbquery`);
});
