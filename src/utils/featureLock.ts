// src/utils/featureLock.ts

import { PlanDefinitions } from '../config/PlanConfig';

export type PlanName = keyof typeof PlanDefinitions;

/**
 * Yoxlayır: müəyyən plan üçün feature(məs: 'Database backups') aktivdir?
 */
export function isFeatureAllowed(plan: PlanName, feature: string): boolean {
  const cfg = PlanDefinitions[plan];
  return cfg.features.some(f => f.toLowerCase() === feature.toLowerCase());
}

/**
 * Backend və ya UI-da istifadə: 
 * if (!isFeatureAllowed(user.subscriptionPlan, 'API generation')) -> blokla
 */
