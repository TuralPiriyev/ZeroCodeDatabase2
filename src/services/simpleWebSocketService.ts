import { io, Socket } from "socket.io-client";
import { config } from "../config/environment";

type EventHandler = (data?: any) => void;

class SimpleWebSocketService {
  private static instance: SimpleWebSocketService;
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private currentWorkspaceId: string | null = null;

  private constructor() {}

  static getInstance(): SimpleWebSocketService {
    if (!SimpleWebSocketService.instance) {
      SimpleWebSocketService.instance = new SimpleWebSocketService();
    }
    return SimpleWebSocketService.instance;
  }

  connect(workspaceId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        resolve();
        return;
      }

      const socketUrl = config.WS_BASE_URL;
      console.log("🔌 Connecting to Socket.IO:", socketUrl);

      this.socket = io(socketUrl, {
        path: "/ws/portfolio-updates",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        autoConnect: true,
      });

      this.socket.on("connect", () => {
        console.log("✅ Socket.IO connected:", this.socket?.id);
        this.reconnectAttempts = 0;
        if (workspaceId) this.joinWorkspace(workspaceId);
        resolve();
      });

      this.socket.on("connect_error", (err: any) => {
        console.error("❌ Socket.IO connection error:", err);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error("Failed to connect to WebSocket server."));
        }
      });

      this.socket.on("disconnect", (reason) => {
        console.warn("❌ Socket.IO disconnected:", reason);
      });

      ["member_added", "member_removed", "member_updated", "db_update"].forEach(
        (event) => {
          this.socket?.on(event, (data: any) => this.emit(event, data));
        }
      );
    });
  }

  joinWorkspace(workspaceId: string) {
    if (this.socket && this.socket.connected) {
      console.log("🏠 Joining workspace:", workspaceId);
      this.currentWorkspaceId = workspaceId;
      this.socket.emit("join_workspace", workspaceId);
    }
  }

  leaveWorkspace() {
    if (this.socket && this.socket.connected && this.currentWorkspaceId) {
      console.log("🚪 Leaving workspace:", this.currentWorkspaceId);
      this.socket.emit("leave_workspace", this.currentWorkspaceId);
      this.currentWorkspaceId = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.leaveWorkspace();
      this.socket.disconnect();
      this.socket = null;
      console.log("🔌 Socket disconnected");
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) handlers.forEach((fn) => { try { fn(data); } catch {} });
  }

  send(event: string, data?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn("Cannot send, socket not connected.");
    }
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();
export default simpleWebSocketService;
