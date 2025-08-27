// src/services/simpleWebSocketService.ts
import { io, Socket } from 'socket.io-client';
import config from '../config/environment';

type EventHandler = (data?: any) => void;

class SimpleWebSocketService {
  private static instance: SimpleWebSocketService;
  private socket: Socket | null = null;
  private eventHandlers = new Map<string, EventHandler[]>();

  private constructor() {}

  static getInstance(): SimpleWebSocketService {
    if (!SimpleWebSocketService.instance) {
      SimpleWebSocketService.instance = new SimpleWebSocketService();
    }
    return SimpleWebSocketService.instance;
  }

  // returns Promise<Socket> so caller can use .then/.catch
  connect(workspaceId?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        if (workspaceId) this.joinWorkspace(workspaceId);
        return resolve(this.socket);
      }

      const url = config.WS_BASE_HOST;
      const path = config.WS_PATH;
      console.log('🔌 Connecting to Socket.IO host:', url, 'path:', path);

      this.socket = io(url, {
        path,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 10000,
        autoConnect: true
      });

      const onConnect = () => {
        console.log('✅ Socket.IO connected:', this.socket?.id);
        // register server events
        ['member_added', 'member_removed', 'member_updated', 'db_update'].forEach(evt => {
          this.socket?.on(evt, (data: any) => this.emit(evt, data));
        });
        if (workspaceId) this.joinWorkspace(workspaceId);
        // resolve with socket
        resolve(this.socket!);
      };

      const onError = (err: any) => {
        console.error('❌ Socket.IO connection error:', err);
        // cleanup listeners we added
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
        reject(err);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);

      this.socket.on('disconnect', (reason) => {
        console.warn('⚠️ Socket.IO disconnected:', reason);
      });
    });
  }

  joinWorkspace(workspaceId: string) {
    if (this.socket && this.socket.connected) {
      console.log('🏠 Joining workspace:', workspaceId);
      this.socket.emit('join_workspace', workspaceId);
    } else {
      console.warn('Socket not connected, cannot join workspace yet.');
    }
  }

  leaveWorkspace(workspaceId?: string) {
    const id = workspaceId ?? undefined;
    if (this.socket && this.socket.connected && id) {
      console.log('🚪 Leaving workspace:', id);
      this.socket.emit('leave_workspace', id);
    }
  }

  disconnect() {
    if (this.socket) {
      try { this.socket.disconnect(); } catch(e) {}
      this.socket = null;
      console.log('🔌 Socket disconnected');
    }
  }

  on(eventName: string, handler: EventHandler) {
    if (!this.eventHandlers.has(eventName)) this.eventHandlers.set(eventName, []);
    this.eventHandlers.get(eventName)!.push(handler);
  }

  off(eventName: string, handler: EventHandler) {
    const arr = this.eventHandlers.get(eventName);
    if (!arr) return;
    const idx = arr.indexOf(handler);
    if (idx > -1) arr.splice(idx, 1);
  }

  private emit(eventName: string, data?: any) {
    const arr = this.eventHandlers.get(eventName) ?? [];
    arr.forEach(fn => {
      try { fn(data); } catch (e) { console.error('Handler error', e); }
    });
  }

  send(eventName: string, payload?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(eventName, payload);
    } else {
      console.warn('Socket not connected, cannot send', eventName);
    }
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();
export default simpleWebSocketService;
