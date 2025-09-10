// Entry point for the AI DBQuery service
// Note: ensure OPENAI_API_KEY is set in the environment or hosting secrets.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dbqueryRouter = require('./api/dbquery');

const PORT = process.env.PORT || 3000;

// Allow requests from frontend origin if provided, otherwise allow all for now.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));

// Mount the router at /api/ai so the router can define /dbquery
app.use('/api/ai', dbqueryRouter);

app.get('/_health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`AI DBQuery service listening on port ${PORT}`);
  console.log(`Mounted POST /api/ai/dbquery`);
});
