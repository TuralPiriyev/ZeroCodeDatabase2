const express = require('express');
const router = express.Router();
const Y = require('yjs');
const { loadSnapshot, persistSnapshot } = require('../replicate.cjs');

router.get('/:id/snapshot', async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const buf = await loadSnapshot(workspaceId);
    if (!buf) return res.status(404).json({ error: 'No snapshot' });
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.send(buf);
  } catch (e) {
    console.error('GET /snapshot error', e);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/:id/saveSnapshot', async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const body = req.body;
    if (!body || !body.state) return res.status(400).json({ error: 'state required' });
    const buf = Buffer.isBuffer(body.state) ? body.state : Buffer.from(body.state, 'base64');
    await persistSnapshot(workspaceId, buf, null);
    res.json({ success: true });
  } catch (e) {
    console.error('POST /saveSnapshot error', e);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
