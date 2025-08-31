// src/components/allWorkSpace/tools/RealTimeCollaboration.tsx
import React, { useState, useEffect } from "react";
// subscription gating removed to always show collaboration
import WorkspaceManager from "../workspace/WorkspaceManager";
import { simpleWebSocketService } from "../../../services/simpleWebSocketService";

const RealTimeCollaboration: React.FC = () => {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    // Resolve initial workspace id: try to list workspaces and pick the first one
    const resolveWorkspace = async () => {
      try {
        const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/+$/, '')}/workspaces`, {
          credentials: 'include'
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setCurrentWorkspaceId(list[0].id);
            return;
          }
        }
      } catch (e) {
        // ignore, will fallback
      }

      // fallback to legacy id
      setCurrentWorkspaceId('default-workspace');
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
  {currentWorkspaceId ? <WorkspaceManager workspaceId={currentWorkspaceId} /> : <div className="p-6">Resolving workspace...</div>}
    </div>
  );
};

export default RealTimeCollaboration;
