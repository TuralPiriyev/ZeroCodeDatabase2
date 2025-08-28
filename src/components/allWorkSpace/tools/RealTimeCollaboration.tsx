// src/components/allWorkSpace/tools/RealTimeCollaboration.tsx
import React, { useState, useEffect } from "react";
import { Users, Crown } from "lucide-react";
import { useSubscription } from "../../../context/SubscriptionContext";
import WorkspaceManager from "../workspace/WorkspaceManager";
import { simpleWebSocketService } from "../../../services/simpleWebSocketService";

const RealTimeCollaboration: React.FC = () => {
  const { canUseFeature, setShowUpgradeModal, setUpgradeReason } = useSubscription();
  const [currentWorkspaceId] = useState("default-workspace");

  const canUseCollaboration = canUseFeature("canUseAdvancedSecurity");

  useEffect(() => {
    console.log('⚡ Connecting WebSocket...');
    simpleWebSocketService.connect(currentWorkspaceId)
      .then(() => {
        console.log('WebSocket connected.');
      })
      .catch((err: unknown) => {
        console.error('WebSocket connect failed:', err);
      });

    return () => {
      console.log('⚡ Disconnecting WebSocket on unmount');
      simpleWebSocketService.disconnect();
    };
  }, [currentWorkspaceId]);

  if (!canUseCollaboration) {
    return (
      // ... same UI as before
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        {/* upgrade UI */}
      </div>
    );
  }

  return (
    <div className="h-full">
      <WorkspaceManager workspaceId={currentWorkspaceId} />
    </div>
  );
};

export default RealTimeCollaboration;
