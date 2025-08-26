import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';

interface PayPalButtonProps {
  userId: string;
  plan: 'Pro' | 'Ultimate';
  onSuccess: (expiresAt: string) => void;
}

export const PayPalButton: React.FC<PayPalButtonProps> = ({ userId, plan, onSuccess }) => {
  return (
    <PayPalButtons
      style={{ layout: 'vertical', shape: 'pill', label: 'pay' }}
      createOrder={(_data: any, actions: any) => {
        return fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, plan })
        })
          .then(res => res.json())
          .then(data => data.orderID);
      }}
      onApprove={(_data: any, actions: any) => {
        return actions.order.capture().then((details: any) => {
          return fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: details.id, userId, plan })
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                onSuccess(data.expiresAt);
              } else {
                console.error('Capture failed', data);
              }
            });
        });
      }}
      onError={(err: any) => console.error('PayPal error', err)}
      onCancel={() => console.log('Payment cancelled')}
    />
  );
};