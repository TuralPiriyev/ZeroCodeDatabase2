// src/components/allWorkSpace/tools/RealTimeCollaboration.tsx
import React, { useState, useEffect } from "react";
// subscription gating removed to always show collaboration
import WorkspaceManager from "../workspace/WorkspaceManager";
import { simpleWebSocketService } from "../../../services/simpleWebSocketService";

const RealTimeCollaboration: React.FC = () => {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Resolve initial workspace id: try to list workspaces and pick the first one
    const resolveWorkspace = async () => {
      try {
        const apiBase = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/+$/, '');
        const res = await fetch(`${apiBase}/workspaces`, {
          credentials: 'include'
        });

        if (res.status === 401) {
          // not authenticated - ask user to login rather than fallback to default workspace
          setError('unauthenticated');
          return;
        }

        if (res.status === 403) {
          // user has no workspaces or access denied
          setError('access_denied');
          return;
        }

        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setCurrentWorkspaceId(list[0].id);
            return;
          }
          // no workspaces available for this user
          setError('no_workspaces');
          return;
        }
      } catch (e) {
        // ignore, will fallback
        console.warn('Failed to resolve workspace list:', e);
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
