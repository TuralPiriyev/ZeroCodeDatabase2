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
const Invitation = require('./src/models/Invitation.cjs');
const Member = require('./src/models/Member.cjs');

// Configuration
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URL = process.env.MONGO_URL;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SMTP_PORT = Number(process.env.SMTP_PORT);

// Express setup
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: [
      'https://startup-1-j563.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000',
      FRONTEND_ORIGIN
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
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
    .then(() => console.log('✅ MongoDB connected'))
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
    const payload = { userId: user._id, email: user.email };
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
    const payload = { userId: newUser._id, email: newUser.email };
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

  socket.on('leave_workspace', (workspaceId) => {
    console.log(`🚪 Socket ${socket.id} leaving workspace: ${workspaceId}`);
    socket.leave(`workspace_${workspaceId}`);
    
    // Remove from tracking
    if (workspaceRooms.has(workspaceId)) {
      workspaceRooms.get(workspaceId).delete(socket.id);
    }
    
    delete socket.workspaceId;
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket.IO client disconnected:', socket.id);
    
    // Clean up workspace tracking
    if (socket.workspaceId && workspaceRooms.has(socket.workspaceId)) {
      workspaceRooms.get(socket.workspaceId).delete(socket.id);
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

// SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || SMTP_PORT || 465,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server started successfully!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ MongoDB: ${MONGO_URL ? 'Connected' : 'Not configured'}`);
  console.log(`📧 SMTP: ${process.env.SMTP_HOST || 'Not configured'}`);
  console.log(`🔌 Socket.IO: Enabled`);
  console.log(`🌍 CORS Origins: ${FRONTEND_ORIGIN}`);
});

module.exports = { app, server, io };