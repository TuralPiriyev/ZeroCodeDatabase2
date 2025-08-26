export interface CollaborationUser {
  id: string;
  username: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatar?: string;
  color: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  tableId?: string;
  columnId?: string;
}

export interface SchemaChange {
  type: 'table_created' | 'table_updated' | 'table_deleted' | 'relationship_added' | 'relationship_removed';
  data: any;
  userId: string;
  timestamp: Date;
}

import { simpleWebSocketService } from './simpleWebSocketService';

// WebSocket URL helper
const getWebSocketUrl = (schemaId: string) => {
  if (import.meta.env.DEV) {
    return `ws://localhost:5000/ws/collaboration/${schemaId}`;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/collaboration/${schemaId}`;
};

export default class CollaborationService {
  private connectionId: string | null = null;
  private currentUser: CollaborationUser | null = null;
  private schemaId: string | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  public isConnected = false;
  private userJoinSent = false;

  constructor() {
    // All WebSocket operations delegated to SimpleWebSocketService
  }

  initialize(user: CollaborationUser, schemaId: string) {
    this.currentUser = user;
    this.schemaId = schemaId;
    this.userJoinSent = false; // Reset join status
    console.log('🔧 CollaborationService initialized:', { user: user.username, schemaId });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentUser || !this.schemaId) {
        const error = new Error('Must initialize with user and schema ID before connecting');
        console.error('❌ Connection failed:', error.message);
        reject(error);
        return;
      }

      if (this.isConnected && this.connectionId && simpleWebSocketService.isConnected(this.connectionId)) {
        console.log('✅ WebSocket already connected');
        resolve();
        return;
      }

      const url = getWebSocketUrl(this.schemaId);
      console.log('🔗 Connecting to WebSocket via SimpleWebSocketService:', url);
      
      try {
        this.connectionId = simpleWebSocketService.connect(url, {
          onOpen: () => {
            console.log('✅ Collaboration WebSocket connected successfully');
            this.isConnected = true;
            this.emit('connected');
            resolve();
          },
          onMessage: (message) => {
            this.handleMessage(message);
          },
          onClose: () => {
            console.log('❌ Collaboration WebSocket disconnected');
            this.isConnected = false;
            this.userJoinSent = false;
            this.emit('disconnected');
          },
          onError: (error) => {
            console.error('❌ Collaboration WebSocket error:', error);
            this.emit('error', error);
            reject(error);
          },
          enableReconnect: true
        });

      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  private sendUserJoin() {
    if (!this.currentUser || !this.schemaId || this.userJoinSent) return;
    
    try {
      this.sendMessage({
        type: 'user_join',
        userId: this.currentUser.id,
        username: this.currentUser.username,
        role: this.currentUser.role,
        color: this.currentUser.color,
        schemaId: this.schemaId,
        timestamp: new Date().toISOString()
      });
      this.userJoinSent = true;
      console.log('📤 User join message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send user join message:', error);
    }
  }

  private handleMessage(message: any) {
    console.log('📨 Received collaboration message:', message.type, message);
    
    switch (message.type) {
      case 'connection_established':
        console.log('🔗 Connection established with server, clientId:', message.clientId);
        
        // Send user join message after connection is established
        setTimeout(() => {
          if (this.isConnected && !this.userJoinSent) {
            this.sendUserJoin();
          }
        }, 100);
        break;
        
      case 'user_joined':
        console.log('👋 User joined:', message.user?.username);
        this.emit('user_joined', message.user);
        break;
        
      case 'user_left':
        console.log('👋 User left:', message.userId);
        this.emit('user_left', message.userId);
        break;
        
      case 'cursor_update':
        // Server sends cursor data in 'data' field with validated structure
        const cursorData = message.data;
        
        if (this.isValidCursorData(cursorData)) {
          console.log('📍 Valid cursor update received:', cursorData);
          this.emit('cursor_update', cursorData);
        } else {
          console.warn('⚠️ Invalid cursor_update message structure:', {
            message,
            hasData: !!message.data,
            dataType: typeof message.data,
            dataKeys: message.data ? Object.keys(message.data) : []
          });
        }
        break;
        
      case 'schema_change':
        console.log('🔄 Schema changed:', message.changeType);
        this.emit('schema_change', message);
        break;
        
      case 'user_selection':
        this.emit('user_selection', message.data);
        break;
        
      case 'presence_update':
        this.emit('presence_update', message.data);
        break;
        
      case 'pong':
        console.log('💓 Heartbeat pong received');
        break;
        
      default:
        console.log('❓ Unknown message type:', message.type, message);
    }
  }

  private isValidCursorData(data: any): boolean {
    return data && 
           typeof data === 'object' && 
           data.userId && 
           typeof data.userId === 'string' &&
           data.userId.trim().length > 0;
  }

  sendCursorUpdate(position: CursorPosition) {
    if (!this.currentUser) {
      console.warn('⚠️ Cannot send cursor update: no current user');
      return;
    }

    if (!this.isConnected || !this.connectionId || !simpleWebSocketService.isConnected(this.connectionId)) {
      return;
    }

    const cursorMessage = {
      type: 'cursor_update',
      cursor: {
        userId: this.currentUser.id,
        username: this.currentUser.username,
        role: this.currentUser.role,
        position,
        color: this.currentUser.color,
        lastSeen: new Date().toISOString()
      }
    };

    this.sendMessage(cursorMessage);
  }

  sendSchemaChange(change: SchemaChange) {
    this.sendMessage({
      type: 'schema_change',
      changeType: change.type,
      data: change.data,
      userId: this.currentUser!.id,
      username: this.currentUser!.username,
      timestamp: new Date().toISOString()
    });
  }

  sendUserSelection(selection: { tableId?: string; columnId?: string }) {
    this.sendMessage({
      type: 'user_selection',
      data: {
        userId: this.currentUser!.id,
        selection,
        timestamp: new Date().toISOString()
      }
    });
  }

  updatePresence(status: 'online' | 'away' | 'busy', currentAction?: string) {
    this.sendMessage({
      type: 'presence_update',
      data: {
        userId: this.currentUser!.id,
        status,
        currentAction,
        timestamp: new Date().toISOString()
      }
    });
  }

  private sendMessage(message: any) {
    if (!this.connectionId || !this.isConnected || !simpleWebSocketService.isConnected(this.connectionId)) {
      console.warn('⚠️ WebSocket not connected, message not sent:', {
        messageType: message.type,
        connectionId: this.connectionId,
        isConnected: this.isConnected,
        serviceConnected: this.connectionId ? simpleWebSocketService.isConnected(this.connectionId) : false
      });
      return;
    }

    try {
      simpleWebSocketService.sendMessage(this.connectionId, message);
      console.log('📤 Message sent successfully:', message.type);
    } catch (error) {
      console.error('❌ Failed to send message:', error, message);
    }
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting from Collaboration WebSocket');
    
    // Send leave message if connected
    if (this.connectionId && this.currentUser && this.isConnected && this.userJoinSent) {
      try {
        this.sendMessage({
          type: 'user_leave',
          userId: this.currentUser.id,
          schemaId: this.schemaId
        });
      } catch (error) {
        console.warn('⚠️ Failed to send user_leave message:', error);
      }
    }
    
    // Disconnect after a short delay
    setTimeout(() => {
      if (this.connectionId) {
        simpleWebSocketService.disconnect(this.connectionId);
        this.connectionId = null;
      }
      this.isConnected = false;
      this.userJoinSent = false;
    }, 200);
  }

  // Utility methods
  isConnectedState(): boolean {
    return this.isConnected && 
           this.connectionId !== null && 
           simpleWebSocketService.isConnected(this.connectionId);
  }

  getConnectionState(): string {
    if (!this.connectionId) return 'CLOSED';
    return this.isConnectedState() ? 'OPEN' : 'CLOSED';
  }

  // Conflict resolution methods (unchanged)
  transformOperation(operation: any, otherOperation: any): any {
    if (operation.type === 'table_update' && otherOperation.type === 'table_update') {
      if (operation.tableId === otherOperation.tableId) {
        return this.mergeTableOperations(operation, otherOperation);
      }
    }
    return operation;
  }

  private mergeTableOperations(op1: any, op2: any): any {
    return {
      ...op1,
      data: {
        ...op1.data,
        ...op2.data,
        lastModified: Math.max(
          new Date(op1.timestamp).getTime(),
          new Date(op2.timestamp).getTime()
        )
      }
    };
  }

  resolveConflict(localChange: any, remoteChange: any): any {
    return remoteChange;
  }
}

export const collaborationService = new CollaborationService();