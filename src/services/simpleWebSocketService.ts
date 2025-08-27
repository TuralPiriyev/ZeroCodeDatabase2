// src/services/simpleWebSocketService.ts
import { io, Socket } from 'socket.io-client';
import config from '../config/environment';

type EventHandler = (data?: any) => void;

class SimpleWebSocketService {
  private static instance: SimpleWebSocketService;
  private socket: Socket | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private currentWorkspaceId: string | null = null;
  private connectingPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SimpleWebSocketService {
    if (!SimpleWebSocketService.instance) {
      SimpleWebSocketService.instance = new SimpleWebSocketService();
    }
    return SimpleWebSocketService.instance;
  }

  connect(workspaceId?: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      if (workspaceId) this.joinWorkspace(workspaceId);
      return Promise.resolve();
    }
    if (this.connectingPromise) return this.connectingPromise;

    const base = config.SOCKET_SERVER_BASE;
    const path = config.SOCKET_PATH;
    console.log('🔌 Connecting to Socket.IO:', base, 'path:', path);

    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(base, {
          path,
          transports: ['websocket', 'polling'],
          withCredentials: true,
          autoConnect: true,
          timeout: 10000
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected:', this.socket?.id);
          this.connectingPromise = null;
          if (workspaceId) this.joinWorkspace(workspaceId);
          resolve();
        });

        this.socket.on('connect_error', (err: any) => {
          console.error('❌ Socket.IO connection error:', err);
          this.connectingPromise = null;
          try { this.socket?.close(); } catch {}
          this.socket = null;
          reject(err);
        });

        this.socket.on('disconnect', (reason: any) => {
          console.warn('❌ Socket.IO disconnected:', reason);
        });

        // forward server events to local handlers
        ['member_added', 'member_removed', 'member_updated', 'db_update'].forEach(evt => {
          this.socket?.on(evt, (data: any) => this.emit(evt, data));
        });
      } catch (err) {
        this.connectingPromise = null;
        this.socket = null;
        console.error('Failed to init socket client:', err);
        reject(err);
      }
    });

    return this.connectingPromise;
  }

  joinWorkspace(workspaceId: string) {
    if (!workspaceId) return;
    if (!this.socket || !this.socket.connected) {
      console.log('Socket not connected, will join after connect.');
      this.currentWorkspaceId = workspaceId;
      return;
    }
    console.log('🏠 Joining workspace:', workspaceId);
    this.currentWorkspaceId = workspaceId;
    this.socket.emit('join_workspace', workspaceId);
  }

  leaveWorkspace() {
    if (this.socket && this.socket.connected && this.currentWorkspaceId) {
      console.log('🚪 Leaving workspace:', this.currentWorkspaceId);
      this.socket.emit('leave_workspace', this.currentWorkspaceId);
      this.currentWorkspaceId = null;
    } else {
      this.currentWorkspaceId = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.leaveWorkspace();
      try { this.socket.close(); } catch {}
      this.socket = null;
      console.log('🔌 Socket disconnected');
    }
    this.connectingPromise = null;
  }

  isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const i = handlers.indexOf(handler);
      if (i > -1) handlers.splice(i, 1);
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) handlers.forEach(fn => { try { fn(data); } catch (e) { console.error('handler error', e); } });
  }

  send(event: string, data?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot send, socket not connected.');
    }
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();
export default simpleWebSocketService;
