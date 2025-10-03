import React, { useState } from 'react';
import PlanCard from '../components/main/PlanCard';
import { PLAN_DETAILS } from '../context/SubscriptionContext';
import PaypalSubscription from '../components/PaypalSubscription';
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
        <PaypalSubscription
          planId={process.env.REACT_APP_PAYPAL_PLAN_PRO_ID || (window as any).__APP_ENV__?.PAYPAL_PLAN_PRO_ID}
          onSuccess={(data: any) => {
            changePlan('pro');
            console.log('Pro subscription success', data);
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