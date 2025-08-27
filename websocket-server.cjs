// WebSocket server for real-time collaboration
const express = require('express');
const http = require('http');
const cors = require('cors');

const PORT = process.env.WEBSOCKET_PORT || 5000;

console.log('🔧 WebSocket Server Configuration:');
console.log(`📡 Port: ${PORT}`);
console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

// Create HTTP server
const app = express();
app.use(cors());
const server = http.createServer(app);

// Set up express-ws
const expressWs = require('express-ws')(app, server);

// Store active connections by schema ID
const connections = new Map();
const userSessions = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Broadcast message to all users in a schema except sender
function broadcastToSchema(schemaId, message, excludeUserId = null) {
  const schemaConnections = connections.get(schemaId);
  if (!schemaConnections) return;

  const messageStr = JSON.stringify(message);
  console.log(`📤 Broadcasting to schema ${schemaId}:`, message.type, `(${schemaConnections.size} connections)`);
  
  schemaConnections.forEach(ws => {
    if (ws.readyState === 1 && ws.userId !== excludeUserId) { // 1 = OPEN
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('Error sending message to client:', error);
        cleanupConnection(ws, schemaId);
      }
    }
  });
}

// Clean up closed connections
function cleanupConnection(ws, schemaId) {
  const schemaConnections = connections.get(schemaId);
  if (schemaConnections) {
    schemaConnections.delete(ws);
    if (schemaConnections.size === 0) {
      connections.delete(schemaId);
    }
  }
  
  if (ws.userId) {
    userSessions.delete(ws.userId);
  }
}

// Express-ws route for collaboration
app.ws('/ws/collaboration/:schemaId', (ws, req) => {
  const schemaId = req.params.schemaId;
  
  if (!schemaId) {
    ws.close(1008, 'Schema ID required');
    return;
  }
  
  console.log(`✅ New WebSocket connection for schema: ${schemaId} from ${req.ip}`);
  
  // Add connection to schema group
  if (!connections.has(schemaId)) {
    connections.set(schemaId, new Set());
  }
  connections.get(schemaId).add(ws);
  
  ws.schemaId = schemaId;
  ws.isAlive = true;
  ws.connectedAt = Date.now();
  
  // Send connection established message with schema info
  ws.send(JSON.stringify({
    type: 'connection_established',
    clientId: `client_${Date.now()}`,
    schemaId: schemaId,
    timestamp: new Date().toISOString()
  }));
  
  // Send current users in schema
  const schemaConnections = connections.get(schemaId);
  if (schemaConnections) {
    const currentUsers = Array.from(schemaConnections)
      .filter(conn => conn.userId && conn.username)
      .map(conn => ({
        id: conn.userId,
        username: conn.username,
        role: conn.role || 'editor'
      }));
    
    if (currentUsers.length > 0) {
      ws.send(JSON.stringify({
        type: 'current_users',
        users: currentUsers
      }));
    }
  }
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received message for schema ${schemaId}:`, message.type);
      
      switch (message.type) {
        case 'user_join':
          ws.userId = message.userId;
          ws.username = message.username;
          ws.role = message.role || 'editor';
          userSessions.set(message.userId, ws);
          
          // Broadcast user joined to others
          broadcastToSchema(schemaId, {
            type: 'user_joined',
            user: {
              id: message.userId,
              username: message.username,
              role: ws.role,
              joinedAt: new Date().toISOString()
            }
          }, message.userId);
          
          console.log(`👋 User ${message.username} (${ws.role}) joined schema ${schemaId}`);
          break;
          
        case 'user_leave':
          broadcastToSchema(schemaId, {
            type: 'user_left',
            userId: message.userId
          }, message.userId);
          
          console.log(`👋 User ${message.username} left schema ${schemaId}`);
          break;
          
        case 'cursor_update':
          // Validate cursor data before broadcasting
          if (message.cursor && 
              typeof message.cursor === 'object' && 
              message.cursor.userId && 
              typeof message.cursor.userId === 'string') {
            
            // Add timestamp to cursor data
            const cursorData = {
              ...message.cursor,
              timestamp: new Date().toISOString()
            };
            
            // Broadcast cursor position to other users
            broadcastToSchema(schemaId, {
              type: 'cursor_update',
              data: cursorData
            }, message.cursor.userId);
            
            console.log(`📍 Cursor update from ${message.cursor.username || message.cursor.userId} broadcasted`);
          } else {
            console.warn('⚠️ Invalid cursor_update message received:', {
              hasCursor: !!message.cursor,
              cursorType: typeof message.cursor,
              hasUserId: !!message.cursor?.userId,
              userIdType: typeof message.cursor?.userId,
              fullMessage: message
            });
            
            // Send error response to sender only
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid cursor_update format. Expected cursor object with userId.'
            }));
          }
          break;
          
        case 'schema_change':
          // Validate schema change data
          if (!message.changeType || !message.data) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid schema_change format. Expected changeType and data.'
            }));
            break;
          }
          
          // Broadcast schema changes to all users
          const schemaChangeMessage = {
            type: 'schema_change',
            changeType: message.changeType,
            data: message.data,
            userId: message.userId,
            username: message.username,
            timestamp: new Date().toISOString()
          };
          
          broadcastToSchema(schemaId, schemaChangeMessage, message.userId);
          
          console.log(`🔄 Schema change: ${message.changeType} by ${message.username || message.userId}`);
          break;
          
        case 'user_selection':
          // Broadcast user selection to other users
          broadcastToSchema(schemaId, {
            type: 'user_selection',
            data: message.data
          }, message.data?.userId);
          break;
          
        case 'presence_update':
          // Broadcast presence updates
          broadcastToSchema(schemaId, {
            type: 'presence_update',
            data: message.data
          }, message.data?.userId);
          break;
          
        case 'ping':
          // Respond to heartbeat
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    console.log(`❌ WebSocket connection closed for schema: ${schemaId}`);
    
    // Notify other users
    if (ws.userId) {
      broadcastToSchema(schemaId, {
        type: 'user_left',
        userId: ws.userId
      }, ws.userId);
    }
    
    cleanupConnection(ws, schemaId);
  });
  
  // Handle connection errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    cleanupConnection(ws, schemaId);
  });
  
  // Heartbeat to detect broken connections
  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

// Portfolio updates WebSocket endpoint
app.ws('/ws/portfolio-updates', (ws, req) => {
  console.log('➿ Client subscribed to portfolio-updates');

  ws.on('message', msg => {
    // Broadcast updates to all portfolio clients
    expressWs.getWss().clients.forEach(client => {
      if (client !== ws && client.readyState === 1) { // 1 = OPEN
        client.send(msg);
      }
    });
  });

  ws.on('close', () => {
    console.log('❌ Portfolio-updates socket closed');
  });
});

// Heartbeat interval to clean up dead connections
const heartbeatInterval = setInterval(() => {
  console.log(`💓 Heartbeat check - Active schemas: ${connections.size}`);
  
  connections.forEach((schemaConnections, schemaId) => {
    schemaConnections.forEach(ws => {
      if (!ws.isAlive) {
        console.log(`💀 Terminating dead connection for schema: ${schemaId}, user: ${ws.username || ws.userId || 'unknown'}`);
        cleanupConnection(ws, schemaId);
        return ws.terminate();
      }
      
      // Reset alive flag and send ping
      ws.isAlive = false;
      
      // Only ping if connection is open
      if (ws.readyState === 1) { // 1 = OPEN
        try {
          ws.ping();
        } catch (error) {
          console.error(`❌ Error sending ping to ${ws.username || ws.userId}:`, error);
          cleanupConnection(ws, schemaId);
        }
      } else {
        // Connection is not open, clean it up
        console.log(`🧹 Cleaning up non-open connection (state: ${ws.readyState}) for schema: ${schemaId}`);
        cleanupConnection(ws, schemaId);
      }
    });
  });
}, 30000); // Check every 30 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔌 Shutting down WebSocket server...');
  clearInterval(heartbeatInterval);
  
  connections.forEach((schemaConnections) => {
    schemaConnections.forEach(ws => {
      ws.close(1001, 'Server shutting down');
    });
  });
  
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📡 Real-time collaboration enabled`);
  console.log(`🔗 WebSocket endpoints:`);
  console.log(`   - ws://localhost:${PORT}/ws/collaboration/:schemaId`);
  console.log(`   - ws://localhost:${PORT}/ws/portfolio-updates`);
});

// Export for testing
module.exports = { server, connections, userSessions };