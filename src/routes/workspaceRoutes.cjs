const express = require('express');
const mongoose = require('mongoose');
const Workspace = require('../models/Workspace.cjs');
const User = require('../models/User.cjs');
const Member = require('../models/Member.cjs');
const { authenticate } = require('../middleware/auth.cjs');
// Single module-level helper to escape strings used in RegExp constructors
const escapeForRegex = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

const router = express.Router();

  // use module-level escapeForRegex

// GET /api/workspaces - Get all workspaces for current user
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('📂 Fetching workspaces for user:', req.userId);
  // Find workspaces where user is owner OR has a member record
  const mongoose = require('mongoose');
  let ownerWorkspaces = [];
  try {
    // Search for ownerId stored either as string or as an ObjectId
    const orOwner = [{ ownerId: req.userId }, { ownerId: mongoose.Types.ObjectId(String(req.userId)) }];
    ownerWorkspaces = await Workspace.find({ $or: orOwner, isActive: true }).sort({ updatedAt: -1 });
  } catch (e) {
    // Fallback: simple string match
    ownerWorkspaces = await Workspace.find({ ownerId: req.userId, isActive: true }).sort({ updatedAt: -1 });
  }
  // Build a set of possible identifiers for the current user: userId, username, email
  const identifiers = [];
  if (req.userId) identifiers.push(String(req.userId));
  if (req.user && req.user.username) identifiers.push(String(req.user.username));
  if (req.user && req.user.email) identifiers.push(String(req.user.email));

  // use module-level escapeForRegex

  // Use case-insensitive matching for username/email and exact match for userId so invited users see their workspaces
    let memberRecords = [];
  if (identifiers.length > 0) {
    // Build $or clauses that include userId exact matches and username regex matches
    const orClauses = identifiers.flatMap(id => [
      { userId: id },
      { username: new RegExp('^' + escapeForRegex(id) + '$', 'i') }
    ]);
    memberRecords = await Member.find({ $or: orClauses }).distinct('workspaceId');
    // Normalize to strings so we can compare against Workspace.id (which is a string)
    memberRecords = (memberRecords || []).map(r => String(r));
  }
  const memberWorkspaces = await Workspace.find({ id: { $in: memberRecords }, isActive: true }).sort({ updatedAt: -1 });

  // Merge unique workspaces (owner first)
  const workspacesMap = new Map();
  ownerWorkspaces.forEach(w => workspacesMap.set(w.id, w));
  memberWorkspaces.forEach(w => { if (!workspacesMap.has(w.id)) workspacesMap.set(w.id, w); });
  const workspaces = Array.from(workspacesMap.values());

    console.log('✅ Found workspaces:', workspaces.length);
    // Attach current user's role for each workspace
  const workspaceIds = workspaces.map(w => String(w.id));
  // build an $in array that contains both string ids and ObjectId forms (for migrated records)
  const workspaceIdObjs = workspaceIds.filter(id => /^[0-9a-fA-F]{24}$/.test(id)).map(id => mongoose.Types.ObjectId(id));
  const workspaceInValues = [...workspaceIds, ...workspaceIdObjs];
  let membersForWorkspaces = await Member.find({ workspaceId: { $in: workspaceInValues } }).lean();
  // normalize member.workspaceId to string for easier comparisons
  membersForWorkspaces = (membersForWorkspaces || []).map(m => ({ ...m, workspaceId: String(m.workspaceId) }));
    const usernameLookup = req.user && req.user.username ? req.user.username : null;

    const workspacesOut = workspaces.map(w => {
      const obj = w.toObject();
      let role = 'viewer';
      // Owner check (ownerId may be ObjectId or username)
      const isOwner = obj.ownerId && (obj.ownerId.toString ? obj.ownerId.toString() === req.userId : obj.ownerId === usernameLookup || obj.ownerId === req.userId);
      if (isOwner) role = 'owner';
      else if (usernameLookup) {
        const memberRec = membersForWorkspaces.find(m => m.workspaceId === obj.id && m.username.toLowerCase() === usernameLookup.toLowerCase());
        if (memberRec && memberRec.role) role = memberRec.role;
      }
      // include a membersCount and role for convenience
      const membersCount = membersForWorkspaces.filter(m => m.workspaceId === obj.id).length;
      return { ...obj, role, membersCount };
    });

    res.json(workspacesOut);
  } catch (error) {
    console.error('❌ Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/workspaces/:workspaceId - Get specific workspace
router.get('/:workspaceId', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    console.log('📂 Fetching workspace:', workspaceId);
    
    const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
    if (!workspace) {
      console.log('❌ Workspace not found:', workspaceId);
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check membership via Member collection using multiple identifiers (userId, username, email)
    const identifiers = [];
    if (req.userId) identifiers.push(String(req.userId));
    if (req.user && req.user.username) identifiers.push(String(req.user.username));
    if (req.user && req.user.email) identifiers.push(String(req.user.email));
    let memberRecord = null;
    if (identifiers.length > 0) {
      // Build $or clauses for userId and username regex
      const orClauses = identifiers.flatMap(id => [
        { userId: id },
        { username: new RegExp('^' + escapeForRegex(id) + '$', 'i') }
      ]);
      // First try matching workspaceId as a string
      memberRecord = await Member.findOne({ workspaceId, $or: orClauses });
      // If not found, try matching workspaceId as an ObjectId (for migrated records)
      if (!memberRecord) {
        try {
          const mongoose = require('mongoose');
          if (/^[0-9a-fA-F]{24}$/.test(String(workspaceId))) {
            const objId = mongoose.Types.ObjectId(String(workspaceId));
            memberRecord = await Member.findOne({ workspaceId: objId, $or: orClauses });
          }
        } catch (e) {
          // ignore invalid ObjectId or lookup errors
        }
      }
    }
  // ownerId might be userId (ObjectId) or username (string) depending on historical data
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  if (!memberRecord && !isOwner) {
      console.log('❌ Access denied for workspace:', workspaceId);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Assemble members list from Member collection
    const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
    const out = workspace.toObject();
    out.members = members || [];

    // If client requested a specific shared schema via query param, include it directly
    const requestedSchemaId = req.query && req.query.schemaId ? String(req.query.schemaId) : null;
    if (requestedSchemaId && out.sharedSchemas && Array.isArray(out.sharedSchemas)) {
      const found = out.sharedSchemas.find(s => s.schemaId === requestedSchemaId);
      if (found) {
        out.selectedSchema = { schemaId: found.schemaId, name: found.name, scripts: found.scripts, lastModified: found.lastModified };
      }
    }

    console.log('✅ Workspace found and accessible:', workspace.name);
    res.json(out);
  } catch (error) {
    console.error('❌ Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// GET /api/workspaces/:workspaceId/members - Get workspace members
router.get('/:workspaceId/members', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    console.log('👥 Fetching members for workspace:', workspaceId);
  const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const identifiers = [];
  if (req.userId) identifiers.push(String(req.userId));
  if (req.user && req.user.username) identifiers.push(String(req.user.username));
  if (req.user && req.user.email) identifiers.push(String(req.user.email));
  // use module-level escapeForRegex
  let memberRecord = null;
  if (identifiers.length > 0) {
    const orClauses = identifiers.flatMap(id => [ { userId: id }, { username: new RegExp('^' + escapeForRegex(id) + '$', 'i') } ]);
    memberRecord = await Member.findOne({ workspaceId, $or: orClauses });
  }
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  if (!memberRecord && !isOwner) return res.status(403).json({ error: 'Access denied' });

  const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
  console.log('✅ Members found:', members.length);
  res.json({ members });
  } catch (error) {
    console.error('❌ Error fetching workspace members:', error);
    res.status(500).json({ error: 'Failed to fetch workspace members' });
  }
});

// POST /api/workspaces/:workspaceId/invite - Invite user to workspace
router.post('/:workspaceId/invite', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { username, role } = req.body;

    console.log('📤 Processing invitation:', { workspaceId, username, role });

    if (!username || !role) {
      return res.status(400).json({ error: 'Username and role are required' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either editor or viewer' });
    }

    // Find workspace
    const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  // Check if requester is owner or editor via Member collection
  const identifiers = [];
  if (req.userId) identifiers.push(String(req.userId));
  if (req.user && req.user.username) identifiers.push(String(req.user.username));
  if (req.user && req.user.email) identifiers.push(String(req.user.email));
  // use module-level escapeForRegex
  let requesterMember = null;
  if (identifiers.length > 0) {
    const or = identifiers.map(id => ({ username: new RegExp('^' + escapeForRegex(id) + '$', 'i') }));
    requesterMember = await Member.findOne({ workspaceId, $or: or });
  }
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
    if ((!requesterMember || (requesterMember.role !== 'owner' && requesterMember.role !== 'editor')) && !isOwner) {
      return res.status(403).json({ error: 'Only owners and editors can invite users' });
    }

    // Validate that username exists in Users collection and fetch invited user if available
    let invitedUser = null;
    try {
      if (mongoose.connection.readyState === 1) {
        invitedUser = await User.findOne({ username });
        console.log('👤 User validation result:', { username, exists: !!invitedUser });
        if (!invitedUser) return res.status(404).json({ error: 'User not found' });
      } else {
        console.log('📡 MongoDB not connected, allowing invitation for development');
      }
    } catch (error) {
      console.warn('⚠️ User validation failed, continuing for development:', error);
    }

  // Check if user is already a member (case-insensitive) — try matching by userId or username
  // use module-level escapeForRegex
  let existingMember = null;
  const invitedUserId = invitedUser ? String(invitedUser._id) : null;
  if (invitedUserId) {
    existingMember = await Member.findOne({ workspaceId, $or: [{ userId: invitedUserId }, { username: new RegExp('^' + escapeForRegex(username) + '$', 'i') }] });
  } else {
    existingMember = await Member.findOne({ workspaceId, username: new RegExp('^' + escapeForRegex(username) + '$', 'i') });
  }
  if (existingMember) return res.status(409).json({ error: 'User is already a member of this workspace' });

    // Add member record
    const newMember = new Member({
      workspaceId,
      id: require('uuid').v4(),
      userId: invitedUser ? String(invitedUser._id) : undefined,
      username,
      role,
      joinedAt: new Date(),
      updatedAt: new Date()
    });
    await newMember.save();
    console.log('✅ User successfully added to workspace:', newMember.username);

    // Update denormalized members in Workspace document as well
    try {
      workspace.members = workspace.members || [];
      workspace.members.push({ username: newMember.username, userId: newMember.userId, role: newMember.role, joinedAt: newMember.joinedAt });
      workspace.updatedAt = new Date();
      await workspace.save();
    } catch (e) {
      console.warn('Failed to update workspace.members on invite:', e);
    }

    // Emit real-time event to workspace members
    const io = req.app.get('io');
    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) {
      emitToWorkspace(workspaceId, 'member_added', {
        username: newMember.username,
        role: newMember.role,
        joinedAt: newMember.joinedAt.toISOString()
      });
    }

    // Also notify the invited user directly if they are online via socket (userSockets map in server)
    try {
      const server = req.app.get('serverInstance') || null; // optional
      // access io and server-side userSockets map if available
      const io = req.app.get('io');
      // server.cjs keeps a module-level userSockets map; expose via app if available
      const userSockets = req.app.get('userSockets');
      if (userSockets && userSockets.has(username)) {
        const sockets = userSockets.get(username);
        sockets.forEach(sid => {
          try {
            io.to(sid).emit('workspace_invite', { workspaceId, workspaceName: workspace.name, invitedBy: req.user && req.user.username ? req.user.username : null });
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (e) {
      // non-fatal
      console.warn('Failed to emit direct workspace invite via sockets:', e);
    }

    // Return updated members array
    const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
    res.json({
      success: true,
      message: `${username} has been invited to the workspace`,
      members
    });

  } catch (error) {
    console.error('❌ Error inviting user to workspace:', error);
    res.status(500).json({ error: 'Failed to invite user to workspace' });
  }
});

// PUT /api/workspaces/:workspaceId/members/:username - Update member role
router.put('/:workspaceId/members/:username', authenticate, async (req, res) => {
  try {
    const { workspaceId, username } = req.params;
    const { role } = req.body;

    console.log('👤 Updating member role:', { workspaceId, username, role });

    if (!role || !['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required' });
    }

  const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const identifiers = [];
  if (req.userId) identifiers.push(String(req.userId));
  if (req.user && req.user.username) identifiers.push(String(req.user.username));
  if (req.user && req.user.email) identifiers.push(String(req.user.email));
  // use module-level escapeForRegex
  let requesterMember = null;
  if (identifiers.length > 0) {
    const or = identifiers.map(id => ({ username: new RegExp('^' + escapeForRegex(id) + '$', 'i') }));
    requesterMember = await Member.findOne({ workspaceId, $or: or });
  }
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  if ((!requesterMember || requesterMember.role !== 'owner') && !isOwner) return res.status(403).json({ error: 'Only workspace owners can update member roles' });

  const memberToUpdate = await Member.findOne({ workspaceId, username: new RegExp('^' + escapeForRegex(username) + '$', 'i') });
  if (!memberToUpdate) return res.status(404).json({ error: 'Member not found' });
  if (memberToUpdate.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' });

  memberToUpdate.role = role;
  memberToUpdate.updatedAt = new Date();
  await memberToUpdate.save();

  console.log('✅ Member role updated successfully');
  const emitToWorkspace = req.app.get('emitToWorkspace');
  if (emitToWorkspace) emitToWorkspace(workspaceId, 'member_updated', { username: memberToUpdate.username, role: memberToUpdate.role });

  // Update denormalized workspace.members
  try {
    const ws = await Workspace.findOne({ id: workspaceId });
    if (ws && ws.members) {
      ws.members = ws.members.map(m => (m.username && m.username.toLowerCase() === memberToUpdate.username.toLowerCase()) ? { username: m.username, userId: m.userId, role: memberToUpdate.role, joinedAt: m.joinedAt } : m);
      ws.updatedAt = new Date();
      await ws.save();
    }
  } catch (e) {
    console.warn('Failed to update workspace.members after role change:', e);
  }

  const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
  res.json({ success: true, message: `${username} role updated to ${role}`, members });

  } catch (error) {
    console.error('❌ Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/workspaces/:workspaceId/members/:username - Remove member
router.delete('/:workspaceId/members/:username', authenticate, async (req, res) => {
  try {
    const { workspaceId, username } = req.params;

    console.log('🗑️ Removing member:', { workspaceId, username });

  const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  // Check if requester is owner via Member collection
  const identifiers = [];
  if (req.userId) identifiers.push(String(req.userId));
  if (req.user && req.user.username) identifiers.push(String(req.user.username));
  if (req.user && req.user.email) identifiers.push(String(req.user.email));
  // use module-level escapeForRegex
  let requesterMember = null;
  if (identifiers.length > 0) {
    const or = identifiers.map(id => ({ username: new RegExp('^' + escapeForRegex(id) + '$', 'i') }));
    requesterMember = await Member.findOne({ workspaceId, $or: or });
  }
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  if ((!requesterMember || requesterMember.role !== 'owner') && !isOwner) return res.status(403).json({ error: 'Only workspace owners can remove members' });

  const memberToRemove = await Member.findOne({ workspaceId, username: new RegExp('^' + escapeForRegex(username) + '$', 'i') });
  if (!memberToRemove) return res.status(404).json({ error: 'Member not found' });
  if (memberToRemove.role === 'owner') return res.status(400).json({ error: 'Cannot remove workspace owner' });

  await Member.deleteOne({ workspaceId, username: new RegExp('^' + escapeForRegex(username) + '$', 'i') });

  console.log('✅ Member removed successfully');
  const emitToWorkspace = req.app.get('emitToWorkspace');
  if (emitToWorkspace) emitToWorkspace(workspaceId, 'member_removed', { username });

  // Also remove from workspace.members denormalized list
  try {
    const ws = await Workspace.findOne({ id: workspaceId });
    if (ws && ws.members) {
      ws.members = ws.members.filter(m => !(m.username && m.username.toLowerCase() === username.toLowerCase()));
      ws.updatedAt = new Date();
      await ws.save();
    }
  } catch (e) {
    console.warn('Failed to remove member from workspace.members:', e);
  }

  const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
  res.json({ success: true, message: `${username} has been removed from the workspace`, members });

  } catch (error) {
    console.error('❌ Error removing member from workspace:', error);
    res.status(500).json({ error: 'Failed to remove member from workspace' });
  }
});

// POST /api/workspaces/:workspaceId/transfer-owner - Transfer ownership to another member
router.post('/:workspaceId/transfer-owner', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { toUsername } = req.body;

    if (!toUsername) return res.status(400).json({ error: 'toUsername is required' });

    const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const identifiers = [];
  if (req.userId) identifiers.push(String(req.userId));
  if (req.user && req.user.username) identifiers.push(String(req.user.username));
  if (req.user && req.user.email) identifiers.push(String(req.user.email));
  // use module-level escapeForRegex
  let requesterMember = null;
  if (identifiers.length > 0) {
    const or = identifiers.map(id => ({ username: new RegExp('^' + escapeForRegex(id) + '$', 'i') }));
    requesterMember = await Member.findOne({ workspaceId, $or: or });
  }
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  if ((!requesterMember || requesterMember.role !== 'owner') && !isOwner) return res.status(403).json({ error: 'Only workspace owners can transfer ownership' });

  const newOwnerMember = await Member.findOne({ workspaceId, username: new RegExp('^' + escapeForRegex(toUsername) + '$', 'i') });
    if (!newOwnerMember) return res.status(404).json({ error: 'Target member not found' });
    if (newOwnerMember.role === 'owner') return res.status(400).json({ error: 'User is already the owner' });

    // Update roles: demote current owner to editor, promote target to owner
    // Attempt to set workspace.ownerId to the User._id of the new owner when possible
    try {
      const newOwnerUser = await User.findOne({ username: newOwnerMember.username });
      if (newOwnerUser && newOwnerUser._id) {
        workspace.ownerId = newOwnerUser._id;
      } else {
        // fallback to username if User._id not available
        workspace.ownerId = newOwnerMember.username;
      }
    } catch (err) {
      workspace.ownerId = newOwnerMember.username;
    }
    workspace.updatedAt = new Date();
    await workspace.save();

    // Update Member docs
    await Member.updateOne({ workspaceId, username: requesterMember.username }, { $set: { role: 'editor', updatedAt: new Date() } });
    newOwnerMember.role = 'owner';
    newOwnerMember.updatedAt = new Date();
    await newOwnerMember.save();

    // Emit events
    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) {
      emitToWorkspace(workspaceId, 'member_updated', { username: requesterMember.username, role: 'editor' });
      emitToWorkspace(workspaceId, 'member_updated', { username: newOwnerMember.username, role: 'owner' });
      emitToWorkspace(workspaceId, 'owner_changed', { newOwner: newOwnerMember.username });
    }

    const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
    res.json({ success: true, message: `Ownership transferred to ${newOwnerMember.username}`, members });
  } catch (error) {
    console.error('❌ Error transferring workspace ownership:', error);
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

// POST /api/workspaces/:workspaceId/schemas - Update shared schemas (atomic upsert)
// This endpoint will upsert a canonical SharedSchema document keyed by { workspaceId, schemaId }
router.post('/:workspaceId/schemas', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { schemaId, name, scripts } = req.body;

    console.log('📊 Updating shared schema:', { workspaceId, schemaId, name });

    if (!schemaId || !name || !scripts) {
      return res.status(400).json({ error: 'Schema ID, name, and scripts are required' });
    }

  const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const identifiers = [];
    if (req.userId) identifiers.push(String(req.userId));
    if (req.user && req.user.username) identifiers.push(String(req.user.username));
    if (req.user && req.user.email) identifiers.push(String(req.user.email));
    // use module-level escapeForRegex
    let member = null;
    if (identifiers.length > 0) {
      // match either userId exact or username case-insensitive so legacy/migrated records match
      const orClauses = identifiers.flatMap(id => [ { userId: id }, { username: new RegExp('^' + escapeForRegex(id) + '$', 'i') } ]);
      member = await Member.findOne({ workspaceId, $or: orClauses });
      // fallback: some Member.workspaceId fields may be stored as ObjectId in migrated data
      if (!member) {
        try {
          const mongoose = require('mongoose');
          if (/^[0-9a-fA-F]{24}$/.test(String(workspaceId))) {
            const objId = mongoose.Types.ObjectId(String(workspaceId));
            member = await Member.findOne({ workspaceId: objId, $or: orClauses });
          }
        } catch (e) {
          // ignore invalid ObjectId or lookup errors
        }
      }
    }
  const usernameLookup = req.user && req.user.username ? req.user.username : null;
  const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  const canUpdate = isOwner || (member && (member.role === 'owner' || member.role === 'editor'));
  if (!canUpdate) return res.status(403).json({ error: 'Only workspace owners or editors can update shared schemas' });

    // Use a dedicated SharedSchema collection for canonical upsert and versioning
    const SharedSchemaModel = require('../models/SharedSchema.cjs');

    // Prevent unauthorized users from replacing an existing shared schema
    const existing = await SharedSchemaModel.findOne({ workspaceId, schemaId }).lean();
    if (existing && !(isOwner || (member && (member.role === 'owner' || member.role === 'editor')))) {
      return res.status(403).json({ error: 'Only workspace owners or editors can replace an existing shared schema' });
    }

    // Reject client attempts to "create new" a shared schema by supplying a different workspaceId
    if (req.body.createNew) {
    return res.status(400).json({ error: 'Cannot create new canonical document for a shared schema; use canonical workspaceId' });
    }

    // Prepare upsert update: set fields, increment version atomically
    const update = {
      $set: {
        workspaceId,
        schemaId,
        name: String(name),
        scripts: String(scripts),
        lastModified: new Date(),
        shared: true
      },
      $inc: { version: 1 }
    };
    const opts = { upsert: true, new: true };
    const saved = await SharedSchemaModel.findOneAndUpdate({ workspaceId, schemaId }, update, opts).exec();

    // Log saved identity for traceability
    try {
      console.log(`Saved shared schema workspaceId=${workspaceId} schemaId=${schemaId} _id=${saved._id} version=${saved.version}`);
    } catch (e) {
      // ignore logging errors
    }

    // Also keep denormalized copy inside Workspace.sharedSchemas for backwards compatibility
    try {
      workspace.sharedSchemas = workspace.sharedSchemas || [];
      const idx = workspace.sharedSchemas.findIndex(s => s.schemaId === schemaId);
      const entry = { schemaId, name: String(name), scripts: String(scripts), lastModified: saved.lastModified };
      if (idx >= 0) workspace.sharedSchemas[idx] = entry; else workspace.sharedSchemas.push(entry);
      workspace.updatedAt = new Date();
      await workspace.save();
    } catch (e) {
      console.warn('Failed to update denormalized workspace.sharedSchemas:', e);
    }

    // Emit workspace-updated event with minimal metadata to workspace room
    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) {
      emitToWorkspace(workspaceId, 'workspace-updated', { workspaceId, schemaId, version: saved.version, lastModified: saved.lastModified });
    }

    res.json({ success: true, message: 'Schema updated successfully', sharedSchema: saved });

  } catch (error) {
    console.error('❌ Error updating shared schemas:', error);
    res.status(500).json({ error: 'Failed to update shared schemas' });
  }
});

// PUT /api/workspaces/:workspaceId/schemas - also support update via PUT (mirrors POST)
// Mirrors POST but enforces upsert semantics and emits workspace-updated
router.put('/:workspaceId/schemas', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { schemaId, name, scripts } = req.body;

    console.log('📊 (PUT) Updating shared schema:', { workspaceId, schemaId, name });

    if (!schemaId || !name || !scripts) {
      return res.status(400).json({ error: 'Schema ID, name, and scripts are required' });
    }

    const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const identifiers = [];
    if (req.userId) identifiers.push(String(req.userId));
    if (req.user && req.user.username) identifiers.push(String(req.user.username));
    if (req.user && req.user.email) identifiers.push(String(req.user.email));
    const escapeForRegex = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    let member = null;
    if (identifiers.length > 0) {
      const orClauses = identifiers.flatMap(id => [ { userId: id }, { username: new RegExp('^' + escapeForRegex(id) + '$', 'i') } ]);
      member = await Member.findOne({ workspaceId, $or: orClauses });
      if (!member) {
        try {
          const mongoose = require('mongoose');
          if (/^[0-9a-fA-F]{24}$/.test(String(workspaceId))) {
            const objId = mongoose.Types.ObjectId(String(workspaceId));
            member = await Member.findOne({ workspaceId: objId, $or: orClauses });
          }
        } catch (e) {
          // ignore
        }
      }
    }
    const usernameLookup = req.user && req.user.username ? req.user.username : null;
    const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
  const canUpdate = isOwner || (member && (member.role === 'owner' || member.role === 'editor'));
  if (!canUpdate) return res.status(403).json({ error: 'Only workspace owners or editors can update shared schemas' });

    const SharedSchemaModel = require('../models/SharedSchema.cjs');
  const existing = await SharedSchemaModel.findOne({ workspaceId, schemaId }).lean();
  if (existing && !(isOwner || (member && (member.role === 'owner' || member.role === 'editor')))) return res.status(403).json({ error: 'Only workspace owners or editors can replace an existing shared schema' });

    const update = {
      $set: { workspaceId, schemaId, name: String(name), scripts: String(scripts), lastModified: new Date(), shared: true },
      $inc: { version: 1 }
    };
    const opts = { upsert: true, new: true };
    const saved = await SharedSchemaModel.findOneAndUpdate({ workspaceId, schemaId }, update, opts).exec();

    // keep denormalized list on Workspace
    try {
      workspace.sharedSchemas = workspace.sharedSchemas || [];
      const idx = workspace.sharedSchemas.findIndex(s => s.schemaId === schemaId);
      const entry = { schemaId, name: String(name), scripts: String(scripts), lastModified: saved.lastModified };
      if (idx >= 0) workspace.sharedSchemas[idx] = entry; else workspace.sharedSchemas.push(entry);
      workspace.updatedAt = new Date();
      await workspace.save();
    } catch (e) {
      console.warn('Failed to update denormalized workspace.sharedSchemas (PUT):', e);
    }

    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) emitToWorkspace(workspaceId, 'workspace-updated', { workspaceId, schemaId, version: saved.version, lastModified: saved.lastModified });

    res.json({ success: true, message: 'Schema updated successfully', sharedSchema: saved });
  } catch (error) {
    console.error('❌ Error updating shared schemas (PUT):', error);
    res.status(500).json({ error: 'Failed to update shared schemas' });
  }
});

// POST /api/workspaces - Create new workspace
router.post('/', authenticate, async (req, res) => {
  try {
    const { id, name, sharedSchema } = req.body;
    
    console.log('🏗️ Creating workspace:', { id, name, hasSharedSchema: !!sharedSchema });

    if (!id || !name) {
      return res.status(400).json({ error: 'Workspace ID and name are required' });
    }

    const existingWorkspace = await Workspace.findOne({ id });
    if (existingWorkspace) {
      return res.status(409).json({ error: 'Workspace with this ID already exists' });
    }

    // Prepare initial sharedSchemas array if a sharedSchema was provided during creation
    const initialSharedSchemas = [];
    if (sharedSchema && sharedSchema.schemaId && sharedSchema.name && sharedSchema.scripts) {
      initialSharedSchemas.push({
        schemaId: String(sharedSchema.schemaId),
        name: String(sharedSchema.name),
        scripts: String(sharedSchema.scripts),
        lastModified: new Date()
      });
    }

  const workspace = new Workspace({ id, name, ownerId: req.userId, sharedSchemas: initialSharedSchemas });
  await workspace.save();

  // Create owner member record
  const ownerMember = new Member({
    workspaceId: id,
    id: require('uuid').v4(),
    userId: req.userId ? String(req.userId) : undefined,
    username: req.user && req.user.username ? req.user.username : String(req.userId || 'current_user'),
    role: 'owner',
    joinedAt: new Date(),
    updatedAt: new Date()
  });
  await ownerMember.save();
  // Also add owner into denormalized workspace.members array
  try {
    workspace.members = workspace.members || [];
    workspace.members.push({ username: ownerMember.username, userId: ownerMember.userId, role: ownerMember.role, joinedAt: ownerMember.joinedAt });
    await workspace.save();
  } catch (e) {
    console.warn('Failed to update workspace.members for owner', e);
  }

  console.log('✅ Workspace created successfully:', workspace.id);
  const out = workspace.toObject();
  out.members = [{ username: ownerMember.username, role: ownerMember.role, joinedAt: ownerMember.joinedAt }];
  res.status(201).json(out);
  } catch (error) {
    console.error('❌ Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// DELETE /api/workspaces/:workspaceId - Delete a workspace (owner only)
router.delete('/:workspaceId', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    console.log('🗑️ Deleting workspace:', workspaceId);

    const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const usernameLookup = req.user && req.user.username ? req.user.username : null;
    const isOwner = workspace.ownerId && (workspace.ownerId.toString ? workspace.ownerId.toString() === req.userId : workspace.ownerId === usernameLookup || workspace.ownerId === req.userId);
    if (!isOwner) return res.status(403).json({ error: 'Only workspace owners can delete the workspace' });

    // Mark workspace inactive and remove member records
    workspace.isActive = false;
    workspace.updatedAt = new Date();
    await workspace.save();

    await Member.deleteMany({ workspaceId });

    console.log('✅ Workspace deleted (soft):', workspaceId);

    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) emitToWorkspace(workspaceId, 'workspace_deleted', { workspaceId });

    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    console.error('❌ Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

module.exports = router;