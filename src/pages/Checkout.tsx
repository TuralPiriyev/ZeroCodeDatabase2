import React from 'react';
import PaypalSubscription from '../components/PaypalSubscription';

const CheckoutPage: React.FC = () => {
  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Checkout</h2>
      <p className="mb-4">Subscribe to Pro plan using PayPal.</p>
      <PaypalSubscription onSuccess={(id) => alert('Subscribed: ' + id)} />
    </div>
  );
};

export default CheckoutPage;
