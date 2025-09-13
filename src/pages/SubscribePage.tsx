// src/pages/SubscribePage.tsx
import React, { useMemo, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useLocation, useNavigate } from 'react-router-dom';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

/**
 * Utility: resolve env value from multiple candidate keys (checks process.env.* and import.meta.env)
 */
function resolveEnv(...keys: string[]) {
  // check process.env variants first
  for (const k of keys) {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && typeof (process.env as any)[k] !== 'undefined' && (process.env as any)[k] !== '') {
      return { key: k, value: (process.env as any)[k] };
    }
  }

  // then import.meta.env (Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const meta = import.meta.env;
      for (const k of keys) {
        // Vite commonly uses VITE_ prefix, so keys should be provided accordingly
        if (typeof (meta as any)[k] !== 'undefined' && (meta as any)[k] !== '') {
          return { key: `import.meta.env.${k}`, value: (meta as any)[k] };
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return { key: undefined, value: undefined };
}

const SubscribePage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const plan = (query.get('plan') || 'pro').toLowerCase();

  // Candidate env names for plan IDs and client id (cover common naming mistakes)
  // For PRO plan we try these (order matters): REACT_APP_PAYPAL_PLAN_PRO_ID, REACT_APP_PAYPAL_PRO_PLAN_ID, PAYPAL_PRO_PLAN_ID, PAYPAL_PLAN_PRO_ID, VITE equivalents
  const planProCandidates = [
    'REACT_APP_PAYPAL_PLAN_PRO_ID',
    'REACT_APP_PAYPAL_PRO_PLAN_ID',
    'REACT_APP_PAYPAL_PROPLAN_ID',
    'REACT_APP_PAYPAL_PRO_PLANID',
    'PAYPAL_PRO_PLAN_ID',
    'PAYPAL_PLAN_PRO_ID',
    'PAYPAL_PROPLAN_ID',
    'VITE_PAYPAL_PLAN_PRO_ID',
    'VITE_PAYPAL_PRO_PLAN_ID'
  ];

  const planUltimateCandidates = [
    'REACT_APP_PAYPAL_PLAN_ULTIMATE_ID',
    'REACT_APP_PAYPAL_ULTIMATE_PLAN_ID',
    'PAYPAL_ULTIMATE_PLAN_ID',
    'PAYPAL_PLAN_ULTIMATE_ID',
    'VITE_PAYPAL_PLAN_ULTIMATE_ID',
    'VITE_PAYPAL_ULTIMATE_PLAN_ID'
  ];

  const clientCandidates = [
    'REACT_APP_PAYPAL_CLIENT_ID',
    'REACT_APP_PAYPAL_PUBLIC_CLIENT_ID',
    'PAYPAL_CLIENT_ID',
    'VITE_PAYPAL_CLIENT_ID'
  ];

  // Resolve candidates
  const resolvedPro = resolveEnv(...planProCandidates);
  const resolvedUltimate = resolveEnv(...planUltimateCandidates);
  const resolvedClient = resolveEnv(...clientCandidates);

  // pick planId based on `plan`
  const planId = plan === 'ultimate' ? resolvedUltimate.value : resolvedPro.value;
  const planKeyUsed = plan === 'ultimate' ? resolvedUltimate.key : resolvedPro.key;
  const clientId = resolvedClient.value;
  const clientKeyUsed = resolvedClient.key;

  // debug logging to help you see EXACTLY which env key (if any) was found
  useEffect(() => {
    console.log('=== SubscribePage env debug ===');
    console.log('Requested plan (from query):', plan);
    console.log('Resolved PRO plan candidates order:', planProCandidates);
    console.log('Resolved ULTIMATE plan candidates order:', planUltimateCandidates);
    console.log('Resolved CLIENT candidates order:', clientCandidates);

    console.log('Resolved values:');
    console.log('  PRO plan -> key:', resolvedPro.key, ' value:', resolvedPro.value);
    console.log('  ULTIMATE plan -> key:', resolvedUltimate.key, ' value:', resolvedUltimate.value);
    console.log('  CLIENT ID -> key:', resolvedClient.key, ' value:', resolvedClient.value);

    // Also print raw common process.env names you may have in your .env for quick cross-check
    console.log('Raw quick-check of likely keys (process.env):');
    try {
      // @ts-ignore
      console.log('  process.env.REACT_APP_PAYPAL_CLIENT_ID =', process.env.REACT_APP_PAYPAL_CLIENT_ID);
      // @ts-ignore
      console.log('  process.env.REACT_APP_PAYPAL_PLAN_PRO_ID =', process.env.REACT_APP_PAYPAL_PLAN_PRO_ID);
      // @ts-ignore
      console.log('  process.env.REACT_APP_PAYPAL_PRO_PLAN_ID =', process.env.REACT_APP_PAYPAL_PRO_PLAN_ID);
      // @ts-ignore
      console.log('  process.env.PAYPAL_PRO_PLAN_ID =', process.env.PAYPAL_PRO_PLAN_ID);
      // @ts-ignore
      console.log('  process.env.PAYPAL_PLAN_PRO_ID =', process.env.PAYPAL_PLAN_PRO_ID);
      // @ts-ignore
      console.log('  process.env.PAYPAL_CLIENT_ID =', process.env.PAYPAL_CLIENT_ID);
      // import.meta.env sample
      try {
        // @ts-ignore
        let m: any = undefined;
        // Only assign if import.meta.env exists
        if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
          // @ts-ignore
          m = import.meta.env;
        }
        if (m) {
          // @ts-ignore
          console.log('  import.meta.env.VITE_PAYPAL_CLIENT_ID =', m.VITE_PAYPAL_CLIENT_ID);
          // @ts-ignore
          console.log('  import.meta.env.VITE_PAYPAL_PLAN_PRO_ID =', m.VITE_PAYPAL_PLAN_PRO_ID);
        } else {
          console.log('  import.meta.env not available in this build.');
        }
      } catch (e) {
        console.log('  import.meta.env access error', e);
      }
    } catch (e) {
      // ignore
    }
    console.log('=== end debug ===');
  }, [plan, resolvedPro.key, resolvedUltimate.key, resolvedClient.key]);

  const initialOptions = useMemo(() => ({
    'client-id': clientId || '',
    vault: true,
    intent: 'subscription'
  }), [clientId]);

  // If planId missing, show user-friendly message and keep logs for debugging
  if (!planId) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Plan not found</h2>
        <p className="text-gray-600">Unable to resolve plan configuration. Please check your .env keys (console has debug info).</p>
        <pre className="mt-4 text-sm text-gray-700">Searched keys for this plan: {(plan === 'ultimate' ? planUltimateCandidates : planProCandidates).join(', ')}</pre>
      </div>
    );
  }

  // If clientId missing, show message
  if (!clientId) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Payments temporarily unavailable</h2>
        <p className="text-gray-600">PayPal client ID not configured. Check console for which env key is expected.</p>
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
            createSubscription={(_data: any, actions: any) => actions.subscription.create({ plan_id: planId })}
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
