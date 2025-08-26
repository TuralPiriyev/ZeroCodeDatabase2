import React from 'react';
import { Lock, Crown } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';

interface FeatureGateProps {
  feature: string;
  requiredPlan: 'pro' | 'ultimate';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradeButton?: boolean;
}

const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  requiredPlan,
  children,
  fallback,
  showUpgradeButton = true,
}) => {
  const { currentPlan, setShowUpgradeModal, setUpgradeReason } = useSubscription();

  // Check if user has access to this feature
  const hasAccess = 
    (requiredPlan === 'pro' && (currentPlan === 'pro' || currentPlan === 'ultimate')) ||
    (requiredPlan === 'ultimate' && currentPlan === 'ultimate');

  if (hasAccess) {
    return <>{children}</>;
  }

  const handleUpgrade = () => {
    setUpgradeReason(`Upgrade to ${requiredPlan} to access ${feature}`);
    setShowUpgradeModal(true);
  };

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative">
      {/* Disabled content with overlay */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      
      {/* Upgrade overlay */}
      <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            {requiredPlan === 'pro' ? 'Pro' : 'Ultimate'} Feature
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {feature} requires a {requiredPlan} subscription
          </p>
          {showUpgradeButton && (
            <button
              onClick={handleUpgrade}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors duration-200 mx-auto"
            >
              <Crown className="w-4 h-4" />
              Upgrade to {requiredPlan === 'pro' ? 'Pro' : 'Ultimate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureGate;