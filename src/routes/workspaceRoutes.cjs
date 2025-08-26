const express = require('express');
const Workspace = require('../models/Workspace.cjs');
const User = require('../models/User.cjs');
const { authenticate } = require('../middleware/auth.cjs');

const router = express.Router();

// GET /api/workspaces - Get all workspaces for current user
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('📂 Fetching workspaces for user:', req.userId);
    
    const workspaces = await Workspace.find({
      $or: [
        { ownerId: req.userId },
        { 'members.username': req.user.username || 'current_user' }
      ],
      isActive: true
    }).sort({ updatedAt: -1 });

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
    
    const workspace = await Workspace.findOne({ 
      id: workspaceId,
      isActive: true 
    });
    
    if (!workspace) {
      console.log('❌ Workspace not found:', workspaceId);
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member
    const isMember = workspace.members.some(member => 
      member.username === (req.user.username || 'current_user')
    );

    if (!isMember && workspace.ownerId !== req.userId) {
      console.log('❌ Access denied for workspace:', workspaceId);
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('✅ Workspace found and accessible:', workspace.name);
    res.json(workspace);
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
    
    const workspace = await Workspace.findOne({ 
      id: workspaceId,
      isActive: true 
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member
    const isMember = workspace.members.some(member => 
      member.username === (req.user.username || 'current_user')
    );

    if (!isMember && workspace.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('✅ Members found:', workspace.members.length);
    res.json({ members: workspace.members });
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
    const workspace = await Workspace.findOne({ 
      id: workspaceId,
      isActive: true 
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requester is owner or editor
    const requesterMember = workspace.members.find(member => 
      member.username === (req.user.username || 'current_user')
    );

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
    const existingMember = workspace.members.find(member => 
      member.username.toLowerCase() === username.toLowerCase()
    );

    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this workspace' });
    }

    // Add member to workspace
    const newMember = {
      username,
      role,
      joinedAt: new Date()
    };

    workspace.members.push(newMember);
    workspace.updatedAt = new Date();
    await workspace.save();

    console.log('✅ User successfully added to workspace:', newMember);

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
    res.json({
      success: true,
      message: `${username} has been invited to the workspace`,
      members: workspace.members
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

    const workspace = await Workspace.findOne({ 
      id: workspaceId,
      isActive: true 
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requester is owner
    const requesterMember = workspace.members.find(member => 
      member.username === (req.user.username || 'current_user')
    );

    if (!requesterMember || requesterMember.role !== 'owner') {
      return res.status(403).json({ error: 'Only workspace owners can update member roles' });
    }

    // Find and update member
    const memberToUpdate = workspace.members.find(member => 
      member.username === username
    );

    if (!memberToUpdate) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberToUpdate.role === 'owner') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    // Update role
    memberToUpdate.role = role;
    workspace.updatedAt = new Date();
    await workspace.save();

    console.log('✅ Member role updated successfully');

    // Emit real-time event
    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) {
      emitToWorkspace(workspaceId, 'member_updated', {
        username: memberToUpdate.username,
        role: memberToUpdate.role
      });
    }

    res.json({
      success: true,
      message: `${username} role updated to ${role}`,
      members: workspace.members
    });

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

    const workspace = await Workspace.findOne({ 
      id: workspaceId,
      isActive: true 
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requester is owner
    const requesterMember = workspace.members.find(member => 
      member.username === (req.user.username || 'current_user')
    );

    if (!requesterMember || requesterMember.role !== 'owner') {
      return res.status(403).json({ error: 'Only workspace owners can remove members' });
    }

    // Find member to remove
    const memberToRemove = workspace.members.find(member => 
      member.username === username
    );

    if (!memberToRemove) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberToRemove.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    // Remove member
    workspace.members = workspace.members.filter(member => 
      member.username !== username
    );
    workspace.updatedAt = new Date();
    await workspace.save();

    console.log('✅ Member removed successfully');

    // Emit real-time event
    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) {
      emitToWorkspace(workspaceId, 'member_removed', {
        username: username
      });
    }

    res.json({
      success: true,
      message: `${username} has been removed from the workspace`,
      members: workspace.members
    });

  } catch (error) {
    console.error('❌ Error removing member from workspace:', error);
    res.status(500).json({ error: 'Failed to remove member from workspace' });
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

    const workspace = await Workspace.findOne({ 
      id: workspaceId,
      isActive: true 
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member with edit permissions
    const member = workspace.members.find(member => 
      member.username === (req.user.username || 'current_user')
    );

    if (!member || member.role === 'viewer') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Update or add shared schema
    const existingSchemaIndex = workspace.sharedSchemas.findIndex(schema => 
      schema.schemaId === schemaId
    );

    const schemaData = {
      schemaId,
      name,
      scripts,
      lastModified: new Date()
    };

    if (existingSchemaIndex >= 0) {
      workspace.sharedSchemas[existingSchemaIndex] = schemaData;
      console.log('✅ Updated existing shared schema');
    } else {
      workspace.sharedSchemas.push(schemaData);
      console.log('✅ Added new shared schema');
    }

    workspace.updatedAt = new Date();
    await workspace.save();

    // Emit real-time event to workspace members
    const emitToWorkspace = req.app.get('emitToWorkspace');
    if (emitToWorkspace) {
      emitToWorkspace(workspaceId, 'db_update', {
        schemaId,
        name,
        tables: JSON.parse(scripts).tables || [],
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Schema updated successfully',
      sharedSchemas: workspace.sharedSchemas
    });

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

    const workspace = new Workspace({
      id,
      name,
      ownerId: req.userId,
      members: [{
        username: req.user.username || 'current_user',
        role: 'owner',
        joinedAt: new Date()
      }],
      sharedSchemas: []
    });

    await workspace.save();
    console.log('✅ Workspace created successfully:', workspace.id);
    
    res.status(201).json(workspace);
  } catch (error) {
    console.error('❌ Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

module.exports = router;