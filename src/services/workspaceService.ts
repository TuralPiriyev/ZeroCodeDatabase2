import { simpleWebSocketService } from './simpleWebSocketService';

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

class WorkspaceService {
  private connectionId: string | null = null;
  private currentWorkspaceId: string | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor() {
    // Initialize event handlers map
    this.eventHandlers = new Map();
  }

  async connectToWorkspace(workspaceId: string): Promise<void> {
    if (this.connectionId && this.currentWorkspaceId === workspaceId) {
      console.log('Already connected to workspace:', workspaceId);
      return;
    }

    // Disconnect from previous workspace if connected
    if (this.connectionId) {
      this.disconnect();
    }

    this.currentWorkspaceId = workspaceId;

    const wsUrl = `/ws/workspace/${workspaceId}`;
    
    try {
      this.connectionId = simpleWebSocketService.connect(wsUrl, {
        onOpen: () => {
          console.log('✅ Connected to workspace WebSocket:', workspaceId);
          this.emit('connected', { workspaceId });
        },
        onMessage: (message) => {
          this.handleWorkspaceMessage(message);
        },
        onClose: () => {
          console.log('❌ Disconnected from workspace WebSocket:', workspaceId);
          this.emit('disconnected', { workspaceId });
        },
        onError: (error) => {
          console.error('❌ Workspace WebSocket error:', error);
          this.emit('error', error);
        },
        enableReconnect: true
      });
    } catch (error) {
      console.error('Failed to connect to workspace WebSocket:', error);
      throw error;
    }
  }

  private handleWorkspaceMessage(message: any) {
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
    
    // Emit database update event for components to handle
    this.emit('db_update', {
      schemaId: data.schemaId,
      changeType: data.changeType,
      schema: data.schema,
      timestamp: data.timestamp
    });
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceData | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch workspace');
      }

      const workspace = await response.json();
      
      // Normalize dates
      return {
        ...workspace,
        createdAt: new Date(workspace.createdAt),
        updatedAt: new Date(workspace.updatedAt),
        members: workspace.members.map((member: any) => ({
          ...member,
          joinedAt: new Date(member.joinedAt)
        })),
        sharedSchemas: workspace.sharedSchemas.map((schema: any) => ({
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
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workspaces/${workspaceId}/schemas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          schemaId,
          name,
          scripts
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update shared schema');
      }

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
    if (!this.connectionId || !simpleWebSocketService.isConnected(this.connectionId)) {
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

    simpleWebSocketService.sendMessage(this.connectionId, message);
    console.log('📤 Database update broadcasted:', changeType, schemaId);
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
          console.error(`Error in workspace event handler for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.connectionId) {
      simpleWebSocketService.disconnect(this.connectionId);
      this.connectionId = null;
    }
    this.currentWorkspaceId = null;
  }

  isConnected(): boolean {
    return this.connectionId !== null && 
           simpleWebSocketService.isConnected(this.connectionId);
  }

  getCurrentWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }
}

export const workspaceService = new WorkspaceService();
export type { WorkspaceData, SharedSchema };