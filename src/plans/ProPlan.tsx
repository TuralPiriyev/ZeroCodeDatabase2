// src/plans/ProPlan.tsx
import React from 'react';
import PlanCard from '../components/main/PlanCard';
import { PlanDefinitions } from '../config/PlanConfig';
import { useNavigate } from 'react-router-dom';

const cfg = PlanDefinitions.Pro;

const ProPlanCard: React.FC = () => {
  const navigate = useNavigate();
  return (
    <PlanCard
      title={cfg.title}
      price={cfg.priceLabel}
      description={cfg.description}
      features={cfg.features}
      highlighted={true}
      ctaText="Upgrade to Pro"
      onSelect={() => navigate('/subscribe?plan=pro')}
    />
  );
};

export default ProPlanCard;
