// server.cjs - Complete Express + Socket.IO + MongoDB server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const axios = require('axios');
const cron = require('node-cron');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// Models & middleware
const User = require('./src/models/User.cjs');
const Workspace = require('./src/models/Workspace.cjs');
const { authenticate } = require('./src/middleware/auth.cjs');
const portfolioRoutes = require('./src/routes/portfolioRoutes.cjs');
const workspaceRoutes = require('./src/routes/workspaceRoutes.cjs');
const schemaRoutes = require('./src/routes/schemaRoutes.cjs');
const Invitation = require('./src/models/Invitation.cjs');
const Member = require('./src/models/Member.cjs');

// Configuration
const PORT = Number(process.env.PORT) || 5000;
// Allow override of host binding (Render requires 0.0.0.0)
const HOST = process.env.HOST || '0.0.0.0';
const MONGO_URL = process.env.MONGO_URL;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SMTP_PORT = Number(process.env.SMTP_PORT);

// Express setup
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  path: '/ws/portfolio-updates',   // frontend ilə eyni olmalıdır
  cors: {
    origin: [
      process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      'https://zerocodedb.online'
    ],
    methods: ['GET','POST'],
    credentials: true
  },
  transports: ['websocket','polling']
});




// Make io available to routes
app.set('io', io);

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://startup-1-j563.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
    FRONTEND_ORIGIN
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Essential middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// MongoDB connection
if (MONGO_URL) {
  mongoose
      .connect(MONGO_URL)
      .then(async () => {
        console.log('✅ MongoDB connected');

        // Migration: migrate embedded workspace.members -> Member collection
        try {
          console.log('🔁 Checking for embedded workspace.members to migrate...');
          const workspacesWithMembers = await Workspace.find({ 'members.0': { $exists: true } }).lean();
          if (workspacesWithMembers && workspacesWithMembers.length > 0) {
            console.log(`🔁 Found ${workspacesWithMembers.length} workspace(s) with embedded members. Migrating...`);
            let migratedCount = 0;
            for (const ws of workspacesWithMembers) {
              const wid = ws.id || ws._id;
              const members = Array.isArray(ws.members) ? ws.members : [];
              for (const m of members) {
                const uname = m.username;
                if (!uname) continue;
                // avoid duplicates
                const exists = await Member.findOne({ workspaceId: wid, username: new RegExp('^' + uname + '$', 'i') }).lean();
                if (!exists) {
                  const mem = new Member({
                    workspaceId: wid,
                    id: require('uuid').v4(),
                    username: uname,
                    role: m.role || 'viewer',
                    joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
                    updatedAt: new Date()
                  });
                  await mem.save();
                  migratedCount++;
                }
              }

              // remove embedded members array to avoid duplication
              try {
                await Workspace.updateOne({ id: wid }, { $unset: { members: '' } });
              } catch (e) {
                console.warn('⚠️ Failed to unset members for workspace', wid, e.message || e);
              }
            }
            console.log(`✅ Migration complete. Created ${migratedCount} Member records.`);
          } else {
            console.log('🔁 No embedded members found, migration not required.');
          }
        } catch (migErr) {
          console.error('❌ Migration error:', migErr);
        }
      })
    .catch(err => {
      console.warn('⚠️ MongoDB connection failed:', err.message);
      console.log('📡 Continuing without MongoDB (development mode)');
    });
} else {
  console.log('📡 MongoDB not configured, running in development mode without database');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes - All under /api prefix
app.use('/api/portfolios', authenticate, portfolioRoutes);
app.use('/api/workspaces', authenticate, workspaceRoutes);
app.use('/api/schemas', authenticate, schemaRoutes);

// User validation endpoint
app.post('/api/users/validate', async (req, res) => {
  try {
    console.log('Validating username:', req.body);
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, returning true for development');
      return res.json({ exists: true });
    }
    
    const exists = await User.exists({ username });
    console.log('Username exists check result:', { username, exists: !!exists });
    return res.json({ exists: !!exists });
  } catch (err) {
    console.error('Username validation error:', err);
    return res.status(500).json({ error: 'Server error during validation' });
  }
});

// Authentication routes
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, 'subscriptionPlan expiresAt fullName email username');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('GET /api/users/me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/subscription/status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, 'subscriptionPlan expiresAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const isExpired = user.expiresAt && new Date() > user.expiresAt;
    const subscriptionStatus = {
      plan: user.subscriptionPlan || 'free',
      isActive: !isExpired,
      expiresAt: user.expiresAt,
      isExpired
    };
    res.json(subscriptionStatus);
  } catch (err) {
    console.error('GET /api/subscription/status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId, 'fullName email username subscriptionPlan expiresAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  const payload = { userId: user._id, email: user.email, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
    const uobj = user.toObject();
    delete uobj.password;
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ message: 'Login successful', token, user: uobj });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const conflict = await User.findOne({ $or: [{ email }, { username }] });
    if (conflict) {
      const field = conflict.email === email ? 'Email' : 'Username';
      return res.status(400).json({ message: `${field} already registered` });
    }
    const hashed = await bcrypt.hash(password, 10);
    const newUser = await new User({ username, email, password: hashed }).save();
  const payload = { userId: newUser._id, email: newUser.email, username: newUser.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
    const uobj = newUser.toObject();
    delete uobj.password;
    res.status(201).json({ message: 'User registered', token, user: uobj });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/logout', (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    });
    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

// Socket.IO workspace management
const workspaceRooms = new Map();
// Map username -> Set of socket ids for notifying specific users
const userSockets = new Map();

// In-memory debounce queue for schema persistence to avoid write storms
// Structure: Map<workspaceId, Map<schemaId, { timer: NodeJS.Timeout, payload: { name, scripts } }>>
const pendingSchemaWrites = new Map();
const SCHEMA_PERSIST_DEBOUNCE_MS = 1000; // wait 1s of quiet before persisting

io.on('connection', (socket) => {
  console.log('🔌 Socket.IO client connected:', socket.id);

  socket.on('join_workspace', (workspaceId) => {
    console.log(`🏠 Socket ${socket.id} joining workspace: ${workspaceId}`);
    socket.join(`workspace_${workspaceId}`);

    // Track socket in workspace
    if (!workspaceRooms.has(workspaceId)) {
      workspaceRooms.set(workspaceId, new Set());
    }
    workspaceRooms.get(workspaceId).add(socket.id);
    
    socket.workspaceId = workspaceId;
  });

  // Register user presence when client emits user_join (contains username)
  socket.on('user_join', (data) => {
    try {
      const username = data && (data.username || data.userId);
      if (username) {
        socket.username = String(username);
        if (!userSockets.has(socket.username)) userSockets.set(socket.username, new Set());
        userSockets.get(socket.username).add(socket.id);
        console.log('🔔 Registered socket for user:', socket.username, socket.id);
      }
      // Continue to relay join to others in workspace
      relayIfInWorkspace('user_joined', data);
    } catch (e) {
      console.warn('Failed to register user socket on user_join', e);
    }
  });

  socket.on('leave_workspace', (workspaceId) => {
    console.log(`🚪 Socket ${socket.id} leaving workspace: ${workspaceId}`);
    socket.leave(`workspace_${workspaceId}`);

    // Remove from tracking
    if (workspaceRooms.has(workspaceId)) {
      workspaceRooms.get(workspaceId).delete(socket.id);
    }
    
    delete socket.workspaceId;
  });

  // Relay collaboration events emitted by clients to other members in the same workspace
  const relayIfInWorkspace = (eventName, payload) => {
    if (socket.workspaceId) {
      console.log(`↔ Relaying ${eventName} from ${socket.id} to workspace ${socket.workspaceId}`);
      // Broadcast to others in the room (exclude sender)
      socket.to(`workspace_${socket.workspaceId}`).emit(eventName, payload);
    } else {
      console.log(`⚠️ Ignoring ${eventName} from ${socket.id} because socket not joined to a workspace`);
    }
  };

  // Compatibility: also accept 'join-room' event name
  socket.on('join-room', (workspaceId) => {
    try {
      console.log(`🏠 (join-room) Socket ${socket.id} joining workspace: ${workspaceId}`);

  socket.on('cursor_update', (data) => relayIfInWorkspace('cursor_update', data));
  socket.on('user_join', (data) => relayIfInWorkspace('user_joined', data));
  socket.on('user_leave', (data) => relayIfInWorkspace('user_left', data));
    } catch (e) {
      console.warn('join-room handler error', e);
    }
  });
  // Persist schema_change payloads that include a full schema to the Workspace.sharedSchemas
  socket.on('schema_change', async (data) => {
    try {
      // If payload contains a full schema and schemaId, schedule persistence (debounced)
        if (data && data.schemaId && data.schema) {
        const workspaceId = socket.workspaceId || data.workspaceId;
        const schemaId = String(data.schemaId);
        if (workspaceId) {
          // Enforce server-side authority: reject client attempts to create new canonical docs via socket
          if (data.createNew) {
            try {
              socket.emit('error', { message: 'Cannot create new canonical document for a shared schema; use canonical workspaceId' });
            } catch (e) {}
            return;
          }
          try {
            // Ensure maps exist
            if (!pendingSchemaWrites.has(workspaceId)) pendingSchemaWrites.set(workspaceId, new Map());
            const wsMap = pendingSchemaWrites.get(workspaceId);

            // Clear existing timer if present
            if (wsMap.has(schemaId) && wsMap.get(schemaId).timer) {
              clearTimeout(wsMap.get(schemaId).timer);
            }

            // Store latest payload and schedule upsert
            wsMap.set(schemaId, {
              timer: setTimeout(async () => {
                try {
                  const SharedSchema = require('./src/models/SharedSchema.cjs');
                  const update = {
                    $set: {
                      workspaceId,
                      schemaId,
                      name: data.name || 'Shared Schema',
                      scripts: String(data.schema),
                      lastModified: new Date(),
                      shared: true
                    },
                    $inc: { version: 1 }
                  };
                  const opts = { upsert: true, new: true };
                  const saved = await SharedSchema.findOneAndUpdate({ workspaceId, schemaId }, update, opts).exec();

                  // Update denormalized Workspace.sharedSchemas if present
                  try {
                    const w = await Workspace.findOne({ id: workspaceId });
                    if (w) {
                      w.sharedSchemas = w.sharedSchemas || [];
                      const idx = w.sharedSchemas.findIndex(s => s.schemaId === schemaId);
                      const schemaEntry = { schemaId, name: saved.name, scripts: saved.scripts, lastModified: saved.lastModified };
                      if (idx >= 0) w.sharedSchemas[idx] = schemaEntry; else w.sharedSchemas.push(schemaEntry);
                      w.updatedAt = new Date();
                      await w.save();
                    }
                  } catch (e) {
                    console.warn('Failed to update denormalized workspace.sharedSchemas from socket debounce:', e);
                  }

                  console.log('✅ Debounced shared schema persisted (upsert) for', workspaceId, 'schemaId:', schemaId);
                  try {
                    console.log(`Saved shared schema workspaceId=${workspaceId} schemaId=${schemaId} _id=${saved._id} version=${saved.version}`);
                  } catch (e) {}
                  emitToWorkspace(workspaceId, 'workspace-updated', { workspaceId, schemaId, version: saved.version, lastModified: saved.lastModified });
                } catch (err) {
                  console.warn('Failed to persist debounced shared schema (upsert):', err);
                } finally {
                  const m = pendingSchemaWrites.get(workspaceId);
                  if (m) m.delete(schemaId);
                }
              }, SCHEMA_PERSIST_DEBOUNCE_MS),
              payload: { name: data.name || 'Shared Schema', scripts: String(data.schema) }
            });
          } catch (e) {
            console.warn('Failed to schedule shared schema persistence from schema_change:', e);
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // Also relay the schema_change event to other clients as before
    relayIfInWorkspace('schema_change', data);
  });
  socket.on('user_selection', (data) => relayIfInWorkspace('user_selection', data));
  socket.on('presence_update', (data) => relayIfInWorkspace('presence_update', data));

  socket.on('disconnect', () => {
    console.log('❌ Socket.IO client disconnected:', socket.id);
    
    // Clean up workspace tracking
    if (socket.workspaceId && workspaceRooms.has(socket.workspaceId)) {
      workspaceRooms.get(socket.workspaceId).delete(socket.id);
    }
    // Clean up userSockets mapping
    if (socket.username) {
      const set = userSockets.get(socket.username);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(socket.username);
      }
    }
  });
});

// Helper function to emit to workspace
const emitToWorkspace = (workspaceId, event, data) => {
  console.log(`📡 Emitting ${event} to workspace ${workspaceId}:`, data);
  io.to(`workspace_${workspaceId}`).emit(event, data);
};

// Make emitToWorkspace available to routes
app.set('emitToWorkspace', emitToWorkspace);
// Make userSockets available to routes for direct notifications
app.set('userSockets', userSockets);

// SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

if (process.env.SMTP_HOST) {
  transporter.verify((err) => {
    if (err) console.error('SMTP verify error:', err);
    else console.log('✅ SMTP ready');
  });
}

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: 'piriyevtural00@gmail.com',
      subject: `New Contact Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `<h3>New Contact Form Message</h3><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error sending contact email:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// API Error handler - Always return JSON
app.use('/api/*', (err, req, res, next) => {
  console.error('❌ API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404 handler for API routes - Return JSON, not HTML
app.use('/api/*', (req, res) => {
  console.log(`❌ API 404: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Serve static files in production - ONLY for non-API routes
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  
  // SPA fallback - ONLY for non-API routes
  app.get(/^\/(?!api).*/, (req, res) => {
    console.log(`📄 Serving SPA for: ${req.path}`);
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  // Always return JSON for API routes
  if (req.path.startsWith('/api')) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).send('Internal Server Error');
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server started successfully!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ MongoDB: ${MONGO_URL ? 'Connected' : 'Not configured'}`);
  console.log(`📧 SMTP: ${process.env.SMTP_HOST || 'Not configured'}`);
  console.log(`🔌 Socket.IO: Enabled`);
  console.log(`🌍 CORS Origins: ${FRONTEND_ORIGIN}`);
  try {
    const addr = server.address();
    console.log('🔍 Server address:', addr);
  } catch (e) {
    console.warn('🔍 Could not read server.address()', e && e.message ? e.message : e);
  }
});

// Listen for server errors (for example, EACCES or EADDRINUSE)
server.on('error', (err) => {
  console.error('❌ Server error event:', err && err.message ? err.message : err);
  if (err && err.code) console.error('❌ Server error code:', err.code);
});

// Global exception handlers to help debug crashes in CI or developer machines
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err && err.stack ? err.stack : err);
  // keep process alive for debugging; in production you may want to exit
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, server, io };
