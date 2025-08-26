import React, { useState, useEffect } from 'react';
import PlanCard from '../components/main/PlanCard';
import { PLAN_DETAILS } from '../context/SubscriptionContext';
import { PayPalButton } from '../components/PayPalButton';
import { useSubscription } from '../context/SubscriptionContext';

export const UltimatePlanWrapper: React.FC = () => {
  const { currentPlan, changePlan } = useSubscription();
  const [checkout, setCheckout] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('userId') || '';
    setUserId(stored);
  }, []);

  if (currentPlan === 'ultimate') {
    return (
      <PlanCard
        {...PLAN_DETAILS.ultimate}
        highlighted={false}
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
          plan="Ultimate"
          onSuccess={(expiresAt) => {
            changePlan('ultimate');
            console.log('Ultimate expires at', expiresAt);
          }}
        />
      </div>
    );
  }

  return (
    <PlanCard
      {...PLAN_DETAILS.ultimate}
      highlighted={false}
      ctaText="Upgrade to Ultimate"
      onSelect={() => setCheckout(true)}
    />
  );
};