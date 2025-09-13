// src/pages/SubscribePage.tsx
import React, { useMemo, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useLocation, useNavigate } from 'react-router-dom';

function useQuery() {
  const loc = useLocation();
  return new URLSearchParams(loc.search);
}

/**
 * Resolve environment-like values at browser runtime.
 * Prefers `import.meta.env` (Vite) then `window.__APP_ENV__` (optional runtime-injected config).
 */
function resolveEnv(...keys: string[]) {
  // Try import.meta.env (Vite)
  try {
    // @ts-ignore
    const meta: any = import.meta;
    if (meta && meta.env) {
      for (const k of keys) {
        if (typeof meta[k] !== 'undefined' && meta[k] !== '') {
          return { key: `import.meta.env.${k}`, value: meta[k] };
        }
      }
    }
  } catch (e) {
    // ignore - import.meta may not be available in some environments
  }

  // Fallback: runtime-injected global config
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any).__APP_ENV__) {
      // @ts-ignore
      const cfg = (window as any).__APP_ENV__;
      for (const k of keys) {
        if (typeof cfg[k] !== 'undefined' && cfg[k] !== '') {
          return { key: `window.__APP_ENV__.${k}`, value: cfg[k] };
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
  const clientId = resolvedClient.value;
  

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
      // Try to print any detected runtime config sources
      try {
        // @ts-ignore
        const meta: any = import.meta;
        if (meta && meta.env) {
          // @ts-ignore
          console.log('  import.meta.env.VITE_PAYPAL_CLIENT_ID =', meta.VITE_PAYPAL_CLIENT_ID);
        }
      } catch (e) {
        // ignore
      }
      try {
        // @ts-ignore
        if (typeof window !== 'undefined' && (window as any).__APP_ENV__) {
          // @ts-ignore
          const cfg = (window as any).__APP_ENV__;
          console.log('  window.__APP_ENV__.PAYPAL_CLIENT_ID =', cfg.PAYPAL_CLIENT_ID);
          console.log('  window.__APP_ENV__.VITE_PAYPAL_CLIENT_ID =', cfg.VITE_PAYPAL_CLIENT_ID);
        }
      } catch (e) {
        // ignore
      }
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
    'client-id': clientId || undefined,
  // vault must be true for subscription flows in many PayPal setups.
  // Keep vault enabled to ensure the SDK accepts intent=subscription.
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
      {clientId ? (
        // Only render the PayPal SDK when we have a client id to avoid loading the SDK with an empty id
        <PayPalScriptProvider options={initialOptions}>
          <div id={`paypal-button-${plan}`}>
            <PayPalButtons
              style={{ layout: 'vertical', shape: 'pill', label: 'subscribe' }}
              createSubscription={async (_data: any, actions: any) => {
                try {
                  // Explicitly tell PayPal we do NOT require shipping information here.
                  // This avoids address/phone validation UI in the PayPal popup for subscriptions
                  // when your product does not require shipping.
                  const sub = await actions.subscription.create({
                    plan_id: planId,
                    application_context: {
                      shipping_preference: 'NO_SHIPPING'
                    }
                  });
                  console.log('createSubscription result', sub);
                  return sub;
                } catch (err: any) {
                  // Improve logging to capture PayPal error payloads (details/message)
                  console.error('createSubscription error', err);
                  if (err && (err.details || err.message)) {
                    console.error('PayPal error details:', err.details || err.message);
                  }
                  // Surface user-facing error
                  alert('Unable to start subscription. See console for details.');
                  throw err;
                }
              }}
              onApprove={async (data: any) => {
                console.log('onApprove data', data);
                try {
                  if (!data || !data.subscriptionID) {
                    console.error('No subscriptionID returned in onApprove', data);
                    alert('Payment completed but no subscription ID received. Check console for details.');
                    return;
                  }
                  // Send subscriptionID to server to confirm & attach to user
                  const resp = await fetch('/api/paypal/confirm-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ subscriptionID: data.subscriptionID })
                  });
                  const json = await resp.json();
                  if (resp.ok && json.success) {
                    console.log('confirm-subscription success', json);
                    alert('Subscription active! Plan: ' + (json.plan || 'unknown') + '\nNext billing: ' + (json.nextBillingTime || 'unknown'));
                    navigate('/account');
                  } else {
                    console.error('confirm failed', json);
                    alert('Subscription confirmation failed on server. See console for details.');
                  }
                } catch (err: any) {
                  console.error('confirm error', err);
                  alert('Error confirming subscription. See console.');
                }
              }}
              onCancel={(data: any) => {
                console.log('PayPal checkout cancelled', data);
                alert('Payment canceled.');
              }}
              onError={(err: any) => {
                // Log full error shape so you can inspect `err.details` returned by PayPal
                console.error('PayPal Buttons error', err);
                if (err && (err.details || err.message)) {
                  console.error('PayPal onError details:', err.details || err.message);
                }
                alert('Payment failed or an error occurred. See console for details.');
              }}
            />
          </div>
        </PayPalScriptProvider>
      ) : (
        <div className="p-4 text-sm text-gray-600">PayPal client id not available; check your runtime configuration.</div>
      )}
    </div>
  );
};

export default SubscribePage;
