import React, { useState } from 'react';
import PlanCard from '../components/main/PlanCard';
import { PLAN_DETAILS } from '../context/SubscriptionContext';
import OneTimePayButton from '../components/OneTimePayButton';
import { useSubscription } from '../context/SubscriptionContext';

export const ProPlanWrapper: React.FC = () => {
  const { currentPlan, changePlan } = useSubscription();
  const [checkout, setCheckout] = useState(false);
  

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
        <OneTimePayButton
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