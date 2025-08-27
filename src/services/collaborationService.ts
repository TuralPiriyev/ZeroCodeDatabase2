// src/services/collaborationService.ts
import { simpleWebSocketService } from './simpleWebSocketService';

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

export default class CollaborationService {
  private connectionId: string | null = null; // we'll store schemaId here
  private currentUser: CollaborationUser | null = null;
  private schemaId: string | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  public isConnected = false;
  private userJoinSent = false;

  // keep references so we can off() them on disconnect
  private _socketHandlers: Map<string, (...args: any[]) => void> = new Map();

  constructor() {
    // All WebSocket operations delegated to simpleWebSocketService
  }

  initialize(user: CollaborationUser, schemaId: string) {
    this.currentUser = user;
    this.schemaId = schemaId;
    this.userJoinSent = false; // Reset join status
    console.log('🔧 CollaborationService initialized:', { user: user.username, schemaId });
  }

  async connect(): Promise<void> {
    if (!this.currentUser || !this.schemaId) {
      const error = new Error('Must initialize with user and schema ID before connecting');
      console.error('❌ Connection failed:', error.message);
      return Promise.reject(error);
    }

    // If already connected according to service, resolve
    if (this.isConnected && simpleWebSocketService.isConnected()) {
      console.log('✅ WebSocket already connected');
      return Promise.resolve();
    }

    try {
      // Connect via shared service (service will join workspace if schemaId provided)
      await simpleWebSocketService.connect(this.schemaId);
      // mark connectionId as the schemaId for our bookkeeping
      this.connectionId = this.schemaId;
      // ensure we have joined the workspace on the service
      simpleWebSocketService.joinWorkspace(this.schemaId);
      this.isConnected = true;
      console.log('✅ Collaboration WebSocket connected successfully (via simpleWebSocketService)');

      // Register handlers for server-emitted events. Adapt mapping depending on server.
      this.registerSocketHandlers();

      // send user join (if not already)
      this.sendUserJoin();

      // notify local listeners
      this.emit('connected');
      return Promise.resolve();
    } catch (err: any) {
      console.error('❌ Collaboration WebSocket connect failed:', err);
      this.isConnected = false;
      this.emit('error', err);
      return Promise.reject(err);
    }
  }

  private registerSocketHandlers() {
    // clear old handlers if any
    this._socketHandlers.forEach((handler, evt) => {
      simpleWebSocketService.off(evt, handler);
    });
    this._socketHandlers.clear();

    // Map of events we expect from simpleWebSocketService/socket.io server
    const memberAdded = (data: any) => {
      console.log('👋 Member added:', data);
      // adapt to the collaborationService event names
      this.emit('user_joined', data);
    };
    simpleWebSocketService.on('member_added', memberAdded);
    this._socketHandlers.set('member_added', memberAdded);

    const memberRemoved = (data: any) => {
      console.log('👋 Member removed:', data);
      this.emit('user_left', data);
    };
    simpleWebSocketService.on('member_removed', memberRemoved);
    this._socketHandlers.set('member_removed', memberRemoved);

    const memberUpdated = (data: any) => {
      console.log('👤 Member updated:', data);
      this.emit('member_updated', data);
    };
    simpleWebSocketService.on('member_updated', memberUpdated);
    this._socketHandlers.set('member_updated', memberUpdated);

    const dbUpdate = (data: any) => {
      console.log('🔄 DB update:', data);
      this.emit('db_update', data);
    };
    simpleWebSocketService.on('db_update', dbUpdate);
    this._socketHandlers.set('db_update', dbUpdate);

    // Fallback: listen to a generic "message" event if your service exposes it.
    const generic = (message: any) => {
      // If server sends structured messages like { type: 'cursor_update', data: {...} }
      if (message && message.type) {
        console.log('📨 Generic message received:', message.type);
        // route to existing handler pipeline
        this.handleMessage(message);
      } else {
        console.log('📨 Raw message received:', message);
      }
    };
    simpleWebSocketService.on('message', generic);
    this._socketHandlers.set('message', generic);

    // Also listen for disconnect/error events emitted by the service itself (if it emits them)
    const onDisconnect = (reason: any) => {
      console.log('❌ Collaboration WebSocket disconnected:', reason);
      this.isConnected = false;
      this.userJoinSent = false;
      this.emit('disconnected', reason);
    };
    simpleWebSocketService.on('disconnect', onDisconnect);
    this._socketHandlers.set('disconnect', onDisconnect);

    const onError = (err: any) => {
      console.error('❌ Collaboration WebSocket error (service):', err);
      this.emit('error', err);
    };
    simpleWebSocketService.on('error', onError);
    this._socketHandlers.set('error', onError);
  }

  private sendUserJoin() {
    if (!this.currentUser || !this.schemaId || this.userJoinSent) return;

    try {
      // With socket.io server in this project, the canonical way to join workspace is joinWorkspace()
      // and for other services we emit an event with user info. We'll emit 'user_join' event name
      // but note: your server must be listening for this event for it to have effect.
      // The shared service's send(event, data) calls socket.emit(event, data)
      simpleWebSocketService.send('user_join', {
        userId: this.currentUser.id,
        username: this.currentUser.username,
        role: this.currentUser.role,
        color: this.currentUser.color,
        schemaId: this.schemaId,
        timestamp: new Date().toISOString()
      });
      this.userJoinSent = true;
      console.log('📤 User join message sent successfully');
    } catch (error: any) {
      console.error('❌ Failed to send user join message:', error);
    }
  }

  private handleMessage(message: any) {
    if (!message || typeof message !== 'object') return;
    console.log('📨 Received collaboration message:', message.type ?? '(no type)', message);

    const t = message.type;
    switch (t) {
      case 'connection_established':
        console.log('🔗 Connection established with server, clientId:', message.clientId);
        if (!this.userJoinSent) {
          setTimeout(() => {
            if (this.isConnected && !this.userJoinSent) this.sendUserJoin();
          }, 100);
        }
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
        {
          const cursorData = message.data ?? message.cursor ?? null;
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
        }
        break;

      case 'schema_change':
        console.log('🔄 Schema changed:', message.changeType ?? message.type);
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
        // if server uses socket.io events like 'member_added' forwarded as 'db_update' etc,
        // they were already translated in registerSocketHandlers. Here we log unknown types.
        console.log('❓ Unknown message type:', t, message);
    }
  }

  private isValidCursorData(data: any): boolean {
    return !!data && typeof data === 'object' && typeof data.userId === 'string' && data.userId.trim().length > 0;
  }

  sendCursorUpdate(position: CursorPosition) {
    if (!this.currentUser) {
      console.warn('⚠️ Cannot send cursor update: no current user');
      return;
    }

    if (!this.isConnected || !simpleWebSocketService.isConnected()) {
      console.warn('⚠️ Cannot send cursor update: not connected');
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

    // send via generic event name (server should listen for this event)
    simpleWebSocketService.send(cursorMessage.type, cursorMessage);
  }

  sendSchemaChange(change: SchemaChange) {
    if (!this.currentUser) return;
    simpleWebSocketService.send('schema_change', {
      changeType: change.type,
      data: change.data,
      userId: this.currentUser.id,
      username: this.currentUser.username,
      timestamp: new Date().toISOString()
    });
  }

  sendUserSelection(selection: { tableId?: string; columnId?: string }) {
    if (!this.currentUser) return;
    simpleWebSocketService.send('user_selection', {
      userId: this.currentUser.id,
      selection,
      timestamp: new Date().toISOString()
    });
  }

  updatePresence(status: 'online' | 'away' | 'busy', currentAction?: string) {
    if (!this.currentUser) return;
    simpleWebSocketService.send('presence_update', {
      userId: this.currentUser.id,
      status,
      currentAction,
      timestamp: new Date().toISOString()
    });
  }

  private sendMessage(message: any) {
    if (!this.isConnected || !simpleWebSocketService.isConnected()) {
      console.warn('⚠️ WebSocket not connected, message not sent:', {
        messageType: message?.type,
        connectionId: this.connectionId,
        isConnected: this.isConnected,
        serviceConnected: simpleWebSocketService.isConnected()
      });
      return;
    }

    try {
      // use event name = message.type
      simpleWebSocketService.send(message.type, message);
      console.log('📤 Message sent successfully:', message.type);
    } catch (error: any) {
      console.error('❌ Failed to send message:', error, message);
    }
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const i = handlers.indexOf(handler);
      if (i > -1) handlers.splice(i, 1);
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

    if (this.isConnected && this.userJoinSent && this.currentUser && this.schemaId) {
      try {
        simpleWebSocketService.send('user_leave', {
          userId: this.currentUser.id,
          schemaId: this.schemaId
        });
      } catch (error) {
        console.warn('⚠️ Failed to send user_leave message:', error);
      }
    }

    // Unregister handlers from service
    this._socketHandlers.forEach((handler, evt) => {
      simpleWebSocketService.off(evt, handler);
    });
    this._socketHandlers.clear();

    // leave workspace if joined
    if (this.schemaId) {
      try {
        simpleWebSocketService.leaveWorkspace();
      } catch (e) {
        // ignore
      }
    }

    // Disconnect underlying socket (if no other components use it)
    try {
      simpleWebSocketService.disconnect();
    } catch (e) {
      // ignore
    }

    this.connectionId = null;
    this.isConnected = false;
    this.userJoinSent = false;
    this.emit('disconnected');
  }

  // Utility methods
  isConnectedState(): boolean {
    return this.isConnected && simpleWebSocketService.isConnected();
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

  resolveConflict(_localChange: any, remoteChange: any): any {
    // keep signature but prefix unused param to silence linter
    return remoteChange;
  }
}

export const collaborationService = new CollaborationService();
