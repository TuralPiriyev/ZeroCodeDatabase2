// src/plans/ProPlan.tsx
import React from 'react';
import PlanCard from '../components/main/PlanCard';
import { PlanDefinitions } from '../config/PlanConfig';
const cfg = PlanDefinitions.Pro;

export const ProPlanCard: React.FC = () => (
  <PlanCard
    title={cfg.title}
    price={cfg.priceLabel}
    description={cfg.description}
    features={cfg.features}
    highlighted={true}    // məsələn “Most Popular”
    ctaText="Upgrade to Pro"
    onSelect={() => window.location.href = 'https://www.paypal.com/ncp/payment/F2SDPFKYS3YVQ'}
  />
);
