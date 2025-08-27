// src/services/socketService.ts
import simpleWebSocketService from './simpleWebSocketService';

class SocketServiceWrapper {
  connect(workspaceId?: string) {
    return simpleWebSocketService.connect(workspaceId);
  }
  joinWorkspace(id: string) { simpleWebSocketService.joinWorkspace(id); }
  leaveWorkspace() { simpleWebSocketService.leaveWorkspace(); }
  disconnect() { simpleWebSocketService.disconnect(); }
  send(event: string, data?: any) { simpleWebSocketService.send(event, data); }
  isConnected() { return simpleWebSocketService.isConnected(); }
  on(evt: string, handler: any) { simpleWebSocketService.on(evt, handler); }
  off(evt: string, handler: any) { simpleWebSocketService.off(evt, handler); }
}

export const socketService = new SocketServiceWrapper();
export default socketService;
