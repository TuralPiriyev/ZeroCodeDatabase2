import React, { useEffect, useRef, useState } from 'react';
import { loadPayPalSdk } from '../utils/loadPaypalSdk';

type PayPalWindow = Window & { paypal?: any };

export interface PaypalSubscriptionProps {
  planId?: string; // override env value
  onSuccess?: (subscriptionID: string) => void;
}

const PaypalSubscription: React.FC<PaypalSubscriptionProps> = ({ planId, onSuccess }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const clientId = (window as any).__APP_ENV__?.PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID || '';
    const envPlan = process.env.REACT_APP_PAYPAL_PLAN_ID || (window as any).__APP_ENV__?.PAYPAL_PLAN_PRO_ID;
    const effectivePlan = planId || envPlan;

    if (!clientId || !effectivePlan) {
      console.error('PayPal client id or plan id not configured');
      setStatus('error');
      return;
    }

    setStatus('loading');

    loadPayPalSdk({ clientId, vault: true, intent: 'subscription' })
      .then((paypal) => {
        if (!mountedRef.current) return;
        setStatus('ready');

        try {
          // Render buttons into container
          paypal.Buttons({
            style: { layout: 'vertical', shape: 'pill', label: 'subscribe' },
            createSubscription: function (_data: any, actions: any) {
              return actions.subscription.create({ plan_id: effectivePlan });
            },
            onApprove: async function (data: any) {
              try {
                console.log('onApprove data', data);
                if (!data || !data.subscriptionID) {
                  console.error('No subscriptionID in onApprove', data);
                  return;
                }
                // POST to server to complete record
                const resp = await fetch('/api/subscription/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ subscriptionID: data.subscriptionID })
                });
                const json = await resp.json();
                console.log('server confirm response', json);
                if (resp.ok) {
                  onSuccess && onSuccess(data.subscriptionID);
                }
              } catch (err) {
                console.error('Error confirming subscription on server', err);
              }
            },
            onError: function (err: any) {
              console.error('PayPal Buttons error', err);
              // Log PayPal SDK ids if present (helpful for PayPal support)
              try {
                if (err && (err.csnwCorrelationId || err.uid)) {
                  console.error('PayPal error ids', { uid: err.uid, csnwCorrelationId: err.csnwCorrelationId });
                }
              } catch (e) {
                // ignore
              }
              // Fallback: redirect to server-hosted approval URL which bypasses client-side cookie issues
              const fallbackUrl = `/api/pay/fallback-subscription?plan_id=${encodeURIComponent(effectivePlan)}`;
              window.location.href = fallbackUrl;
            }
          }).render(containerRef.current);
        } catch (e) {
          console.error('Failed to render PayPal Buttons', e);
        }
      })
      .catch((err) => {
        console.error('Failed to load PayPal SDK', err);
        setStatus('error');
      });

    return () => {
      mountedRef.current = false;
      // Cleanup: remove paypal buttons from container
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [planId, onSuccess]);

  return (
    <div>
      <div ref={containerRef} id="paypal-button-container">
        {status === 'loading' && <div>Loading payment widget…</div>}
        {status === 'error' && <div>Payments are temporarily unavailable. Try again later.</div>}
      </div>
    </div>
  );
};

export default PaypalSubscription;
