// src/components/main/PlansSection.tsx
import React from 'react';
import PlanCard from './PlanCard';
import { useNavigate } from 'react-router-dom';

const PlansSection: React.FC = () => {
  const navigate = useNavigate();

  const goToSubscribe = (planKey: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // first try client-side routing (SPA)
      if (typeof navigate === 'function') {
        navigate(`/subscribe?plan=${planKey}`);
        // small delay to allow navigation; if route is not registered, fallback to full reload
        setTimeout(() => {
          if (window.location.pathname.indexOf('/subscribe') === -1 && !window.location.href.includes(`plan=${planKey}`)) {
            // fallback
            window.location.href = `/subscribe?plan=${planKey}`;
          }
        }, 150);
        return;
      }

      // otherwise fallback
      window.location.href = `/subscribe?plan=${planKey}`;
    } catch (err) {
      console.error('goToSubscribe error', err);
      window.location.href = `/subscribe?plan=${planKey}`;
    }
  };

  const plans = [
    {
      title: 'Free',
      price: 'Free',
      description: 'Perfect for learning and small projects',
      features: [ /* ... */ ],
      highlighted: false,
      onSelect: (e?: React.MouseEvent<HTMLButtonElement>) => goToSubscribe('free', e),
      ctaText: 'Choose Free',
    },
    {
      title: 'Pro',
      price: '$19',
      description: 'For professionals and serious projects',
      features: [ /* ... */ ],
      highlighted: true,
      onSelect: (e?: React.MouseEvent<HTMLButtonElement>) => {
        console.log('Pro clicked — redirecting to subscribe page', new Date().toISOString());
        goToSubscribe('pro', e);
      },
      ctaText: 'Buy Pro',
    },
    {
      title: 'Team',
      price: '$49',
      description: 'For teams working on multiple projects',
      features: [ /* ... */ ],
      highlighted: false,
      onSelect: (e?: React.MouseEvent<HTMLButtonElement>) => goToSubscribe('ultimate', e),
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
      </div>
    </section>
  );
};

export default PlansSection;
