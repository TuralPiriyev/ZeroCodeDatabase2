import { io, Socket } from 'socket.io-client';
import { config } from '../config/environment';

class SocketService {
  private socket: Socket | null = null;
  private currentWorkspaceId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        resolve(this.socket);
        return;
      }

      const socketUrl = config.WS_BASE_URL;
      console.log('🔌 Connecting to Socket.IO:', socketUrl);

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 10000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        autoConnect: true
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id);
        this.reconnectAttempts = 0;
        
        // Rejoin workspace if we were in one
        if (this.currentWorkspaceId) {
          this.joinWorkspace(this.currentWorkspaceId);
        }
        
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${error.message}`));
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO disconnected:', reason);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          setTimeout(() => {
            if (this.socket) {
              this.socket.connect();
            }
          }, this.reconnectDelay);
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
        this.reconnectAttempts = 0;
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Socket.IO reconnection error:', error);
      });

      // Workspace-specific events
      this.socket.on('member_added', (data) => {
        console.log('👋 Member added:', data);
        this.emit('member_added', data);
      });

      this.socket.on('member_removed', (data) => {
        console.log('👋 Member removed:', data);
        this.emit('member_removed', data);
      });

      this.socket.on('member_updated', (data) => {
        console.log('👤 Member updated:', data);
        this.emit('member_updated', data);
      });

      this.socket.on('db_update', (data) => {
        console.log('🔄 Database updated:', data);
        this.emit('db_update', data);
      });
    });
  }

  joinWorkspace(workspaceId: string) {
    if (this.socket && this.socket.connected) {
      console.log('🏠 Joining workspace:', workspaceId);
      this.currentWorkspaceId = workspaceId;
      this.socket.emit('join_workspace', workspaceId);
    }
  }

  leaveWorkspace() {
    if (this.socket && this.socket.connected && this.currentWorkspaceId) {
      console.log('🚪 Leaving workspace:', this.currentWorkspaceId);
      this.socket.emit('leave_workspace', this.currentWorkspaceId);
      this.currentWorkspaceId = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.leaveWorkspace();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Event emitter functionality
  private eventHandlers: Map<string, Function[]> = new Map();

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
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in socket event handler for ${event}:`, error);
        }
      });
    }
  }
}

export const socketService = new SocketService();
export default socketService;