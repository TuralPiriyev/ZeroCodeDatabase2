// Entry point for the AI DBQuery service
// Note: ensure OPENAI_API_KEY is set in the environment or hosting secrets.
require('dotenv').config();
const express = require('express');
const app = express();
const dbqueryRouter = require('./api/dbquery');

const PORT = process.env.PORT || 3000;

app.use('/api/ai/dbquery', dbqueryRouter);

app.get('/_health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`AI DBQuery service listening on port ${PORT}`);
});
