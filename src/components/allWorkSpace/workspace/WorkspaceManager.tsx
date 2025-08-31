import React, { useState, useEffect } from 'react';
import { Database, Users, Share2, Loader, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';
import { useAuth } from '../../../context/AuthContext';
import { apiService } from '../../../services/apiService';
import { socketService } from '../../../services/socketService';
import InvitationForm from '../../workspace/InvitationForm';
import TeamMembersList from '../../workspace/TeamMembersList';
import SharedSchemas from '../../workspace/SharedSchemas';

interface WorkspaceData {
  id: string;
  name: string;
  ownerId: string;
  members: Array<{
    username: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string | Date;
  }>;
  sharedSchemas: Array<{
    schemaId: string;
    name: string;
    scripts: string;
    lastModified: string | Date;
  }>;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface WorkspaceManagerProps {
  workspaceId: string;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ workspaceId }) => {
  const { currentSchema, importSchema } = useDatabase();
  const { getCurrentUser } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'invite' | 'schemas'>('members');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    initializeWorkspace();

    return () => {
      socketService.leaveWorkspace();
    };
  }, [workspaceId]);

  const initializeWorkspace = async () => {
    try {
      // Connect to Socket.IO
  await socketService.connect();
  setIsConnected(true);

  // Join workspace room (will store and emit after connect if socket not ready)
  socketService.joinWorkspace(workspaceId);

  // Load workspace data (with fallback if the requested workspace doesn't exist)
  await loadWorkspace();
      
    } catch (error) {
      console.error('❌ Failed to initialize workspace:', error);
      setError('Failed to connect to workspace');
      setIsConnected(false);
    }
  };

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('📂 Loading workspace:', workspaceId);
      const data = await apiService.get(`/workspaces/${workspaceId}`);
      console.log('✅ Workspace loaded:', data);
      
      setWorkspace(data);
      
      // Load first shared schema if available (only if owner or editor)
      if (data.sharedSchemas && data.sharedSchemas.length > 0) {
        const firstSchema = data.sharedSchemas[0];
        if (firstSchema.scripts) {
          try {
            const schemaData = JSON.parse(firstSchema.scripts);
            importSchema(schemaData);
            console.log('✅ Shared schema loaded:', firstSchema.name);
          } catch (parseError) {
            console.error('❌ Failed to parse shared schema:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading workspace:', error);

      // Fallback strategy when specific workspace is not found or inaccessible:
      // 1) Try to list workspaces for the user and pick the first one.
      // 2) If none exist, attempt to create a workspace with the requested id (requires auth).
      try {
        const list = await apiService.get('/workspaces');
        if (Array.isArray(list) && list.length > 0) {
          console.log('ℹ️ Falling back to first available workspace:', list[0].id);
          setWorkspace(list[0]);
          // Ensure socket joined the new workspace id
          try { socketService.joinWorkspace(list[0].id); } catch (e) { /* ignore */ }
          return;
        }
      } catch (listErr) {
        console.warn('ℹ️ Failed to list user workspaces as fallback:', listErr);
      }

      // If no workspaces found, try to create the requested default workspace.
      try {
        console.log('🏗️ Attempting to create workspace:', workspaceId);
        const created = await apiService.post('/workspaces', { id: workspaceId, name: 'Default Workspace' });
        console.log('✅ Created workspace as fallback:', created.id || created);
        setWorkspace(created);
        try { socketService.joinWorkspace(created.id || workspaceId); } catch (e) { /* ignore */ }
        return;
      } catch (createErr) {
        console.error('❌ Failed to create fallback workspace:', createErr);
        setError(createErr instanceof Error ? createErr.message : 'Failed to load workspace');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteSuccess = (updatedMembers: any[]) => {
    if (workspace) {
      setWorkspace({
        ...workspace,
        members: updatedMembers,
        updatedAt: new Date()
      });
    }
  };

  const handleMembersUpdate = (updatedMembers: any[]) => {
    if (workspace) {
      setWorkspace({
        ...workspace,
        members: updatedMembers,
        updatedAt: new Date()
      });
    }
  };

  const handleSchemaLoad = (schemaData: any) => {
    importSchema(schemaData);
  };

  const shareCurrentSchema = async () => {
    if (!workspace || !currentSchema) return;

    try {
      console.log('📤 Sharing current schema:', currentSchema.name);
      
      const data = await apiService.post(`/workspaces/${workspaceId}/schemas`, {
        schemaId: currentSchema.id,
        name: currentSchema.name,
        scripts: JSON.stringify(currentSchema)
      });

      console.log('✅ Schema shared successfully:', data);
      
      // Refresh workspace to get updated shared schemas
      await loadWorkspace();
      
    } catch (error) {
      console.error('❌ Failed to share schema:', error);
      setError(error instanceof Error ? error.message : 'Failed to share schema');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading workspace...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-200 font-medium">Error</span>
        </div>
        <div className="text-red-700 dark:text-red-300 mb-4">{error}</div>
        <button
          onClick={loadWorkspace}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center p-8">
        <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Workspace not found</p>
      </div>
    );
  }

  const currentUser = getCurrentUser();
  const currentUserRole = workspace && currentUser
    ? (workspace.members.find(m => m.username === currentUser.username)?.role || 'viewer')
    : 'viewer';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {workspace.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {workspace.members.length} members • {workspace.sharedSchemas.length} shared schemas
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {currentUserRole === 'owner' && (
              <button
                onClick={shareCurrentSchema}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
              >
                <Share2 className="w-4 h-4" />
                Share Current Schema
              </button>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          isConnected
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
        }`}>
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Real-time sync active</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Connecting to real-time sync...</span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          {[
            { id: 'members', name: 'Team Members', icon: Users },
            { id: 'invite', name: 'Invite Users', icon: Share2 },
            { id: 'schemas', name: 'Shared Schemas', icon: Database }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 py-3 px-6 border-b-2 font-medium text-sm transition-colors duration-200
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'members' && (
            <TeamMembersList
              workspaceId={workspace.id}
              members={workspace.members}
              onMembersUpdate={handleMembersUpdate}
              currentUserRole={currentUserRole}
            />
        )}

        {activeTab === 'invite' && (
          <InvitationForm
            workspaceId={workspace.id}
            onInviteSuccess={handleInviteSuccess}
          />
        )}

        {activeTab === 'schemas' && (
          <SharedSchemas
            workspaceId={workspace.id}
            onSchemaLoad={handleSchemaLoad}
            currentUserRole={currentUserRole}
          />
        )}
      </div>
    </div>
  );
};

export default WorkspaceManager;