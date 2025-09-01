// src/components/allWorkSpace/tools/RealTimeCollaboration.tsx
import React, { useState, useEffect } from "react";
// subscription gating removed to always show collaboration
import WorkspaceManager from "../workspace/WorkspaceManager";
import { simpleWebSocketService } from "../../../services/simpleWebSocketService";
import { apiService } from '../../../services/apiService';

const RealTimeCollaboration: React.FC = () => {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resolve initial workspace id: try to list workspaces and pick the first one
    const resolveWorkspace = async () => {
      try {
        const list = await apiService.get('/workspaces');
        if (Array.isArray(list) && list.length > 0) {
          setCurrentWorkspaceId(list[0].id);
          return;
        }
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

    return () => {
      console.log('⚡ Disconnecting WebSocket on unmount');
      simpleWebSocketService.disconnect();
    };
  }, []);

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
