// Simple express mock server to simulate HF inference statuses
const express = require('express');
const app = express();
app.use(express.json());

app.post('/models/:owner/:model', async (req, res) => {
  const mode = req.query.mode || 'ok';
  if (mode === 'ok') {
    return res.json({ generated_text: 'ok' });
  }
  if (mode === 'slow') {
    await new Promise(r => setTimeout(r, 5000));
    return res.json({ generated_text: 'slow' });
  }
  if (mode === '503') {
    return res.status(503).send({ error: 'Service temporarily unavailable' });
  }
  if (mode === '429') {
    res.setHeader('Retry-After', '3');
    return res.status(429).send({ error: 'Rate limited' });
  }
  return res.status(500).send({ error: 'unknown mode' });
});

if (require.main === module) {
  const port = process.env.PORT || 8088;
  app.listen(port, () => console.log('Mock HF server listening on', port));
}

module.exports = app;
