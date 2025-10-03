import React, { useState } from 'react';
import PlanCard from '../components/main/PlanCard';
import { PLAN_DETAILS } from '../context/SubscriptionContext';
import { PayPalButton } from '../components/PayPalButton';
import { useSubscription } from '../context/SubscriptionContext';

export const UltimatePlanWrapper: React.FC = () => {
  const { currentPlan, changePlan } = useSubscription();
  const [checkout, setCheckout] = useState(false);
  // no client-side userId required; server will derive user from auth

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
    const planId = process.env.REACT_APP_PAYPAL_PLAN_ULTIMATE_ID || (window as any).__APP_ENV__?.PAYPAL_PLAN_ULTIMATE_ID;
    return (
      <div className="max-w-sm mx-auto">
        <PayPalButton
          planId={planId}
          onSuccess={(expiresAt) => {
            changePlan('ultimate');
            console.log('Ultimate subscription success', expiresAt);
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