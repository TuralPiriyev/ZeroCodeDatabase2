// src/components/main/PlansSection.tsx
import React from 'react';
import PlanCard from './PlanCard';

const PlansSection: React.FC = () => {
  const plans = [
    {
      title: 'Free',
      price: 'Free',
      description: 'Perfect for learning and small projects',
      features: [
        'Up to 3 database tables',
        'Basic export options (SQL)',
        'Community support',
        'Visual table designer',
        'Single user',
      ],
      highlighted: false,
      // Free üçün heç bir link, onSelect boş
      onSelect: () => { /* istəyə bağlı: modal aç */ },
      ctaText: 'Choose Free',
    },
    {
      title: 'Pro',
      price: '$19',
      description: 'For professionals and serious projects',
      features: [
        'Unlimited database tables',
        'All export formats',
        'Priority email support',
        'Advanced relationship mapping',
        'Database versioning',
        'API generation',
      ],
      highlighted: true,
      // Pro üçün PayPal link
      onSelect: () => {
        window.location.href = 'https://www.paypal.com/ncp/payment/F2SDPFKYS3YVQ';
      },
      ctaText: 'Buy Pro',
    },
    {
      title: 'Team',
      price: '$49',
      description: 'For teams working on multiple projects',
      features: [
        'Everything in Pro plan',
        'Up to 5 team members',
        'Team collaboration',
        'Advanced access controls',
        'Custom templates',
        'Dedicated support',
        'Database backups',
      ],
      highlighted: false,
      // Team (ultimate) üçün PayPal link
      onSelect: () => {
        window.location.href = 'https://www.paypal.com/ncp/payment/6WMBAA5QYX4UA';
      },
      ctaText: 'Buy Team',
    },
  ];

  return (
    <section id="subscription" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Subscription <span className="text-[#3AAFF0]">Plans</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Choose the plan that fits your needs. All plans include access to our visual database designer
            with different capabilities and limits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <PlanCard
              key={index}
              title={plan.title}
              price={plan.price}
              description={plan.description}
              features={plan.features}
              highlighted={plan.highlighted}
              ctaText={plan.ctaText}
              onSelect={plan.onSelect}
            />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Need a custom plan for your enterprise?
          </p>
          <a
            href="#contact"
            className="text-[#3AAFF0] font-medium border-b-2 border-[#3AAFF0] hover:text-[#007ACC] hover:border-[#007ACC] transition-colors"
          >
            Contact us for custom pricing
          </a>
        </div>
      </div>
    </section>
  );
};

export default PlansSection;
