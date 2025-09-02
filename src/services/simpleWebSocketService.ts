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

  /**
   * Connect to the server.
   * Accepts either a workspaceId or a URL; if URL is provided, base/path are parsed.
   */
  connect(workspaceIdOrUrl?: string): Promise<void> {
    // parse base & path from config defaults
    let base = (config.SOCKET_SERVER_BASE || '').replace(/\/+$/, '');
    let path = config.SOCKET_PATH || '/ws/portfolio-updates';
    let providedWorkspaceId: string | undefined;

    if (workspaceIdOrUrl) {
      const looksLikeUrl = /^(wss?:\/\/|https?:\/\/)|\/ws\//i.test(workspaceIdOrUrl);
      if (looksLikeUrl) {
        try {
          const normalized = workspaceIdOrUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
          const u = new URL(normalized, window.location.origin);
          base = `${u.protocol}//${u.host}`;
          const wsIndex = u.pathname.indexOf('/ws/');
          if (wsIndex >= 0) {
            path = u.pathname.substring(wsIndex);
          } else {
            path = u.pathname || path;
          }
          const parts = u.pathname.split('/').filter(Boolean);
          if (parts.length > 0) {
            providedWorkspaceId = parts[parts.length - 1];
          }
        } catch (e) {
          console.warn('simpleWebSocketService: failed to parse provided URL, falling back to defaults', e);
        }
      } else {
        providedWorkspaceId = workspaceIdOrUrl;
      }
    }

    // If already connected, optionally join workspace and resolve
    if (this.socket && this.socket.connected) {
      if (providedWorkspaceId) this.joinWorkspace(providedWorkspaceId);
      return Promise.resolve();
    }

    if (this.connectingPromise) return this.connectingPromise;

    console.log('🔌 Connecting to Socket.IO:', base, 'path:', path);

    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(base, {
          path,
          transports: ['websocket', 'polling'],
          withCredentials: true,
          autoConnect: true,
          timeout: 10000,
          reconnection: true
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected:', this.socket?.id);
          this.connectingPromise = null;
          if (providedWorkspaceId) {
            this.joinWorkspace(providedWorkspaceId);
          }
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
          this.emit('disconnect', reason);
        });

        // forward selected server events to our local handlers
        ['member_added', 'member_removed', 'member_updated', 'db_update', 'message', 'cursor_update', 'user_joined', 'user_left', 'schema_change', 'user_selection', 'presence_update'].forEach(evt => {
          this.socket?.on(evt, (data: any) => {
            // emit named event for modern listeners
            this.emit(evt, data);
            // also emit a legacy 'message' wrapper so older services that subscribe to
            // 'message' (with { type, data }) receive the event in a compatible shape
            try {
              if (evt !== 'message') {
                this.emit('message', { type: evt, data });
              }
            } catch (e) {
              console.warn('Failed to forward event as message wrapper', evt, e);
            }
          });
        });

        // in case server uses 'message' - already included above, but keep for clarity
        this.socket?.on('message', (m: any) => this.emit('message', m));
      } catch (err) {
        this.connectingPromise = null;
        this.socket = null;
        console.error('Failed to init socket client:', err);
        reject(err);
      }
    });

    return this.connectingPromise;
  }

  joinWorkspace(workspaceIdOrUrl: string) {
    if (!workspaceIdOrUrl) return;
    let workspaceId = workspaceIdOrUrl;
    if (/^(wss?:\/\/|https?:\/\/)|\/ws\//i.test(workspaceIdOrUrl)) {
      try {
        const normalized = workspaceIdOrUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
        const u = new URL(normalized, window.location.origin);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length > 0) workspaceId = parts[parts.length - 1];
      } catch (e) {
        // fallback
      }
    }

    if (!this.socket || !this.socket.connected) {
      console.log('Socket not connected, will join after connect. storing workspaceId:', workspaceId);
      this.currentWorkspaceId = workspaceId;
      return;
    }

    console.log('🏠 Joining workspace:', workspaceId);
    this.currentWorkspaceId = workspaceId;
    try {
      this.socket.emit('join_workspace', workspaceId);
    } catch (e) {
      console.error('Failed to emit join_workspace:', e);
    }
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

  disconnect(_connectionId?: string) {
    // ignore connectionId param; we manage a single socket instance
    if (this.socket) {
      this.leaveWorkspace();
      try { this.socket.close(); } catch {}
      this.socket = null;
      console.log('🔌 Socket disconnected');
    }
    this.connectingPromise = null;
  }

  /**
   * Backward-compatible isConnected.
   * If a connectionId is passed, it's ignored (we only manage one underlying socket here).
   */
  isConnected(_connectionId?: string): boolean {
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

  /**
   * send(eventName, data) - canonical emit
   * sendMessage(...) - backward compatible: supports different call patterns:
   * - sendMessage(messageObject) -> will emit messageObject.type (if present) or 'message'
   * - sendMessage(eventName, data) -> will emit eventName with data
   * - sendMessage(connectionId, messageObject) -> common older pattern; connectionId is ignored and messageObject is emitted
   */
  send(event: string, data?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot send, socket not connected.');
    }
  }

  sendMessage(arg1: any, arg2?: any) {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot sendMessage, socket not connected.');
      return;
    }

    // Pattern 1: (connectionId, messageObject)
    if (typeof arg1 === 'string' && arg2 && typeof arg2 === 'object') {
      // older code passed connectionId as first param; we ignore it and send the message object
      const message = arg2;
      const eventName = message && message.type ? message.type : 'message';
      this.socket.emit(eventName, message);
      return;
    }

    // Pattern 2: (eventName, data) OR (eventName) 
    if (typeof arg1 === 'string' && (arg2 === undefined || arg2 !== undefined)) {
      const eventName = arg1;
      const data = arg2;
      this.socket.emit(eventName, data);
      return;
    }

    // Pattern 3: (messageObject)
    if (typeof arg1 === 'object' && arg1 !== null) {
      const message = arg1;
      const eventName = message && message.type ? message.type : 'message';
      this.socket.emit(eventName, message);
      return;
    }

    console.warn('sendMessage: unsupported arguments', arg1, arg2);
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();
export default simpleWebSocketService;
