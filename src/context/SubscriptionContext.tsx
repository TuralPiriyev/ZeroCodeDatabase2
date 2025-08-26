import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import axios from 'axios';
// Subscription plan types
export type SubscriptionPlan = 'free' | 'pro' | 'ultimate';

// Feature limits for each plan
export interface PlanLimits {
  maxTables: number;
  maxColumns: number;
  maxRelationships: number;
  maxUsers: number;
  maxQueries: number;
  maxSchemas: number;
  canExportSQL: boolean;
  canUseAI: boolean;
  canUseAdvancedSecurity: boolean;
  canUseVisualQuery: boolean;
  canUseCRUD: boolean;
  canUseIndexes: boolean;
  canUseConstraints: boolean;
}

// Plan configurations
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    maxTables: 3,
    maxColumns: 10,
    maxRelationships: 2,
    maxUsers: 1,
    maxQueries: 5,
    maxSchemas: 1,
    canExportSQL: false,
    canUseAI: false,
    canUseAdvancedSecurity: false,
    canUseVisualQuery: true,
    canUseCRUD: true,
    canUseIndexes: false,
    canUseConstraints: false,
  },
  pro: {
    maxTables: 20,
    maxColumns: 50,
    maxRelationships: 30,
    maxUsers: 5,
    maxQueries: 50,
    maxSchemas: 10,
    canExportSQL: true,
    canUseAI: true,
    canUseAdvancedSecurity: false,
    canUseVisualQuery: true,
    canUseCRUD: true,
    canUseIndexes: true,
    canUseConstraints: true,
  },
  ultimate: {
    maxTables: Infinity,
    maxColumns: Infinity,
    maxRelationships: Infinity,
    maxUsers: Infinity,
    maxQueries: Infinity,
    maxSchemas: Infinity,
    canExportSQL: true,
    canUseAI: true,
    canUseAdvancedSecurity: true,
    canUseVisualQuery: true,
    canUseCRUD: true,
    canUseIndexes: true,
    canUseConstraints: true,
  },
};

// Plan details for UI
export const PLAN_DETAILS = {
  free: {
    title: 'Free',
    price: 'Free',
    description: 'Perfect for learning and small projects',
    features: [
      'Up to 3 tables',
      'Basic table creation',
      'Simple relationships',
      'Visual query builder',
      'CRUD operations',
      'Community support'
    ],
  },
  pro: {
    title: 'Pro',
    price: '$9.99',
    description: 'Ideal for professional developers and teams',
    features: [
      'Up to 20 tables',
      'Advanced table features',
      'Complex relationships',
      'SQL export functionality',
      'AI assistant',
      'Indexes and constraints',
      'Multiple schemas',
      'Priority support'
    ],
    highlighted: true,
  },
  ultimate: {
    title: 'Ultimate',
    price: '$19.99',
    description: 'For enterprise teams and large-scale projects',
    features: [
      'Unlimited tables',
      'Advanced security features',
      'User management',
      'Team collaboration',
      'Advanced AI features',
      'Custom export formats',
      'Unlimited schemas',
      'Dedicated support'
    ],
  },
};

interface SubscriptionContextType {
  loading: boolean;
  currentPlan: SubscriptionPlan;
  planLimits: PlanLimits;
  changePlan: (plan: SubscriptionPlan) => void;
  canUseFeature: (feature: keyof PlanLimits) => boolean;
  isLimitReached: (feature: keyof PlanLimits, currentCount: number) => boolean;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  upgradeReason: string;
  setUpgradeReason: (reason: string) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('free');
  const [_expiresAt, setExpiresAt] = useState<Date | null>(null);

  const planLimits = PLAN_LIMITS[currentPlan];

useEffect(() => {
    // yalnız data fetch et, redirect etmə
    (async () => {
      try {
        const { data } = await api.get('/subscription/status');
        setCurrentPlan(data.plan.toLowerCase() as SubscriptionPlan);
        setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const changePlan = (plan: SubscriptionPlan) => {
    setCurrentPlan(plan);
    setShowUpgradeModal(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <p className="mt-4 text-blue-600">Loading...</p>
      </div>
    );
  }

  const canUseFeature = (feature: keyof PlanLimits): boolean => {
    return planLimits[feature] as boolean;
  };

  const isLimitReached = (feature: keyof PlanLimits, currentCount: number): boolean => {
    const limit = planLimits[feature] as number;
    return currentCount >= limit;
  };

  const value: SubscriptionContextType = {
    loading,
    currentPlan,
    planLimits,
    changePlan,
    canUseFeature,
    isLimitReached,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeReason,
    setUpgradeReason,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
