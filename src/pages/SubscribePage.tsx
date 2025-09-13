// src/pages/SubscribePage.tsx
import React, { useMemo } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useLocation, useNavigate } from 'react-router-dom';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SubscribePage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const plan = query.get('plan') || 'pro';

  // Plan id-ləri build zamanı inject olunsun (REACT_APP_ prefiksi ilə)
  const planId = plan === 'ultimate'
    ? process.env.REACT_APP_PAYPAL_PLAN_ULTIMATE_ID
    : process.env.REACT_APP_PAYPAL_PLAN_PRO_ID;

  const clientId = process.env.REACT_APP_PAYPAL_CLIENT_ID;

  const initialOptions = useMemo(() => ({
    "client-id": clientId || '',
    vault: true,
    intent: 'subscription'
  }), [clientId]);

  if (!planId) {
    return <div className="p-8">Plan not found. Contact support.</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Subscribe to {plan === 'ultimate' ? 'Ultimate' : 'Pro'}</h2>
      <PayPalScriptProvider options={initialOptions}>
        <div id={`paypal-button-${plan}`}>
          <PayPalButtons
            style={{ layout: 'vertical', shape: 'pill', label: 'subscribe' }}
            createSubscription={(_data: any, actions: any) => {
              // actions param-ı üçün explicit any tipi qoyuldu
              return actions.subscription.create({ plan_id: planId });
            }}
            onApprove={async (data: any) => {
              // data param-ı üçün explicit any tipi qoyuldu
              try {
                const resp = await fetch('/api/paypal/confirm-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include', // cookie auth varsa
                  body: JSON.stringify({ subscriptionID: data.subscriptionID })
                });
                const json = await resp.json();
                if (resp.ok && json.success) {
                  alert('Subscription active! Expires: ' + (json.nextBillingTime || json.expiresAt || 'unknown'));
                  navigate('/account');
                } else {
                  console.error('confirm failed', json);
                  alert('Subscription confirmation failed. Contact support.');
                }
              } catch (err: any) {
                // err üçün explicit any tipi qoyuldu
                console.error('confirm error', err);
                alert('Error confirming subscription.');
              }
            }}
            onError={(err: any) => {
              // onError param-ı üçün explicit any tipi qoyuldu
              console.error('PayPal Buttons error', err);
              alert('Payment failed or canceled.');
            }}
          />
        </div>
      </PayPalScriptProvider>
    </div>
  );
};

export default SubscribePage;
