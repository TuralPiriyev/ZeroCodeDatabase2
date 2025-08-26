import React from 'react';
import { Crown, Zap, Shield } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';

const PlanBadge: React.FC = () => {
  const { currentPlan, setShowUpgradeModal } = useSubscription();

  const planConfig = {
    free: {
      icon: Zap,
      label: 'Free',
      color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    },
    pro: {
      icon: Crown,
      label: 'Pro',
      color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    },
    ultimate: {
      icon: Shield,
      label: 'Ultimate',
      color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    },
  };

  const config = planConfig[currentPlan];
  const Icon = config.icon;

  return (
    <button
      onClick={() => setShowUpgradeModal(true)}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105
        ${config.color}
      `}
      title="Click to manage subscription"
    >
      <Icon className="w-4 h-4" />
      {config.label}
    </button>
  );
};

export default PlanBadge;