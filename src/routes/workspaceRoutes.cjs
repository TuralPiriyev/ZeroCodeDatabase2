const express = require('express');
const Workspace = require('../models/Workspace.cjs');
const User = require('../models/User.cjs');
const Member = require('../models/Member.cjs');
const { authenticate } = require('../middleware/auth.cjs');

const router = express.Router();

// GET /api/workspaces - Get all workspaces for current user
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('📂 Fetching workspaces for user:', req.userId);
  // Find workspaces where user is owner OR has a member record
  const ownerWorkspaces = await Workspace.find({ ownerId: req.userId, isActive: true }).sort({ updatedAt: -1 });
  const memberRecords = await Member.find({ username: req.user.username || 'current_user' }).distinct('workspaceId');
  const memberWorkspaces = await Workspace.find({ id: { $in: memberRecords }, isActive: true }).sort({ updatedAt: -1 });

  // Merge unique workspaces (owner first)
  const workspacesMap = new Map();
  ownerWorkspaces.forEach(w => workspacesMap.set(w.id, w));
  memberWorkspaces.forEach(w => { if (!workspacesMap.has(w.id)) workspacesMap.set(w.id, w); });
  const workspaces = Array.from(workspacesMap.values());

    console.log('✅ Found workspaces:', workspaces.length);
    res.json(workspaces);
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

    // Check membership via Member collection
    const memberRecord = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
    if (!memberRecord && workspace.ownerId !== req.userId) {
      console.log('❌ Access denied for workspace:', workspaceId);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Assemble members list from Member collection
    const members = await Member.find({ workspaceId }).select('-_id username role joinedAt').lean();
    const out = workspace.toObject();
    out.members = members || [];
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

  const memberRecord = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
  if (!memberRecord && workspace.ownerId !== req.userId) return res.status(403).json({ error: 'Access denied' });

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
    const requesterMember = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
    if (!requesterMember || (requesterMember.role !== 'owner' && requesterMember.role !== 'editor')) {
      return res.status(403).json({ error: 'Only owners and editors can invite users' });
    }

    // Validate that username exists in Users collection
    let userExists = false;
    try {
      if (mongoose.connection.readyState === 1) {
        const user = await User.findOne({ username });
        userExists = !!user;
        console.log('👤 User validation result:', { username, exists: userExists });
      } else {
        console.log('📡 MongoDB not connected, allowing invitation for development');
        userExists = true;
      }
    } catch (error) {
      console.warn('⚠️ User validation failed, continuing for development:', error);
      userExists = true;
    }

    if (!userExists && mongoose.connection.readyState === 1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already a member
    const existingMember = await Member.findOne({ workspaceId, username: new RegExp('^' + username + '$', 'i') });
    if (existingMember) return res.status(409).json({ error: 'User is already a member of this workspace' });

    // Add member record
    const newMember = new Member({
      workspaceId,
      id: require('uuid').v4(),
      username,
      role,
      joinedAt: new Date(),
      updatedAt: new Date()
    });
    await newMember.save();
    console.log('✅ User successfully added to workspace:', newMember.username);

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

  const requesterMember = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
  if (!requesterMember || requesterMember.role !== 'owner') return res.status(403).json({ error: 'Only workspace owners can update member roles' });

  const memberToUpdate = await Member.findOne({ workspaceId, username });
  if (!memberToUpdate) return res.status(404).json({ error: 'Member not found' });
  if (memberToUpdate.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' });

  memberToUpdate.role = role;
  memberToUpdate.updatedAt = new Date();
  await memberToUpdate.save();

  console.log('✅ Member role updated successfully');
  const emitToWorkspace = req.app.get('emitToWorkspace');
  if (emitToWorkspace) emitToWorkspace(workspaceId, 'member_updated', { username: memberToUpdate.username, role: memberToUpdate.role });

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
  const requesterMember = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
  if (!requesterMember || requesterMember.role !== 'owner') return res.status(403).json({ error: 'Only workspace owners can remove members' });

  const memberToRemove = await Member.findOne({ workspaceId, username });
  if (!memberToRemove) return res.status(404).json({ error: 'Member not found' });
  if (memberToRemove.role === 'owner') return res.status(400).json({ error: 'Cannot remove workspace owner' });

  await Member.deleteOne({ workspaceId, username });

  console.log('✅ Member removed successfully');
  const emitToWorkspace = req.app.get('emitToWorkspace');
  if (emitToWorkspace) emitToWorkspace(workspaceId, 'member_removed', { username });

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

    const requesterMember = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
    if (!requesterMember || requesterMember.role !== 'owner') return res.status(403).json({ error: 'Only workspace owners can transfer ownership' });

    const newOwnerMember = await Member.findOne({ workspaceId, username: toUsername });
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

// POST /api/workspaces/:workspaceId/schemas - Update shared schemas
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

    const member = await Member.findOne({ workspaceId, username: req.user.username || 'current_user' });
    if (!member) return res.status(403).json({ error: 'Insufficient permissions' });

    // If updating an existing schema (replace), only owner can perform that operation.
    const existingSchemaIndex = workspace.sharedSchemas.findIndex(schema => schema.schemaId === schemaId);
    if (existingSchemaIndex >= 0 && member.role !== 'owner') {
      return res.status(403).json({ error: 'Only workspace owners can replace an existing shared schema' });
    }

  const schemaData = { schemaId, name, scripts, lastModified: new Date() };
    if (existingSchemaIndex >= 0) {
      workspace.sharedSchemas[existingSchemaIndex] = schemaData;
      console.log('✅ Updated existing shared schema');
    } else {
      workspace.sharedSchemas.push(schemaData);
      console.log('✅ Added new shared schema');
    }
    workspace.updatedAt = new Date();
    await workspace.save();

    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) emitToWorkspace(workspaceId, 'db_update', { schemaId, name, tables: JSON.parse(scripts).tables || [], timestamp: new Date().toISOString() });

    res.json({ success: true, message: 'Schema updated successfully', sharedSchemas: workspace.sharedSchemas });

  } catch (error) {
    console.error('❌ Error updating shared schemas:', error);
    res.status(500).json({ error: 'Failed to update shared schemas' });
  }
});

// POST /api/workspaces - Create new workspace
router.post('/', authenticate, async (req, res) => {
  try {
    const { id, name } = req.body;
    
    console.log('🏗️ Creating workspace:', { id, name });

    if (!id || !name) {
      return res.status(400).json({ error: 'Workspace ID and name are required' });
    }

    const existingWorkspace = await Workspace.findOne({ id });
    if (existingWorkspace) {
      return res.status(409).json({ error: 'Workspace with this ID already exists' });
    }

  const workspace = new Workspace({ id, name, ownerId: req.userId, sharedSchemas: [] });
  await workspace.save();

  // Create owner member record
  const ownerMember = new Member({ workspaceId: id, id: require('uuid').v4(), username: req.user.username || 'current_user', role: 'owner', joinedAt: new Date(), updatedAt: new Date() });
  await ownerMember.save();

  console.log('✅ Workspace created successfully:', workspace.id);
  const out = workspace.toObject();
  out.members = [{ username: ownerMember.username, role: ownerMember.role, joinedAt: ownerMember.joinedAt }];
  res.status(201).json(out);
  } catch (error) {
    console.error('❌ Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

module.exports = router;