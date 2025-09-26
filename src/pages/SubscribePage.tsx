// src/pages/SubscribePage.tsx
import React, { useMemo, useEffect, useState } from 'react';
import OneTimePayButton from '../components/OneTimePayButton';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useLocation } from 'react-router-dom';
import { loadPayPalSdk } from '../utils/loadPaypalSdk';

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

  // Use clientId/planId resolved from environment/runtime config
  // Hardcoded Ultimate credentials for now (will move to .env later)
  const ULTIMATE_CLIENT_ID = 'AWrBv-xNQEaE_9zAL2iymfsJgLgbG-esgIeSeRNQAahjieEnZMkgsnKtX1nEKyeX1U3mN0GTfm21oXTS';
  const ULTIMATE_PLAN_ID = 'P-1LD60420K0312402UNDDYS2Q';

  // choose effective client and plan depending on requested plan
  const effectiveClientId = plan === 'ultimate' ? ULTIMATE_CLIENT_ID : clientId;
  const effectivePlanId = plan === 'ultimate' ? ULTIMATE_PLAN_ID : planId;

  const initialOptions = useMemo(() => ({
    'client-id': effectiveClientId || undefined,
    // vault must be true for subscription flows in many PayPal setups.
    vault: true,
    intent: 'subscription'
  }), [effectiveClientId]);

  const [sdkLoadError, setSdkLoadError] = useState<boolean>(false);

  useEffect(() => {
    // If paypal is not present, try to use the helper to load it (idempotent)
    if (typeof window !== 'undefined' && !(window as any).paypal) {
      // If inline script previously set a global error flag, skip trying again
      if ((window as any).__PAYPAL_SDK_LOAD_ERROR__) {
        setSdkLoadError(true);
        return;
      }
      // Try to load using helper
      loadPayPalSdk({ clientId: (effectiveClientId as string), vault: true, intent: 'subscription' })
        .then(() => { setSdkLoadError(false); })
        .catch((e) => { console.error('loadPayPalSdk failed', e); setSdkLoadError(true); });
    }
  }, [clientId]);

  // For Pro plan we use the one-time order/capture flow (no subscription planId required)
  if (plan === 'pro') {
    return (
      <div className="container mx-auto p-8">
        <h2 className="text-2xl font-bold mb-4">Purchase Pro (one-time)</h2>
        <div className="max-w-sm mx-auto">
          <OneTimePayButton
            plan="Pro"
            onSuccess={(expiresAt) => {
              console.log('Pro one-time purchase succeeded, expiresAt:', expiresAt);
              alert('Payment successful — your Pro access is active.');
              // Optionally, redirect or refresh user subscription status
              try {
                window.location.href = '/';
              } catch (e) { /* ignore */ }
            }}
          />
        </div>
      </div>
    );
  }

  // If planId missing for subscription-based flows (Ultimate), show user-friendly message
  if (!planId) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Plan not found</h2>
        <p className="text-gray-600">Unable to resolve plan configuration. Please check your .env keys (console has debug info).</p>
        <pre className="mt-4 text-sm text-gray-700">Searched keys for this plan: {(plan === 'ultimate' ? planUltimateCandidates : planProCandidates).join(', ')}</pre>
      </div>
    );
  }

  // If clientId missing for subscription flows, show message
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
      {plan === 'ultimate' && planId ? (
        <div className="mb-4">
          <button
            id="buy-ultimate"
            className="bg-blue-600 text-white px-4 py-2 rounded shadow"
            onClick={() => {
              // Direct full-page approval (server-side fallback will create subscription and redirect to PayPal)
              const url = `/api/pay/fallback-subscription?plan_id=${encodeURIComponent(planId as string)}`;
              window.location.href = url;
            }}
          >
            Buy Ultimate (PayPal)
          </button>
        </div>
      ) : null}
      { /* Ultimate subscription flow (kept as-is) */ }
      {clientId ? (
        // Only render the PayPal SDK when we have a client id to avoid loading the SDK with an empty id
        <>
        {sdkLoadError ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="font-medium">PayPal SDK failed to load.</p>
            <p className="text-sm text-gray-700">This can happen if the SDK script was blocked by your browser or a privacy extension. You can open the full-page approval flow instead.</p>
            <div className="mt-2">
              <a className="text-blue-600 underline" href={`/api/pay/fallback-subscription?plan_id=${planId}`} target="_blank" rel="noreferrer">Open PayPal full-page approval</a>
            </div>
          </div>
        ) : (
          <PayPalScriptProvider options={initialOptions}>
          <div id={`paypal-button-${plan}`}>
            <PayPalButtons
              style={{ layout: 'vertical', shape: 'pill', label: 'subscribe', color: 'gold' }}
              createSubscription={async (_data: any, actions: any) => {
                // Use the effectivePlanId (Ultimate hardcoded or Pro from env)
                return actions.subscription.create({
                  plan_id: effectivePlanId,
                  application_context: { shipping_preference: 'NO_SHIPPING' }
                });
              }}
              onApprove={async (data: any) => {
                // Requirement: log subscriptionID and show alert
                try {
                  const subscriptionID = data && data.subscriptionID;
                  console.log('Subscription ID:', subscriptionID);
                  // Send to server to confirm and attach to user
                  try {
                    const resp = await fetch('/api/paypal/confirm-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ subscriptionID })
                    });
                    const json = await resp.json();
                    if (resp.ok && json.success) {
                      alert('Subscription successful: ' + subscriptionID);
                    } else if (resp.status === 401) {
                      alert('Subscription created but you are not logged in. Please log in to link it to your account.');
                    } else {
                      console.error('Server confirm failed', json);
                      alert('Subscription created but server confirmation failed. See console for details.');
                    }
                  } catch (e) {
                    console.error('Error confirming subscription on server', e);
                    alert('Subscription created but failed to contact server for confirmation.');
                  }
                } catch (e) {
                  console.error('onApprove handler error', e);
                }
              }}
              onCancel={(data: any) => {
                console.log('PayPal checkout cancelled', data);
                alert('Payment canceled.');
              }}
              onError={(err: any) => {
                console.error('PayPal error:', err);
                alert('Payment failed');
              }}
            />
            <div className="mt-4 text-sm">
              <p>If the PayPal popup is blocked or shows an error, you can open a full-page approval flow instead:</p>
              <a className="text-blue-600 underline" href={`/api/pay/fallback-subscription?plan_id=${planId}`} target="_blank" rel="noreferrer">Open PayPal full-page approval</a>
            </div>
          </div>
          </PayPalScriptProvider>
        )}
        </>
      ) : (
        <div className="p-4 text-sm text-gray-600">PayPal client id not available; check your runtime configuration.</div>
      )}
    </div>
  );
};

export default SubscribePage;
