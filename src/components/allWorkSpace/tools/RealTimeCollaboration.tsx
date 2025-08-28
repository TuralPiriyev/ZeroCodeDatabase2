// src/components/allWorkSpace/tools/RealTimeCollaboration.tsx
import React, { useState, useEffect } from "react";
import { Users, Crown } from "lucide-react";
import { useSubscription } from "../../../context/SubscriptionContext";
import WorkspaceManager from "../workspace/WorkspaceManager";
import { simpleWebSocketService } from "../../../services/simpleWebSocketService";

const RealTimeCollaboration: React.FC = () => {
  const { canUseFeature } = useSubscription();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);

  const canUseCollaboration = canUseFeature("canUseAdvancedSecurity");
const API_BASE = "https://zerocodedb.online/api";
  useEffect(() => {
    // Backend-ə workspace sorğusu
    fetch(`${API_BASE}/workspaces/user-workspace`) // user-specific ad
      .then(res => res.json())
      .then(data => setCurrentWorkspaceId(data.name))
      .catch(err => {
        console.error('Workspace fetch failed:', err);
        // errorsuz açmaq üçün fallback boş ID
        setCurrentWorkspaceId(null);
      });
  }, []);

  useEffect(() => {
    if (!currentWorkspaceId) return;

    simpleWebSocketService.connect(currentWorkspaceId)
      .then(() => console.log('WebSocket connected.'))
      .catch(err => console.error('WebSocket connect failed:', err));

    return () => simpleWebSocketService.disconnect();
  }, [currentWorkspaceId]);

  if (!canUseCollaboration) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        {/* Upgrade UI */}
      </div>
    );
  }

  return (
    <div className="h-full">
      {currentWorkspaceId 
        ? <WorkspaceManager workspaceId={currentWorkspaceId} /> 
        : <div>Loading collaboration...</div> /* errorsuz fallback */}
    </div>
  );
};

export default RealTimeCollaboration;
