import React, { useState, useEffect } from 'react';
import { Users, Crown } from 'lucide-react';
import { useSubscription } from '../../../context/SubscriptionContext';
import WorkspaceManager from '../workspace/WorkspaceManager';

const RealTimeCollaboration: React.FC = () => {
  const { canUseFeature, setShowUpgradeModal, setUpgradeReason } = useSubscription();
  const [currentWorkspaceId] = useState('default-workspace');

  // Check if user can use collaboration
  const canUseCollaboration = canUseFeature('canUseAdvancedSecurity');

  // Show upgrade prompt for non-Ultimate users
  if (!canUseCollaboration) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Real-Time Collaboration
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
          Team collaboration features are available in Ultimate plan. Work together in real-time on database schemas.
        </p>
        <button
          onClick={() => {
            setUpgradeReason('Real-time collaboration is available in Ultimate plan. Upgrade to work with your team in real-time.');
            setShowUpgradeModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
        >
          <Crown className="w-4 h-4" />
          Upgrade to Ultimate
        </button>
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