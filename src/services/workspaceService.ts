// src/services/workspaceService.ts
import { simpleWebSocketService } from './simpleWebSocketService';
import { apiService } from './apiService';

interface SharedSchema {
  schemaId: string;
  name: string;
  scripts: string;
  lastModified: Date;
}

interface WorkspaceData {
  id: string;
  name: string;
  ownerId: string;
  members: Array<{
    username: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: Date;
  }>;
  sharedSchemas: SharedSchema[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type WorkspaceEventHandler = (payload?: any) => void;

class WorkspaceService {
  private connectionId: string | null = null;
  private currentWorkspaceId: string | null = null;
  private eventHandlers: Map<string, WorkspaceEventHandler[]> = new Map();

  // store reference to the socket message handler so we can off() it later
  private _socketMessageHandler: ((msg: any) => void) | null = null;
  private _socketDisconnectHandler: ((reason: any) => void) | null = null;

  constructor() {
    this.eventHandlers = new Map();
  }

  /**
   * Connect to a named workspace. Uses simpleWebSocketService.connect(...)
   * and then joins the workspace via joinWorkspace.
   */
  async connectToWorkspace(workspaceId: string): Promise<void> {
    if (this.connectionId && this.currentWorkspaceId === workspaceId) {
      console.log('Already connected to workspace:', workspaceId);
      return;
    }

    // Disconnect previous
    if (this.connectionId) {
      this.disconnect();
    }

    this.currentWorkspaceId = workspaceId;
    const wsUrl = `/ws/workspace/${workspaceId}`;

    try {
      // connect establishes the underlying socket and may join workspace automatically
      await simpleWebSocketService.connect(wsUrl);

      // record connectionId as workspaceId (we use a single socket instance)
      this.connectionId = this.currentWorkspaceId;

      // ensure we are joined (joinWorkspace is safe to call even if already joined)
      simpleWebSocketService.joinWorkspace(workspaceId);

      console.log('✅ Connected to workspace WebSocket:', workspaceId);
      this.emit('connected', { workspaceId });

      // register handlers to receive messages / disconnects
      // ensure previous handlers removed
      if (this._socketMessageHandler) {
        simpleWebSocketService.off('message', this._socketMessageHandler);
        this._socketMessageHandler = null;
      }
      this._socketMessageHandler = (message: any) => this.handleWorkspaceMessage(message);
      simpleWebSocketService.on('message', this._socketMessageHandler);

      if (this._socketDisconnectHandler) {
        simpleWebSocketService.off('disconnect', this._socketDisconnectHandler);
        this._socketDisconnectHandler = null;
      }
      this._socketDisconnectHandler = (reason: any) => {
        console.log('❌ Disconnected from workspace WebSocket (service):', reason);
        this.emit('disconnected', { workspaceId: this.currentWorkspaceId, reason });
      };
      simpleWebSocketService.on('disconnect', this._socketDisconnectHandler);
    } catch (error) {
      console.error('Failed to connect to workspace WebSocket:', error);
      // clear partially set state
      this.connectionId = null;
      this.currentWorkspaceId = null;
      throw error;
    }
  }

  private handleWorkspaceMessage(message: any) {
    if (!message) return;
    console.log('📨 Workspace message received:', message.type, message);

    switch (message.type) {
      case 'db_update':
        this.handleDatabaseUpdate(message.data);
        break;
      case 'member_joined':
        this.emit('member_joined', message.data);
        break;
      case 'member_left':
        this.emit('member_left', message.data);
        break;
      case 'schema_shared':
        this.emit('schema_shared', message.data);
        break;
      case 'workspace_updated':
        this.emit('workspace_updated', message.data);
        break;
      default:
        console.log('Unknown workspace message type:', message.type);
    }
  }

  private handleDatabaseUpdate(data: any) {
    console.log('🔄 Database update received:', data);

    this.emit('db_update', {
      schemaId: data?.schemaId,
      changeType: data?.changeType,
      schema: data?.schema,
      timestamp: data?.timestamp
    });
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceData | null> {
    try {
  const workspace = await apiService.get(`/workspaces/${workspaceId}`);

      return {
        ...workspace,
        createdAt: new Date(workspace.createdAt),
        updatedAt: new Date(workspace.updatedAt),
        members: (workspace.members || []).map((member: any) => ({
          ...member,
          joinedAt: new Date(member.joinedAt)
        })),
        sharedSchemas: (workspace.sharedSchemas || []).map((schema: any) => ({
          ...schema,
          lastModified: new Date(schema.lastModified)
        }))
      };
    } catch (error) {
      console.error('Error fetching workspace:', error);
      return null;
    }
  }

  async updateSharedSchema(workspaceId: string, schemaId: string, name: string, scripts: string): Promise<boolean> {
    try {
      await apiService.put(`/workspaces/${workspaceId}/schemas`, {
        schemaId,
        name,
        scripts
      });

      // Broadcast database update to other workspace members
      this.broadcastDatabaseUpdate(schemaId, 'schema_updated', {
        schemaId,
        name,
        scripts,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error updating shared schema:', error);
      return false;
    }
  }

  broadcastDatabaseUpdate(schemaId: string, changeType: string, data: any) {
    if (!this.connectionId || !simpleWebSocketService.isConnected()) {
      console.warn('Cannot broadcast database update: not connected to workspace');
      return;
    }

    const message = {
      type: 'db_update',
      data: {
        schemaId,
        changeType,
        ...data,
        timestamp: new Date().toISOString()
      }
    };

    // Prefer canonical send(event, data) — server should listen to 'db_update' event
    try {
      simpleWebSocketService.send('db_update', message.data);
      console.log('📤 Database update broadcasted:', changeType, schemaId);
    } catch (err) {
      // fallback to backward-compatible sendMessage
      try {
        // send whole message object; simpleWebSocketService.sendMessage will emit message.type
        simpleWebSocketService.sendMessage(message);
        console.log('📤 Database update broadcasted (fallback):', changeType, schemaId);
      } catch (e) {
        console.error('Failed to broadcast database update:', e);
      }
    }
  }

  on(event: string, handler: WorkspaceEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WorkspaceEventHandler) {
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
          console.error(`Error in workspace event handler for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    // remove event listeners registered on the simpleWebSocketService
    if (this._socketMessageHandler) {
      simpleWebSocketService.off('message', this._socketMessageHandler);
      this._socketMessageHandler = null;
    }
    if (this._socketDisconnectHandler) {
      simpleWebSocketService.off('disconnect', this._socketDisconnectHandler);
      this._socketDisconnectHandler = null;
    }

    // leave workspace and optionally disconnect socket (singleton)
    if (this.connectionId) {
      try {
        simpleWebSocketService.leaveWorkspace();
      } catch (e) {
        // ignore
      }
      // do not forcibly disconnect the underlying socket here unless you want global disconnect:
      // simpleWebSocketService.disconnect();
      this.connectionId = null;
    }

    this.currentWorkspaceId = null;
  }

  isConnected(): boolean {
    return this.connectionId !== null && simpleWebSocketService.isConnected();
  }

  getCurrentWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }
}

export const workspaceService = new WorkspaceService();
export type { WorkspaceData, SharedSchema };
