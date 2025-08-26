import React, { useState, useEffect } from 'react';
import { Database, Users, Share2, Loader } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { workspaceService, WorkspaceData } from '../../services/workspaceService';
import InvitationForm from './InvitationForm';
import TeamMembersList from './TeamMembersList.tsx';

interface WorkspaceManagerProps {
  workspaceId: string;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ workspaceId }) => {
  const { currentSchema, importSchema } = useDatabase();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'invite' | 'schemas'>('members');

  useEffect(() => {
    loadWorkspace();
    connectToWorkspaceUpdates();

    return () => {
      workspaceService.disconnect();
    };
  }, [workspaceId]);

  const loadWorkspace = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const workspaceData = await workspaceService.getWorkspace(workspaceId);
      if (workspaceData) {
        setWorkspace(workspaceData);
        
        // Load shared schemas into local state
        if (workspaceData.sharedSchemas.length > 0) {
          console.log('Loading shared schemas:', workspaceData.sharedSchemas.length);
          // For now, load the first shared schema
          const firstSchema = workspaceData.sharedSchemas[0];
          if (firstSchema.scripts) {
            try {
              const schemaData = JSON.parse(firstSchema.scripts);
              importSchema(schemaData);
              console.log('✅ Shared schema loaded:', firstSchema.name);
            } catch (parseError) {
              console.error('Failed to parse shared schema:', parseError);
            }
          }
        }
      } else {
        setError('Workspace not found or access denied');
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
      setError(error instanceof Error ? error.message : 'Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const connectToWorkspaceUpdates = async () => {
    try {
      await workspaceService.connectToWorkspace(workspaceId);
      
      // Set up event handlers for real-time updates
      workspaceService.on('db_update', handleDatabaseUpdate);
      workspaceService.on('member_joined', handleMemberJoined);
      workspaceService.on('member_left', handleMemberLeft);
      workspaceService.on('schema_shared', handleSchemaShared);
      
    } catch (error) {
      console.error('Failed to connect to workspace updates:', error);
    }
  };

  const handleDatabaseUpdate = (data: any) => {
    console.log('🔄 Real-time database update received:', data);
    
    if (data.schema && data.schemaId) {
      try {
        const schemaData = typeof data.schema === 'string' 
          ? JSON.parse(data.schema) 
          : data.schema;
        
        // Merge and update local schema state
        importSchema(schemaData);
        console.log('✅ Schema updated from real-time sync');
        
        // Update workspace shared schemas
        if (workspace) {
          const updatedWorkspace = { ...workspace };
          const schemaIndex = updatedWorkspace.sharedSchemas.findIndex(
            schema => schema.schemaId === data.schemaId
          );
          
          if (schemaIndex >= 0) {
            updatedWorkspace.sharedSchemas[schemaIndex] = {
              ...updatedWorkspace.sharedSchemas[schemaIndex],
              scripts: typeof data.schema === 'string' ? data.schema : JSON.stringify(data.schema),
              lastModified: new Date(data.timestamp)
            };
            setWorkspace(updatedWorkspace);
          }
        }
      } catch (error) {
        console.error('Failed to process database update:', error);
      }
    }
  };

  const handleMemberJoined = (data: any) => {
    console.log('👋 Member joined workspace:', data);
    if (workspace && data.member) {
      const updatedWorkspace = {
        ...workspace,
        members: [...workspace.members, {
          username: data.member.username,
          role: data.member.role,
          joinedAt: new Date(data.member.joinedAt)
        }]
      };
      setWorkspace(updatedWorkspace);
    }
  };

  const handleMemberLeft = (data: any) => {
    console.log('👋 Member left workspace:', data);
    if (workspace && data.username) {
      const updatedWorkspace = {
        ...workspace,
        members: workspace.members.filter(member => member.username !== data.username)
      };
      setWorkspace(updatedWorkspace);
    }
  };

  const handleSchemaShared = (data: any) => {
    console.log('📤 Schema shared in workspace:', data);
    if (workspace && data.schema) {
      const updatedWorkspace = {
        ...workspace,
        sharedSchemas: [...workspace.sharedSchemas, {
          schemaId: data.schema.schemaId,
          name: data.schema.name,
          scripts: data.schema.scripts,
          lastModified: new Date(data.schema.lastModified)
        }]
      };
      setWorkspace(updatedWorkspace);
    }
  };

  const handleInviteSuccess = (updatedMembers: any[]) => {
    if (workspace) {
      const normalizedMembers = updatedMembers.map(member => ({
        ...member,
        joinedAt: new Date(member.joinedAt)
      }));
      
      setWorkspace({
        ...workspace,
        members: normalizedMembers,
        updatedAt: new Date()
      });
    }
  };

  const handleMembersUpdate = (updatedMembers: any[]) => {
    if (workspace) {
      const normalizedMembers = updatedMembers.map(member => ({
        ...member,
        joinedAt: new Date(member.joinedAt)
      }));
      
      setWorkspace({
        ...workspace,
        members: normalizedMembers,
        updatedAt: new Date()
      });
    }
  };

  const shareCurrentSchema = async () => {
    if (!workspace || !currentSchema) return;

    try {
      const success = await workspaceService.updateSharedSchema(
        workspace.id,
        currentSchema.id,
        currentSchema.name,
        JSON.stringify(currentSchema)
      );

      if (success) {
        console.log('✅ Schema shared successfully');
        // Refresh workspace to get updated shared schemas
        await loadWorkspace();
      }
    } catch (error) {
      console.error('Failed to share schema:', error);
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
        <div className="text-red-800 dark:text-red-200 font-medium mb-2">Error</div>
        <div className="text-red-700 dark:text-red-300">{error}</div>
        <button
          onClick={loadWorkspace}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
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

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
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
          
          <button
            onClick={shareCurrentSchema}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
          >
            <Share2 className="w-4 h-4" />
            Share Current Schema
          </button>
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          workspaceService.isConnected()
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            workspaceService.isConnected() ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span>
            {workspaceService.isConnected() 
              ? 'Real-time sync active' 
              : 'Connecting to real-time sync...'
            }
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
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
                  flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'members' && (
          <TeamMembersList
            workspaceId={workspace.id}
            members={workspace.members}
            onMembersUpdate={handleMembersUpdate}
            currentUserRole={workspace.members.find(m => m.username === 'current_user')?.role}
          />
        )}

        {activeTab === 'invite' && (
          <InvitationForm
            workspaceId={workspace.id}
            onInviteSuccess={handleInviteSuccess}
          />
        )}

        {activeTab === 'schemas' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Shared Database Schemas ({workspace.sharedSchemas.length})
              </h3>
              
              {workspace.sharedSchemas.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">No shared schemas yet</p>
                  <p className="text-sm text-gray-400">Share your current schema to collaborate with team members</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workspace.sharedSchemas.map((schema, index) => (
                    <div
                      key={`${schema.schemaId}-${index}`}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {schema.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Last modified: {schema.lastModified.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          try {
                            const schemaData = JSON.parse(schema.scripts);
                            importSchema(schemaData);
                            console.log('✅ Schema loaded:', schema.name);
                          } catch (error) {
                            console.error('Failed to load schema:', error);
                          }
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors duration-200"
                      >
                        Load Schema
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceManager;