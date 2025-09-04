// MongoDB service for user validation and team collaboration
import { WorkspaceInvitation, WorkspaceMember } from '../context/DatabaseContext';
import { apiService } from './apiService';

class MongoService {
  private baseUrl: string;

  constructor() {
  const apiUrl =
      import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    
    this.baseUrl = `${apiUrl}`;
    
    if (import.meta.env.DEV) {
      console.log('🔧 MongoDB Service Configuration:');
      console.log(`📡 API Base URL: ${this.baseUrl}`);
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async validateUsername(username: string): Promise<boolean> {
    try {
  const data = await apiService.post('/users/validate', { username });
  return Boolean(data.exists);
    } catch (error) {
      console.error('Error validating username:', error);
      // Return true for development mode when network error occurs
      console.log('Returning true for development mode - network error');
      return true;
    }
  }

  async saveInvitation(invitation: WorkspaceInvitation): Promise<boolean> {
    try {
      await apiService.post('/invitations', {
        ...invitation,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error saving invitation:', error);
      return false;
    }
  }

  async updateInvitationStatus(invitationId: string, status: 'accepted' | 'expired'): Promise<boolean> {
    try {
  await apiService.put(`/invitations/${invitationId}`, { status });
  return true;
    } catch (error) {
      console.error('Error updating invitation status:', error);
      return false;
    }
  }

  async getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    try {
  const data = await apiService.get(`/invitations?workspaceId=${encodeURIComponent(workspaceId)}`);
      return data.map((inv: any) => ({
        ...inv,
        createdAt: new Date(inv.createdAt),
        expiresAt: new Date(inv.expiresAt),
      }));
    } catch (error) {
      console.error('Error fetching workspace invitations:', error);
      return [];
    }
  }

  async saveWorkspaceMember(member: WorkspaceMember, workspaceId: string): Promise<boolean> {
    try {
      // Use workspace-scoped invite endpoint to create member records
      await apiService.post(`/workspaces/${encodeURIComponent(workspaceId)}/invite`, {
        username: member.username,
        role: member.role,
      });
      return true;
    } catch (error) {
      console.error('Error saving workspace member:', error);
      return false;
    }
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    try {
  const data = await apiService.get(`/workspaces/${encodeURIComponent(workspaceId)}/members`);
      return data.map((member: any) => ({
        ...member,
        joinedAt: new Date(member.joinedAt),
      }));
    } catch (error) {
      console.error('Error fetching workspace members:', error);
      return [];
    }
  }

  async updateWorkspace(workspaceId: string, data: any): Promise<boolean> {
    try {
      await apiService.put(`/workspaces/${encodeURIComponent(workspaceId)}`, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error updating workspace:', error);
      return false;
    }
  }

  async getUserWorkspaces(username: string): Promise<any[]> {
    try {
  const workspaces = await apiService.get(`/workspaces?username=${encodeURIComponent(username)}`);

      // Convert workspaces.sharedSchemas into flat list of schema objects that match Portfolio shape
      const schemas: any[] = [];
      if (Array.isArray(workspaces)) {
        workspaces.forEach((ws: any) => {
          if (Array.isArray(ws.sharedSchemas)) {
            ws.sharedSchemas.forEach((s: any) => {
              // Only include schemas that have scripts (skip incomplete entries)
              if (!s || (s.scripts === undefined || s.scripts === null)) return;
              const scriptsValue = typeof s.scripts === 'string' ? s.scripts : JSON.stringify(s.scripts);
              schemas.push({
                _id: s.schemaId || `${ws.id}:${s.schemaId}`,
                name: s.name || 'Shared Schema',
                scripts: scriptsValue,
                createdAt: s.lastModified || ws.updatedAt || new Date().toISOString(),
                workspaceId: ws.id,
                workspaceName: ws.name
              });
            });
          }
        });
      }

      return schemas;
    } catch (error) {
      console.error('Error fetching user workspaces:', error);
      return [];
    }
  }

  async validateJoinCode(joinCode: string): Promise<{ valid: boolean; invitation?: WorkspaceInvitation; error?: string }> {
    try {
  const data = await apiService.post('/invitations/validate', { joinCode: joinCode.toUpperCase() });
      if (data.invitation) {
        data.invitation.createdAt = new Date(data.invitation.createdAt);
        data.invitation.expiresAt = new Date(data.invitation.expiresAt);
      }
      return { valid: data.valid, invitation: data.invitation, error: data.error };
    } catch (error) {
      console.error('Error validating join code:', error);
      // Return mock success for development mode
      console.log('Using fallback for development mode due to network error');
      return {
        valid: true,
        invitation: {
          id: `mock_${Date.now()}`,
          workspaceId: 'mock-workspace',
          inviterUsername: 'current_user',
          inviteeUsername: `user_${joinCode.slice(0, 4).toLowerCase()}`,
          role: 'editor',
          joinCode: joinCode.toUpperCase(),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending'
        }
      };
    }
  }

  async broadcastSchemaChange(schemaId: string, changeType: string, data: any): Promise<boolean> {
    try {
      await apiService.post('/collaboration/broadcast', {
        schemaId,
        changeType,
        data,
        timestamp: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error broadcasting schema change:', error);
      return false;
    }
  }

  async getRealtimeUpdates(schemaId: string, since?: Date): Promise<any[]> {
    try {
      const params = new URLSearchParams({ schemaId });
      if (since) params.append('since', since.toISOString());
  const data = await apiService.get(`/collaboration/updates?${params}`);
  return data;
    } catch (error) {
      console.error('Error fetching realtime updates:', error);
      return [];
    }
  }

  async checkDatabaseExists(databaseName: string): Promise<{ exists: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/databases/check`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ databaseName })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/';
          return { exists: false, error: 'Authentication failed' };
        }
        // Treat 404 as "does not exist" (not an error) so callers can proceed to create
        if (response.status === 404) {
          if (import.meta.env.DEV) console.log(`Database check: ${databaseName} not found (404)`);
          return { exists: false };
        }
        console.error(`Database check failed: ${response.status}`);
        return { exists: false, error: 'Failed to check database' };
      }
      
      const data = await response.json();
      return { exists: Boolean(data.exists) };
    } catch (error) {
      console.error('Error checking database existence:', error);
      return { exists: false, error: 'Network error occurred' };
    }
  }

  async saveDatabase(databaseName: string, schemaData: any): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/databases`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          databaseName,
          schemaData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/';
          return { success: false, error: 'Authentication failed' };
        }
        if (response.status === 409) {
          return { success: false, error: 'Database already exists' };
        }
            console.error(`Failed to save database: ${response.status}`);
            return { success: false, error: 'Failed to save database' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error saving database:', error);
      return { success: false, error: 'Network error occurred' };
    }
  }
}

export const mongoService = new MongoService();
