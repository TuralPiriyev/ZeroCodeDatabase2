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
      createSubscription={(_data: any, actions: any) => {
        if (!planId) return Promise.reject('planId missing');
        return actions.subscription.create({
          'plan_id': planId
        });
      }}
      onApprove={async (data: any, actions: any) => {
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
      }}
      onCancel={() => {
        console.log('Payment cancelled');
      }}
    />
  );
};
