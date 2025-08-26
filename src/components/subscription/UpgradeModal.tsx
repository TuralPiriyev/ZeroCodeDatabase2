import React from 'react';
import { X, Crown, Zap, Shield, Sparkles, Check } from 'lucide-react';
import { useSubscription, PLAN_DETAILS } from '../../context/SubscriptionContext';
import PlanCard from './PlanCard';

const UpgradeModal: React.FC = () => {
  const { 
    showUpgradeModal, 
    setShowUpgradeModal, 
    upgradeReason, 
    currentPlan,
    changePlan 
  } = useSubscription();

  if (!showUpgradeModal) return null;

  const handlePlanSelect = (plan: 'free' | 'pro' | 'ultimate') => {
    
     if (plan === 'pro') {
      window.location.href = 'https://www.paypal.com/ncp/payment/F2SDPFKYS3YVQ';
    } else if (plan === 'ultimate') {
      window.location.href = 'https://www.paypal.com/ncp/payment/6WMBAA5QYX4UA';
    }
    changePlan(plan);
  };
// Orijinal handlePlanSelect yerinə əlavə etdiklərimiz:


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 p-8 text-white">
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">Upgrade Your Plan</h2>
                  <p className="text-blue-100">Unlock powerful features for your database projects</p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {upgradeReason && (
              <div className="bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  <span className="font-medium">Why upgrade?</span>
                </div>
                <p className="text-blue-100">{upgradeReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Current Plan Indicator */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-800 dark:to-purple-800 rounded-xl flex items-center justify-center">
              {currentPlan === 'free' && <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
              {currentPlan === 'pro' && <Crown className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
              {currentPlan === 'ultimate' && <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                Current Plan: {PLAN_DETAILS[currentPlan].title}
              </h3>
              <p className="text-blue-600 dark:text-blue-400">
                {PLAN_DETAILS[currentPlan].description}
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Plans Grid */}
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className={`transform transition-all duration-200 ${currentPlan === 'free' ? 'scale-105' : 'hover:scale-105'}`}>
              <PlanCard
                {...PLAN_DETAILS.free}
                ctaText={currentPlan === 'free' ? 'Current Plan' : 'Downgrade'}
                onSelect={() => handlePlanSelect('free')}
              />
            </div>

            {/* Pro Plan */}
            <div className={`transform transition-all duration-200 ${currentPlan === 'pro' ? 'scale-105' : 'hover:scale-105'}`}>
              <PlanCard
                {...PLAN_DETAILS.pro}
                ctaText={currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
                onSelect={() => handlePlanSelect('pro')}
                
              />
            </div>

            {/* Ultimate Plan */}
            <div className={`transform transition-all duration-200 ${currentPlan === 'ultimate' ? 'scale-105' : 'hover:scale-105'}`}>
              <PlanCard
                {...PLAN_DETAILS.ultimate}
                ctaText={currentPlan === 'ultimate' ? 'Current Plan' : 'Upgrade to Ultimate'}
                onSelect={() => handlePlanSelect('ultimate') }
              />
            </div>
          </div>
        </div>

        {/* Enhanced Features Comparison */}
        <div className="p-8 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Detailed Feature Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-left py-4 px-4 text-gray-700 dark:text-gray-300 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4" />
                      Free
                    </div>
                  </th>
                  <th className="text-center py-4 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4" />
                      Pro
                    </div>
                  </th>
                  <th className="text-center py-4 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <Shield className="w-4 h-4" />
                      Ultimate
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                {[
                  { feature: 'Max Tables', free: '3', pro: '20', ultimate: 'Unlimited' },
                  { feature: 'Max Columns per Table', free: '10', pro: '50', ultimate: 'Unlimited' },
                  { feature: 'Visual Query Builder', free: '✅', pro: '✅', ultimate: '✅' },
                  { feature: 'CRUD Operations', free: '✅', pro: '✅', ultimate: '✅' },
                  { feature: 'SQL Export', free: '❌', pro: '✅', ultimate: '✅' },
                  { feature: 'AI Assistant', free: '❌', pro: '✅', ultimate: '✅' },
                  { feature: 'Advanced Security', free: '❌', pro: 'Basic', ultimate: 'Full' },
                  { feature: 'Indexes & Constraints', free: '❌', pro: '✅', ultimate: '✅' },
                  { feature: 'Team Collaboration', free: '❌', pro: '❌', ultimate: '✅' },
                  { feature: 'Real-time Sync', free: '❌', pro: '❌', ultimate: '✅' },
                  { feature: 'MongoDB Integration', free: '❌', pro: '❌', ultimate: '✅' },
                  { feature: 'Priority Support', free: '❌', pro: '✅', ultimate: '✅' },
                ].map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{row.feature}</td>
                    <td className="text-center py-3 px-4">
                      {row.free === '✅' ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : row.free === '❌' ? (
                        <X className="w-5 h-5 text-red-500 mx-auto" />
                      ) : (
                        <span className="font-medium">{row.free}</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.pro === '✅' ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : row.pro === '❌' ? (
                        <X className="w-5 h-5 text-red-500 mx-auto" />
                      ) : (
                        <span className="font-medium">{row.pro}</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.ultimate === '✅' ? (
                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                      ) : row.ultimate === '❌' ? (
                        <X className="w-5 h-5 text-red-500 mx-auto" />
                      ) : (
                        <span className="font-medium">{row.ultimate}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              All plans include our core database design tools and regular updates
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>30-day money back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Instant activation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;