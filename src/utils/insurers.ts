import { Insurer, Deal, MasterPolicy, Client, ProductType } from '../types';
import { defaultCommissionRate } from './commissionCalc';

/* -------------------------------------------------------------------------- */
/*                              Code generation                               */
/* -------------------------------------------------------------------------- */

/** Words that carry no identifying information in an Indonesian insurer name. */
const NOISE = new Set([
  'PT', 'CV', 'TBK', 'PERSERO',
  'ASURANSI', 'INSURANCE', 'INSURANS', 'REASURANSI', 'REINSURANCE',
  'INDONESIA', 'GENERAL', 'UMUM', 'JIWA', 'LIFE', 'BROKER', 'BROKERS',
]);

/**
 * Derive a short uppercase code from an insurer name.
 *
 * Prefers a parenthesised abbreviation when the name carries one — "PT Asuransi
 * Central Asia (ACA)" gives ACA — since that is the reference the market
 * actually uses. Otherwise it takes initials of the meaningful words, which is
 * how most of the seeded list resolves: only 3 of 64 names have a usable
 * abbreviation in brackets.
 */
export function deriveInsurerCode(name: string): string {
  const paren = name.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (paren && /^[A-Za-z]{2,8}$/.test(paren) && paren === paren.toUpperCase()) {
    return paren.toUpperCase();
  }

  const words = name
    .replace(/\([^)]*\)/g, ' ')            // drop the parenthetical
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !NOISE.has(w.toUpperCase()));

  const source = words.length > 0 ? words : name.split(/\s+/).filter(Boolean);

  // One meaningful word gives a readable prefix; several give initials.
  const code = source.length === 1
    ? source[0].slice(0, 6)
    : source.map(w => w[0]).join('').slice(0, 6);

  return (code || 'INS').toUpperCase();
}

/** Make a code unique against those already taken, by suffixing a number. */
export function uniqueInsurerCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 5)}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 4)}${Date.now() % 1000}`;
}

/* -------------------------------------------------------------------------- */
/*                                  Matching                                  */
/* -------------------------------------------------------------------------- */

const normalizeName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

/** Find the insurer a stored name string refers to. Exact match on name only. */
export function matchInsurerByName(insurers: Insurer[], name?: string): Insurer | null {
  if (!name || !name.trim()) return null;
  const target = normalizeName(name);
  return insurers.find(i => normalizeName(i.name) === target) ?? null;
}

/* -------------------------------------------------------------------------- */
/*                            Commission resolution                           */
/* -------------------------------------------------------------------------- */

export interface CommissionRateSource {
  rate: number;
  source: 'insurer' | 'default';
  /** Which insurer supplied it, when the source is 'insurer'. */
  insurerName?: string;
}

/**
 * The base commission rate to pre-fill on a deal.
 *
 * The insurer's own rate wins when one is selected and it has a rate, because
 * that is the specifically negotiated figure. Otherwise it falls back to
 * `defaultCommissionRate`, which is left untouched — this resolver sits
 * alongside it rather than changing it.
 *
 * Callers must keep the seed-only-when-empty behaviour: this returns a
 * suggestion, and a rate a user has typed is never overwritten.
 */
export function resolveBaseCommissionRate(
  insurer: Insurer | null | undefined,
  client: Client | undefined,
  typeOfInsurance: string,
  productType?: ProductType | '',
): CommissionRateSource {
  if (insurer && insurer.commissionRatePercent != null && insurer.commissionRatePercent > 0) {
    return { rate: insurer.commissionRatePercent, source: 'insurer', insurerName: insurer.name };
  }
  return { rate: defaultCommissionRate(client, typeOfInsurance, productType), source: 'default' };
}

/* -------------------------------------------------------------------------- */
/*                                Soft delete                                 */
/* -------------------------------------------------------------------------- */

export interface InsurerUsage {
  deals: number;
  masterPolicies: number;
  total: number;
}

export function insurerUsage(
  insurerId: string,
  deals: Pick<Deal, 'insurerId'>[],
  masterPolicies: Pick<MasterPolicy, 'insurerId'>[],
): InsurerUsage {
  const d = deals.filter(x => x.insurerId === insurerId).length;
  const m = masterPolicies.filter(x => x.insurerId === insurerId).length;
  return { deals: d, masterPolicies: m, total: d + m };
}

/**
 * A referenced insurer is never hard-deleted — deactivating keeps the history
 * on every deal and policy that points at it, while removing it from pickers.
 */
export function canHardDeleteInsurer(usage: InsurerUsage): boolean {
  return usage.total === 0;
}

/** Insurers offered in a picker: active ones, plus whichever is already selected. */
export function selectableInsurers(insurers: Insurer[], currentId?: string): Insurer[] {
  return insurers
    .filter(i => i.active || i.id === currentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
