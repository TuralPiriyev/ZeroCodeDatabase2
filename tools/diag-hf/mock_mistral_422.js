// Mock server that simulates Mistral validation (422) for payloads containing `parameters` or to force messages->422
const express = require('express');
const app = express();
app.use(express.json());

app.post('/mistral.ai/chat/completions', (req, res) => {
  const body = req.body || {};
  // If client accidentally sends `parameters` top-level -> 422 (original issue)
  if (body.parameters) {
    return res.status(422).json({ object: 'error', message: { detail: [{ type: 'extra_forbidden', loc: ['body','parameters'], msg: 'Extra inputs are not permitted', input: body.parameters }] }, type: 'invalid_request_error' });
  }

  // If messages present and query ?mode=force_msg_422 -> return 422 to simulate provider wanting `input` instead
  if (body.messages && (req.query.mode === 'force_msg_422')) {
    return res.status(422).json({ object: 'error', message: { detail: [{ type: 'invalid_messages', loc: ['body','messages'], msg: 'Messages not accepted in this mode' }] }, type: 'invalid_request_error' });
  }

  // If input present -> success
  if (body.input) {
    return res.json({ object: 'response', output: [{ generated_text: 'fallback OK: ' + String(body.input).slice(0,120) }] });
  }

  // Otherwise if messages present -> success echo
  if (body.messages) {
    const flat = Array.isArray(body.messages) ? body.messages.map(m => m.content || '').join('\n') : JSON.stringify(body.messages);
    return res.json({ object: 'response', output: [{ generated_text: 'ok: ' + String(flat).slice(0,120) }] });
  }

  return res.json({ object: 'response', output: [{ generated_text: 'ok default' }] });
});

if (require.main === module) {
  const port = process.env.PORT || 8088;
  app.listen(port, () => console.log('Mock Mistral server listening on', port));
}

module.exports = app;
