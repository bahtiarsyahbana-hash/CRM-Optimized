import { Deal, DealCommission, Client, LineOfBusiness } from '../types';

/**
 * Default commission rate (%) by Line of Business.
 * General = 15% (OJK), Motor Vehicle = 25% (OJK), others = 0 (user must enter).
 */
export const COMMISSION_DEFAULT_BY_LOB: Record<LineOfBusiness, number> = {
  Manufacture: 15,
  Trading: 15,
  'Financial Institution': 15,
  Property: 15,
  Others: 15,
};

/** Default tax rate (PPh 23) applied to broker commission. */
export const DEFAULT_TAX_PERCENT = 2;

/**
 * Determine the default commission rate for a deal based on the client's LOB
 * and the deal's type of insurance. Motor Vehicle is special-cased to 25% per OJK.
 */
export function defaultCommissionRate(
  client: Client | undefined,
  typeOfInsurance: string,
): number {
  const t = (typeOfInsurance || '').toLowerCase();
  if (t.includes('motor') || t.includes('vehicle') || t === 'mv') return 25;
  if (!client) return 15;
  return COMMISSION_DEFAULT_BY_LOB[client.lineOfBusiness] ?? 15;
}

export interface CommissionBreakdown {
  baseRate: number;
  baseAmount: number;
  discountPercent: number;
  discountAmount: number;
  efPercent: number;
  efAmount: number;
  /** baseAmount − discountAmount + efAmount */
  grossCommission: number;
  taxPercent: number;
  taxAmount: number;
  agentCashback: number;
  /** grossCommission − taxAmount − agentCashback */
  netIncome: number;
}

/**
 * Pure calculator. Given a deal's premium and commission config, return all derived numbers.
 * Defaults: discount=0, ef=0, tax=2%, agentCashback=0.
 */
export function computeCommission(
  premium: number,
  commission: DealCommission | undefined,
): CommissionBreakdown {
  const baseRate = commission?.baseRate ?? 0;
  const discountPercent = commission?.discountPercent ?? 0;
  const efPercent = commission?.efCommissionPercent ?? 0;
  const taxPercent = commission?.taxPercent ?? DEFAULT_TAX_PERCENT;
  const agentCashback = commission?.agentCashback ?? 0;

  const baseAmount = premium * (baseRate / 100);
  const discountAmount = premium * (discountPercent / 100);
  const efAmount = premium * (efPercent / 100);
  const grossCommission = baseAmount - discountAmount + efAmount;
  const taxAmount = Math.max(0, grossCommission) * (taxPercent / 100);
  const netIncome = grossCommission - taxAmount - agentCashback;

  return {
    baseRate, baseAmount,
    discountPercent, discountAmount,
    efPercent, efAmount,
    grossCommission,
    taxPercent, taxAmount,
    agentCashback,
    netIncome,
  };
}

/**
 * Convenience: compute commission for an entire Deal record.
 * Returns a zeroed breakdown if premium is missing.
 */
export function computeDealCommission(deal: Deal): CommissionBreakdown {
  return computeCommission(deal.premiumAmount ?? 0, deal.commission);
}