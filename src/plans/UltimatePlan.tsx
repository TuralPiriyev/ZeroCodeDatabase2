// src/plans/UltimatePlan.tsx
import React from 'react';
import PlanCard from '../components/main/PlanCard';
import { PlanDefinitions } from '../config/PlanConfig';

const cfg = PlanDefinitions.Ultimate;

export const UltimatePlanCard: React.FC = () => (
  <PlanCard
    title={cfg.title}
    price={cfg.priceLabel}
    description={cfg.description}
    features={cfg.features}
    highlighted={false}
    ctaText="Upgrade to Ultimate"
    onSelect={() => window.location.href = 'https://www.paypal.com/ncp/payment/6WMBAA5QYX4UA'}

  />
);
