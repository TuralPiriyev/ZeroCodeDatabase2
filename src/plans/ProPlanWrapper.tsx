import React, { useState, useEffect } from 'react';
import PlanCard from '../components/main/PlanCard';
import { PLAN_DETAILS } from '../context/SubscriptionContext';
import { PayPalButton } from '../components/PayPalButton';
import { useSubscription } from '../context/SubscriptionContext';

export const ProPlanWrapper: React.FC = () => {
  const { currentPlan, changePlan } = useSubscription();
  const [checkout, setCheckout] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('userId') || '';
    setUserId(stored);
  }, []);

  if (currentPlan === 'pro') {
    return (
      <PlanCard
        {...PLAN_DETAILS.pro}
        highlighted={true}
        ctaText="Current Plan"
        onSelect={() => {}}
      />
    );
  }

  if (checkout) {
    return (
      <div className="max-w-sm mx-auto">
        <PayPalButton
          userId={userId}
          plan="Pro"
          onSuccess={(expiresAt) => {
            changePlan('pro');
            console.log('Pro expires at', expiresAt);
          }}
        />
      </div>
    );
  }

  return (
    <PlanCard
      {...PLAN_DETAILS.pro}
      highlighted={true}
      ctaText="Upgrade to Pro"
      onSelect={() => setCheckout(true)}
    />
  );
};