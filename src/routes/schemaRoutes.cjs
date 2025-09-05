const express = require('express');
const router = express.Router();
const SchemaModel = require('../models/Schema.cjs');
const Workspace = require('../models/Workspace.cjs');
const Member = require('../models/Member.cjs');
const { v4: uuidv4 } = require('uuid');

// Create new schema (personal or shared)
router.post('/', async (req, res) => {
  try {
    const { name, tables, relationships, isShared, teamId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const doc = new SchemaModel({ name, tables: JSON.stringify(tables || {}), relationships: JSON.stringify(relationships || {}), ownerUserId: req.userId || null });

    if (isShared) {
      doc.isShared = true;
      doc.teamId = teamId;
      doc.sharedId = uuidv4();
    }

    await doc.save();
    res.status(201).json({ success: true, schema: doc });
  } catch (e) {
    console.error('POST /api/schemas error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update existing schema by id or sharedId
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, tables, relationships, isShared, teamId, updatedAt } = req.body;

    // Find by _id first, fallback to sharedId
    let existing = await SchemaModel.findOne({ _id: id });
    if (!existing) existing = await SchemaModel.findOne({ sharedId: id });
    if (!existing) return res.status(404).json({ error: 'Schema not found' });

    // If target is shared, ensure we update the canonical doc instead of creating new
    if (existing.isShared || isShared) {
      // Permission: owner or member of team
      const team = existing.teamId || teamId;
      if (!team) return res.status(400).json({ error: 'Missing teamId for shared schema' });

      // Check membership: allow owner or Member entry
      const isOwner = existing.ownerUserId && String(existing.ownerUserId) === String(req.userId);
      const member = await Member.findOne({ workspaceId: team, $or: [{ userId: req.userId }, { username: req.user && req.user.username }] }).lean();
      if (!isOwner && !member) return res.status(403).json({ error: 'Forbidden' });

      // Concurrency check via updatedAt
      if (updatedAt && new Date(updatedAt).getTime() !== new Date(existing.updatedAt).getTime()) {
        return res.status(409).json({ error: 'Conflict', serverUpdatedAt: existing.updatedAt });
      }

      // Apply updates
      const changed = {};
      if (typeof name !== 'undefined' && name !== existing.name) { changed.name = true; existing.name = name; }
      if (typeof tables !== 'undefined') { existing.tables = JSON.stringify(tables); changed.tables = true; }
      if (typeof relationships !== 'undefined') { existing.relationships = JSON.stringify(relationships); changed.relationships = true; }
      if (typeof teamId !== 'undefined') existing.teamId = teamId;
      existing.updatedAt = new Date();
      await existing.save();

      // Emit socket event to team room
      const io = req.app.get('io');
      if (io && existing.teamId) {
        io.to(`team:${existing.teamId}`).emit('schemaUpdated', { schemaId: existing._id, sharedId: existing.sharedId, teamId: existing.teamId, updatedAt: existing.updatedAt, changedFields: Object.keys(changed) });
      }

      return res.json({ success: true, schema: existing });
    }

    // Non-shared: only owner may update
    if (existing.ownerUserId && String(existing.ownerUserId) !== String(req.userId)) return res.status(403).json({ error: 'Forbidden' });

    // Concurrency check
    if (updatedAt && new Date(updatedAt).getTime() !== new Date(existing.updatedAt).getTime()) {
      return res.status(409).json({ error: 'Conflict', serverUpdatedAt: existing.updatedAt });
    }

    if (typeof name !== 'undefined') existing.name = name;
    if (typeof tables !== 'undefined') existing.tables = JSON.stringify(tables);
    if (typeof relationships !== 'undefined') existing.relationships = JSON.stringify(relationships);
    existing.updatedAt = new Date();
    await existing.save();
    return res.json({ success: true, schema: existing });
  } catch (e) {
    console.error('PUT /api/schemas/:id error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
