const express = require('express');
const router = express.Router();
const Y = require('yjs');
const { loadSnapshot, persistSnapshot } = require('../replicate.cjs');
const { ObjectId } = require('../db/mongo.cjs');


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
    // persist using replicate helper
    await persistSnapshot(workspaceId, buf, null);
    // also attempt to bump version on workspace document if exists
    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io) {
        // emit full snapshot to workspace room
        io.to(`workspace:${workspaceId}`).emit('workspace:full', { workspaceId, snapshot: true });
      }
    } catch (e) {
      console.warn('emit snapshot failed', e.message);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('POST /saveSnapshot error', e);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
