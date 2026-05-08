import { Client, Deal, CompanyClass } from '../types';

// Threshold: any single deal premium at or above this makes the client a Large Enterprise
export const LARGE_ENTERPRISE_PREMIUM_THRESHOLD = 100_000_000; // IDR 100M

export interface ClientClassification {
  /** The class to display (manual override if set, otherwise auto-derived). */
  effectiveClass: CompanyClass;
  /** What the auto rule would say, regardless of override. */
  autoClass: CompanyClass;
  /** Why auto says what it says. */
  autoReasons: string[];
  /** True if the user has manually overridden the auto suggestion. */
  isManualOverride: boolean;
}

/**
 * Determines the company class for a client based on:
 *  1. Highest single deal premium >= IDR 100M -> Large Enterprise
 *  2. Has a parent group set -> Large Enterprise
 * Otherwise -> SME.
 *
 * If the client has companyClassMode === 'manual', the stored companyClass is honored.
 */
export function classifyClient(client: Client, allDeals: Deal[]): ClientClassification {
  const clientDeals = allDeals.filter(d => d.clientId === client.id);
  const highestPremium = clientDeals.reduce((max, d) => {
    const p = d.premiumAmount ?? 0;
    return p > max ? p : max;
  }, 0);

  const reasons: string[] = [];
  let autoClass: CompanyClass = 'SME';

  if (highestPremium >= LARGE_ENTERPRISE_PREMIUM_THRESHOLD) {
    autoClass = 'Large Enterprise';
    reasons.push(`Highest single deal premium IDR ${highestPremium.toLocaleString()} ≥ IDR ${LARGE_ENTERPRISE_PREMIUM_THRESHOLD.toLocaleString()}`);
  }
  if (client.parentGroup && client.parentGroup.trim().length > 0) {
    autoClass = 'Large Enterprise';
    reasons.push(`Part of group: ${client.parentGroup}`);
  }
  if (reasons.length === 0) {
    reasons.push('No deal premium ≥ IDR 100M and no parent group');
  }

  const isManualOverride = client.companyClassMode === 'manual' && !!client.companyClass;
  const effectiveClass: CompanyClass = isManualOverride ? client.companyClass! : autoClass;

  return { effectiveClass, autoClass, autoReasons: reasons, isManualOverride };
}