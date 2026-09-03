import { Deal, DealCommission, Client, LineOfBusiness, ProductType } from '../types';

/**
 * Default commission rate (%) by Line of Business.
 * General = 15% (OJK), Motor Vehicle = 25% (OJK), others = 0 (user must enter).
 */
export const COMMISSION_DEFAULT_BY_LOB: Record<LineOfBusiness, number> = {
  Manufacture: 15,
  Trading: 15,
  'Financial Institution': 15,
  Property: 15,
  Individual: 15,
  Others: 15,
};

/** Default tax rate (PPh 23) applied to broker commission. */
export const DEFAULT_TAX_PERCENT = 2;

/**
 * Determine the default commission rate for a deal based on the client's LOB,
 * the product category and the deal's type of insurance. Motor Vehicle is
 * special-cased to 25% per OJK.
 *
 * The product category is the reliable signal — under the Motor Vehicle
 * product the types are "Comprehensive" / "Total Loss Only", which don't
 * contain the word "motor". The string heuristic is kept as a fallback for
 * deals recorded before products became a cascade.
 */
export function defaultCommissionRate(
  client: Client | undefined,
  typeOfInsurance: string,
  productType?: ProductType | '',
): number {
  if (productType === 'Motor Vehicle') return 25;
  const t = (typeOfInsurance || '').toLowerCase();
  if (t.includes('motor') || t.includes('vehicle') || t === 'mv') return 25;
  if (!client) return 15;
  return COMMISSION_DEFAULT_BY_LOB[client.lineOfBusiness] ?? 15;
}

/** Inputs to the premium side of the calculation. */
export interface PremiumInputs {
  basicPremium: number;
  premiumMarkup: number;
  adminFee: number;
  policyFee: number;
  stampDuty: number;
}

export interface CommissionBreakdown {
  /* ---- Premium ---- */
  basicPremium: number;
  premiumMarkup: number;
  adminFee: number;
  policyFee: number;
  stampDuty: number;
  /** basicPremium + markup + adminFee + policyFee + stampDuty */
  totalPremiumPayable: number;

  /* ---- Rates ---- */
  baseRate: number;
  discountPercent: number;
  efPercent: number;
  taxPercent: number;

  /* ---- Amounts ---- */
  basicCommission: number;
  discountAmount: number;
  efAmount: number;
  /** basicCommission − discountAmount. The base the tax is charged on. */
  netBasicCommission: number;
  taxAmount: number;

  /* ---- Outputs ---- */
  /** basicPremium − basicCommission + stampDuty + tax */
  premiumToInsurer: number;
  /** basicCommission + markup */
  totalGrossCommission: number;
  /** basicCommission − discount − tax + markup + ef */
  totalNetCommission: number;

  /** Fee paid out to the agent / introducer. */
  overrideFee: number;
  /** totalNetCommission − overrideFee */
  netAfterOverride: number;
}

/**
 * Pure calculator for the premium and commission model.
 *
 * Commission, discount, EF and the override fee are all percentages of the
 * **basic premium** — the risk premium before markup and fees. Tax is the
 * exception: it is charged on the **net basic commission**, i.e. the basic
 * commission after the discount given away.
 *
 *   basicCommission    = basicPremium × baseRate%
 *   discountAmount     = basicPremium × discountPercent%
 *   efAmount           = basicPremium × efPercent%
 *   netBasicCommission = basicCommission − discountAmount
 *   taxAmount          = netBasicCommission × taxPercent%
 *
 *   premiumToInsurer     = basicPremium − basicCommission + stampDuty + tax
 *   totalGrossCommission = basicCommission + markup
 *   totalNetCommission   = basicCommission − discount − tax + markup + ef
 *
 * Worked example — basic premium 20,000,000 at 15% base and 10% discount:
 *   basicCommission    = 3,000,000
 *   discountAmount     = 2,000,000
 *   netBasicCommission = 1,000,000
 *   taxAmount (2%)     =    20,000
 *
 * The markup is retained entirely by the broker — it never reaches the
 * insurer — which is why it lands in commission rather than in premium.
 *
 * Discount is capped at the base rate upstream, so the net basic commission
 * cannot go negative; it is floored at zero here regardless.
 */
export function computeCommission(
  premium: PremiumInputs,
  commission: DealCommission | undefined,
): CommissionBreakdown {
  const { basicPremium, premiumMarkup, adminFee, policyFee, stampDuty } = premium;

  const baseRate = commission?.baseRate ?? 0;
  const discountPercent = commission?.discountPercent ?? 0;
  const efPercent = commission?.efCommissionPercent ?? 0;
  const taxPercent = commission?.taxPercent ?? DEFAULT_TAX_PERCENT;

  const basicCommission = basicPremium * (baseRate / 100);
  const discountAmount = basicPremium * (discountPercent / 100);
  const efAmount = basicPremium * (efPercent / 100);
  // Tax is charged on the net basic commission, not on the premium.
  const netBasicCommission = Math.max(0, basicCommission - discountAmount);
  const taxAmount = netBasicCommission * (taxPercent / 100);

  const totalPremiumPayable = basicPremium + premiumMarkup + adminFee + policyFee + stampDuty;
  const premiumToInsurer = basicPremium - basicCommission + stampDuty + taxAmount;
  const totalGrossCommission = basicCommission + premiumMarkup;
  const totalNetCommission = basicCommission - discountAmount - taxAmount + premiumMarkup + efAmount;

  // Override fee is a payout, applied after the net figure above.
  const overrideFee = commission?.overrideFeeType === 'percent'
    ? basicPremium * ((commission?.overrideFee ?? 0) / 100)
    : (commission?.overrideFee ?? 0);

  return {
    basicPremium, premiumMarkup, adminFee, policyFee, stampDuty,
    totalPremiumPayable,
    baseRate, discountPercent, efPercent, taxPercent,
    basicCommission, discountAmount, efAmount, netBasicCommission, taxAmount,
    premiumToInsurer, totalGrossCommission, totalNetCommission,
    overrideFee,
    netAfterOverride: totalNetCommission - overrideFee,
  };
}

/** Premium inputs for a stored deal, with sensible fallbacks. */
export function premiumInputsFromDeal(deal: Deal): PremiumInputs {
  return {
    // Fall back to premiumAmount for deals recorded before the split.
    basicPremium: deal.basicPremium ?? deal.premiumAmount ?? 0,
    premiumMarkup: deal.premiumMarkup ?? 0,
    adminFee: deal.adminFee ?? 0,
    policyFee: deal.policyFee ?? 0,
    stampDuty: deal.stampDuty ?? 0,
  };
}

/**
 * Convenience: compute the full breakdown for a stored Deal.
 * Returns a zeroed breakdown if the premium is missing.
 */
export function computeDealCommission(deal: Deal): CommissionBreakdown {
  return computeCommission(premiumInputsFromDeal(deal), deal.commission);
}