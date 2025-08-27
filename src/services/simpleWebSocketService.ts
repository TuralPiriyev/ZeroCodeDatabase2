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
   * Connect can accept:
   *  - undefined / workspaceId string (old behavior)
   *  - a full URL like ws://host:port/ws/portfolio-updates or https://host (legacy callers)
   *
   * If a URL is passed, we will parse base & path from it and connect accordingly.
   */
  connect(workspaceIdOrUrl?: string): Promise<void> {
    // If a URL was passed, detect and parse it
    let base = config.SOCKET_SERVER_BASE.replace(/\/+$/, '');
    let path = config.SOCKET_PATH || '/ws/portfolio-updates';
    let providedWorkspaceId: string | undefined;

    if (workspaceIdOrUrl) {
      // If looks like a URL (http(s):// or ws(s):// or contains /ws/)
      const looksLikeUrl = /^(wss?:\/\/|https?:\/\/)|\/ws\//i.test(workspaceIdOrUrl);
      if (looksLikeUrl) {
        try {
          // Normalize ws:// -> http:// for parsing
          const normalized = workspaceIdOrUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
          const u = new URL(normalized, window.location.origin);
          base = `${u.protocol}//${u.host}`; // e.g. https://api.example.com
          // find /ws/... path portion if any
          const wsIndex = u.pathname.indexOf('/ws/');
          if (wsIndex >= 0) {
            path = u.pathname.substring(wsIndex);
          } else {
            path = u.pathname || path;
          }
          // Try to infer workspaceId (last path segment)
          const parts = u.pathname.split('/').filter(Boolean);
          if (parts.length > 0) {
            providedWorkspaceId = parts[parts.length - 1];
          }
        } catch (e) {
          console.warn('simpleWebSocketService: failed to parse provided URL, falling back to defaults', e);
        }
      } else {
        // Not a URL => treat as workspaceId
        providedWorkspaceId = workspaceIdOrUrl;
      }
    }

    // If already connected to same base+path, just join workspace if given
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
          // auto-join workspace if provided
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
          // emit local handlers
          this.emit('disconnect', reason);
        });

        // forward server events to local handlers
        ['member_added', 'member_removed', 'member_updated', 'db_update', 'message'].forEach(evt => {
          this.socket?.on(evt, (data: any) => this.emit(evt, data));
        });

        // general-purpose message handler (some servers send structured messages via default event)
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

  /**
   * Join workspace. Accepts either a workspaceId or a URL (extracts last path segment).
   */
  joinWorkspace(workspaceIdOrUrl: string) {
    if (!workspaceIdOrUrl) return;
    // If a URL was passed, try to extract last segment as id
    let workspaceId = workspaceIdOrUrl;
    if (/^(wss?:\/\/|https?:\/\/)|\/ws\//i.test(workspaceIdOrUrl)) {
      try {
        const normalized = workspaceIdOrUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
        const u = new URL(normalized, window.location.origin);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length > 0) workspaceId = parts[parts.length - 1];
      } catch (e) {
        // fallback to provided string
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

  /**
   * send(event, data) - emits event with data on the socket
   */
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
