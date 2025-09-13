// src/pages/SubscribePage.tsx
import React, { useMemo, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useLocation, useNavigate } from 'react-router-dom';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const SubscribePage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const plan = query.get('plan') || 'pro';

  // Try multiple env var prefixes so this works in various build setups
  const planId = plan === 'ultimate'
    ? (process.env.REACT_APP_PAYPAL_PLAN_ULTIMATE_ID
        || process.env.PAYPAL_PLAN_ULTIMATE_ID
        || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PAYPAL_PLAN_ULTIMATE_ID : undefined))
    : (process.env.REACT_APP_PAYPAL_PLAN_PRO_ID
        || process.env.PAYPAL_PRO_PLAN_ID
        || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PAYPAL_PLAN_PRO_ID : undefined));

  const clientId = process.env.REACT_APP_PAYPAL_CLIENT_ID
    || process.env.PAYPAL_CLIENT_ID
    || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PAYPAL_CLIENT_ID : undefined);

  // Log important runtime values to help debug env / build issues
  useEffect(() => {
    try {
      console.log('SubscribePage runtime debug:');
      console.log('  plan (from query) =', plan);
      console.log('  resolved planId =', planId);
      console.log('  resolved clientId =', clientId);
      // also print alternative env vars if present (helps detect naming mistakes)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: any = (typeof import.meta !== 'undefined' ? import.meta.env : undefined);
        console.log('  process.env.REACT_APP_PAYPAL_PLAN_PRO_ID =', process.env.REACT_APP_PAYPAL_PLAN_PRO_ID);
        console.log('  process.env.REACT_APP_PAYPAL_PLAN_ULTIMATE_ID =', process.env.REACT_APP_PAYPAL_PLAN_ULTIMATE_ID);
        console.log('  process.env.REACT_APP_PAYPAL_CLIENT_ID =', process.env.REACT_APP_PAYPAL_CLIENT_ID);
        console.log('  process.env.PAYPAL_PLAN_PRO_ID =', process.env.PAYPAL_PLAN_PRO_ID);
        console.log('  process.env.PAYPAL_PLAN_ULTIMATE_ID =', process.env.PAYPAL_PLAN_ULTIMATE_ID);
        console.log('  process.env.PAYPAL_CLIENT_ID =', process.env.PAYPAL_CLIENT_ID);
        console.log('  import.meta.env (sample) =', meta ? {
          VITE_PAYPAL_PLAN_PRO_ID: meta.VITE_PAYPAL_PLAN_PRO_ID,
          VITE_PAYPAL_PLAN_ULTIMATE_ID: meta.VITE_PAYPAL_PLAN_ULTIMATE_ID,
          VITE_PAYPAL_CLIENT_ID: meta.VITE_PAYPAL_CLIENT_ID
        } : 'no import.meta.env');
      } catch (innerErr) {
        console.warn('Error logging additional env info', innerErr);
      }
    } catch (err) {
      console.warn('SubscribePage debug logging failed', err);
    }
  }, [plan, planId, clientId]);

  const initialOptions = useMemo(() => ({
    "client-id": clientId || '',
    vault: true,
    intent: 'subscription'
  }), [clientId]);

  // If planId missing, show user-friendly message but keep debug logs available in console
  if (!planId) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Plan not found</h2>
        <p className="text-gray-600">Unable to resolve plan configuration. Check console for debug info or contact support.</p>
      </div>
    );
  }

  // If clientId missing, show a clear message (SDK will fail without client-id)
  if (!clientId) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Payments temporarily unavailable</h2>
        <p className="text-gray-600">PayPal client ID not configured. Check console for debug info or contact support.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Subscribe to {plan === 'ultimate' ? 'Ultimate' : 'Pro'}</h2>

      <PayPalScriptProvider options={initialOptions}>
        <div id={`paypal-button-${plan}`}>
          <PayPalButtons
            style={{ layout: 'vertical', shape: 'pill', label: 'subscribe' }}
            createSubscription={(_data: any, actions: any) => {
              return actions.subscription.create({ plan_id: planId });
            }}
            onApprove={async (data: any) => {
              try {
                const resp = await fetch('/api/paypal/confirm-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
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
                console.error('confirm error', err);
                alert('Error confirming subscription.');
              }
            }}
            onError={(err: any) => {
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
