import React from 'react';
import CollaborativeEditor from '../../workspace/CollaborativeEditor';
import CollaborativeCursors from '../../workspace/CollaborativeCursors';

export default function RealTimeCollaboration({ workspaceId, initialDoc, token }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <CollaborativeEditor workspaceId={workspaceId} initialDoc={initialDoc} token={token} />
      <CollaborativeCursors workspaceId={workspaceId} token={token} />
    </div>
  );
}
// src/components/allWorkSpace/tools/RealTimeCollaboration.tsx
import React, { useState, useEffect } from "react";
// subscription gating removed to always show collaboration
import WorkspaceManager from "../workspace/WorkspaceManager";
import { simpleWebSocketService } from "../../../services/simpleWebSocketService";
import { apiService } from '../../../services/apiService';
import { usePortfolio } from '../../../context/PortfolioContext';
import { useDatabase } from '../../../context/DatabaseContext';

interface WorkspaceSummary {
  id: string;
  name: string;
  members?: any[];
  role?: 'owner' | 'editor' | 'viewer';
  membersCount?: number;
}

const RealTimeCollaboration: React.FC = () => {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resolve initial workspace id: try to list workspaces and pick the first one
    const resolveWorkspace = async () => {
      try {
        const list = await apiService.get('/workspaces');
        if (Array.isArray(list) && list.length > 0) {
          setWorkspaces(list as WorkspaceSummary[]);
          setCurrentWorkspaceId(list[0].id);
          return;
        }
        setWorkspaces([]);
        setError('no_workspaces');
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('401') || /unauth/i.test(msg) || /not authenticated/i.test(msg)) {
          setError('unauthenticated');
          return;
        }

        if (msg.includes('403') || /access denied/i.test(msg) || /forbidden/i.test(msg)) {
          setError('access_denied');
          return;
        }

        console.warn('Failed to resolve workspace list:', err);
        setError('network');
      }
    };

    resolveWorkspace();

    // subscribe to direct workspace invites (so online invitees see new workspace immediately)
    const inviteHandler = async (data: any) => {
      console.log('📩 Received workspace_invite:', data);
      try {
        const list = await apiService.get('/workspaces');
        if (Array.isArray(list)) setWorkspaces(list as WorkspaceSummary[]);
      } catch (e) {
        console.warn('Failed to refresh workspaces after invite', e);
      }
    };
    simpleWebSocketService.on('workspace_invite', inviteHandler);

    return () => {
      console.log('⚡ Disconnecting WebSocket on unmount');
      simpleWebSocketService.off('workspace_invite', inviteHandler);
      simpleWebSocketService.disconnect();
    };
  }, []);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  // NEW: portfolio & current schema selection for sharing on create
  const { portfolios, loadPortfolios } = usePortfolio();
  const { currentSchema } = useDatabase();
  const [selectedSchemaOption, setSelectedSchemaOption] = useState<string>(''); // '' | 'current' | portfolioId

  useEffect(() => {
    // load portfolios for selection
    loadPortfolios().catch(e => console.warn('Failed to load portfolios for workspace create', e));
  }, []);

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    try {
      const id = newWorkspaceName.trim().toLowerCase().replace(/\s+/g, '-');
      const out = await apiService.post('/workspaces', { id, name: newWorkspaceName.trim() });
      const updated = [...workspaces, out];
      setWorkspaces(updated);
      setCurrentWorkspaceId(out.id);
      setNewWorkspaceName('');

      // If user selected a schema to share on creation, post it to the new workspace
      try {
        if (selectedSchemaOption) {
          if (selectedSchemaOption === 'current') {
            if (!currentSchema) {
              console.warn('No current schema to share');
            } else {
              const payload = {
                schemaId: (currentSchema as any).id || `${Date.now()}`,
                name: (currentSchema as any).name || 'Shared Schema',
                scripts: JSON.stringify(currentSchema),
              };
              await apiService.post(`/workspaces/${out.id}/schemas`, payload);
            }
          } else {
            // treat as portfolio id
            const p = portfolios.find((pt: any) => pt._id === selectedSchemaOption);
            if (p) {
              const payload = {
                schemaId: p._id,
                name: p.name || `Portfolio ${p._id}`,
                scripts: p.scripts,
              };
              await apiService.post(`/workspaces/${out.id}/schemas`, payload);
            } else {
              console.warn('Selected portfolio not found for sharing during create');
            }
          }
          // Clear selection after attempting share
          setSelectedSchemaOption('');
        }
      } catch (err) {
        // non-fatal: workspace created, but sharing failed
        console.error('Failed sharing selected schema during workspace creation:', err);
      }

    } catch (err) {
      console.error('❌ Create workspace failed:', err);
      setError('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkspace = async (id: string) => {
    if (!window.confirm('Delete this workspace? This action cannot be undone.')) return;
    try {
      await apiService.delete(`/workspaces/${id}`);
      const updated = workspaces.filter(w => w.id !== id);
      setWorkspaces(updated);
      if (currentWorkspaceId === id) {
        setCurrentWorkspaceId(updated.length ? updated[0].id : null);
      }
    } catch (err) {
      console.error('❌ Delete workspace failed:', err);
      setError('Failed to delete workspace');
    }
  };

  // Always render collaboration UI (members and workspace manager).
  return (
    <div className="h-full">
      {error === 'unauthenticated' && (
        <div className="p-6 text-center text-sm">
          <div className="font-medium mb-2">Please sign in to access team collaboration</div>
          <div className="text-gray-500">You must be logged in to join or view collaborative workspaces.</div>
        </div>
      )}

      {error === 'access_denied' && (
        <div className="p-6 text-center text-sm">
          <div className="font-medium mb-2">Access denied</div>
          <div className="text-gray-500">You don't have permission to view this workspace. Ask the workspace owner to invite you.</div>
        </div>
      )}

      {error === 'no_workspaces' && (
        <div className="p-6 text-center text-sm">
          <div className="font-medium mb-2">No workspaces found</div>
          <div className="text-gray-500">Create a workspace or ask an owner to invite you.</div>
        </div>
      )}

      {/* Workspace List / Create UI */}
      <div className="p-4">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Create New Workspace</label>
          <div className="flex gap-2">
            <input
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              className="flex-1 px-3 py-2 border rounded"
            />
            <button onClick={createWorkspace} disabled={creating} className="px-3 py-2 bg-blue-600 text-white rounded">Create</button>
          </div>

          {/* NEW: Schema selection for sharing when creating workspace */}
          <div className="mt-3 text-sm">
            <label className="block text-xs text-gray-600 mb-1">Share a schema with this new workspace (optional)</label>
            <div className="flex gap-2">
              <select value={selectedSchemaOption} onChange={e => setSelectedSchemaOption(e.target.value)} className="px-3 py-2 border rounded bg-white text-sm">
                <option value="">No schema</option>
                <option value="current">Use current open schema</option>
                {portfolios.map((p: any) => (
                  <option key={p._id} value={p._id}>{`Portfolio: ${p.name || p._id}`}</option>
                ))}
              </select>
              <div className="text-xs text-gray-500 flex items-center">Select a schema to auto-share when the workspace is created.</div>
            </div>
          </div>

        </div>

        {workspaces.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium mb-2">Your Workspaces</div>
            {workspaces.map(w => (
              <div key={w.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-gray-500">{w.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentWorkspaceId(w.id)} className="px-2 py-1 text-sm border rounded">Open</button>
                  {w.role === 'owner' && (
                    <button onClick={() => deleteWorkspace(w.id)} className="px-2 py-1 text-sm text-red-600 border rounded">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error === 'network' && (
        <div className="p-6 text-center text-sm">
          <div className="font-medium mb-2">Network error</div>
          <div className="text-gray-500">Failed to reach the server. Check your connection and try again.</div>
        </div>
      )}

      {!error && !currentWorkspaceId && (
        <div className="p-6">Resolving workspace...</div>
      )}

      {currentWorkspaceId && <WorkspaceManager workspaceId={currentWorkspaceId} />}
    </div>
  );
};

export default RealTimeCollaboration;
