// src/plans/FreePlan.tsx
import React from 'react';
import PlanCard from '../components/main/PlanCard';
import { PlanDefinitions } from '../config/PlanConfig';

const cfg = PlanDefinitions.Free;

export const FreePlanCard: React.FC = () => (
  <PlanCard
    title={cfg.title}
    price={cfg.priceLabel}
    description={cfg.description}
    features={cfg.features}
    highlighted={false}
    ctaText="Choose Free"
    
  />
);
