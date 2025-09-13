import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';

interface PayPalButtonProps {
  // planId is the PayPal plan id (P-XXXXXXXX) created in PayPal dashboard
  planId: string;
  onSuccess: (expiresAt: string) => void;
}

export const PayPalButton: React.FC<PayPalButtonProps> = ({ planId, onSuccess }) => {
  return (
    <PayPalButtons
      style={{ layout: 'vertical', shape: 'pill', label: 'subscribe' }}
      createSubscription={async (_data: any, actions: any) => {
        if (!planId) return Promise.reject('planId missing');
        try {
          // Do not request shipping/address from PayPal for subscription-only products
          const sub = await actions.subscription.create({
            plan_id: planId,
            application_context: { shipping_preference: 'NO_SHIPPING' }
          });
          console.log('createSubscription result', sub);
          return sub;
        } catch (err: any) {
          console.error('createSubscription error', err);
          if (err && (err.details || err.message)) console.error('PayPal createSubscription details:', err.details || err.message);
          throw err;
        }
      }}
  onApprove={async (data: any) => {
        // data.subscriptionID is what PayPal returns
        try {
          const subscriptionID = data.subscriptionID;
          // send subscriptionID to backend for verification and mapping to logged-in user
          const resp = await fetch('/api/paypal/confirm-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // ensure cookies are sent (if using cookie auth)
            body: JSON.stringify({ subscriptionID })
          });
          const json = await resp.json();
          if (resp.ok && json.success) {
            onSuccess(json.expiresAt);
          } else {
            console.error('Subscription confirm failed', json);
            // show user error message as needed
          }
        } catch (err) {
          console.error('Error confirming subscription', err);
        }
      }}
      onError={(err: any) => {
        console.error('PayPal error', err);
        if (err && (err.details || err.message)) console.error('PayPal onError details:', err.details || err.message);
      }}
      onCancel={() => {
        console.log('Payment cancelled');
      }}
    />
  );
};
