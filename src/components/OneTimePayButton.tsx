import React, { useEffect, useRef, useState } from 'react';
import { loadPayPalSdk } from '../utils/loadPaypalSdk';

interface Props {
  plan: 'Pro' | 'Ultimate' | string;
  onSuccess?: (expiresAt: string) => void;
}

const OneTimePayButton: React.FC<Props> = ({ plan, onSuccess }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve client id from runtime globals (same approach used elsewhere)
  const clientId = (window as any).__APP_ENV__?.PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || '';

  useEffect(() => {
    let mounted = true;
    if (!clientId) {
      setError('PayPal client id not configured');
      setLoading(false);
      return;
    }

    console.log('[OneTimePayButton] attempting to load PayPal SDK (capture) clientId=', clientId);
    loadPayPalSdk({ clientId: clientId as string, vault: false, intent: 'capture' })
      .then((paypal) => {
        if (!mounted) return;
        setLoading(false);
        try {
          // Render PayPal Buttons into container
          if (!containerRef.current) return;
          const buttons = (paypal as any).Buttons({
            style: { layout: 'vertical', shape: 'pill', label: 'pay' },
            createOrder: async () => {
              // create order on server
              const resp = await fetch('/api/paypal/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ plan })
              });
              const json = await resp.json();
              if (!resp.ok) throw new Error(json && json.message ? json.message : 'Failed to create order');
              return json.orderID;
            },
            onApprove: async (data: any, actions: any) => {
              try {
                const orderID = data.orderID || (actions && actions.order && actions.order.getId ? await actions.order.getId() : null);
                if (!orderID) throw new Error('No orderID from PayPal onApprove');
                const resp = await fetch('/api/paypal/capture-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ orderID, plan })
                });
                const json = await resp.json();
                if (!resp.ok) {
                  console.error('capture-order failed', json);
                  setError('Payment succeeded but server failed to confirm. Check console.');
                  return;
                }
                // success — call callback with expiresAt
                onSuccess && onSuccess(json.expiresAt || json.expiresAtString || json.expiresAtUtc || json.expiresAt || '');
              } catch (e: any) {
                console.error('onApprove error', e);
                setError(e && e.message ? e.message : String(e));
              }
            },
            onError: (err: any) => {
              console.error('PayPal Buttons error', err);
              setError(err && err.message ? err.message : 'PayPal error');
            },
            onCancel: () => {
              console.log('PayPal payment cancelled');
            }
          });

          buttons.render(containerRef.current).catch((e: any) => {
            console.error('Failed to render PayPal Buttons', e);
            setError('Failed to render PayPal Buttons');
          });
        } catch (e: any) {
          console.error('PayPal init error', e);
          setError(e && e.message ? e.message : 'Failed to initialize PayPal');
        }
      })
      .catch((e) => {
        console.error('loadPayPalSdk failed', e);
        setError('Failed to load PayPal SDK');
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [clientId, plan, onSuccess]);

  return (
    <div>
      {loading && <div>Loading payment...</div>}
      {error && <div className="text-red-600">{error}</div>}
      <div ref={containerRef} />
    </div>
  );
};

export default OneTimePayButton;
