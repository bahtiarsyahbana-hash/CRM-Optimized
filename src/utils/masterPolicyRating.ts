import { MasterPolicy, RatingRule, Deal } from '../types';

/**
 * Rating for master policy declarations.
 *
 * Rates apply to SUM INSURED, never to premium. The spread on a Dual Rate
 * cover is never stored — it is derived from the two rates at the point of use,
 * every time.
 *
 * ── How this maps onto the existing commission engine ────────────────────
 *
 * `Deal.premiumMarkup` is Markup Premium: it sits on top of the insurer's
 * gross premium, leaves Net to Insurer untouched, and is not commissionable.
 * (Verified against computeCommission: adding markup moves client-pays by the
 * full amount, and moves Net to Insurer and the commission base by zero.)
 *
 * That is exactly the dual-rate spread's behaviour, so:
 *
 *   basicPremium   = insurerRate × sumInsured   ← insurer books this,
 *                                                 commission calculates on it
 *   premiumMarkup  = spread     × sumInsured   ← broker income, not commissionable
 *   client pays    = basicPremium + premiumMarkup
 *                  = clientRate  × sumInsured
 *
 * On a Single Rate cover insurerRate is null: basicPremium is the client
 * premium and markup is zero.
 */

/* -------------------------------------------------------------------------- */
/*                              Rule resolution                               */
/* -------------------------------------------------------------------------- */

const startOfDay = (iso: string) => new Date(iso.slice(0, 10)).getTime();

/**
 * The rule in force for a cover on a given date.
 *
 * Effective dating exists so that re-opening an old declaration recalculates at
 * the rate that applied then, not today's. Always pass the declaration's own
 * `declaredAt`, never `new Date()`, when recalculating an existing record.
 *
 * `effectiveFrom` is inclusive, `effectiveTo` exclusive. When several rules
 * overlap, the one with the latest `effectiveFrom` wins, so a correction
 * layered over an existing rule takes precedence.
 */
export function resolveRatingRule(
  rules: RatingRule[],
  masterPolicyId: string,
  onDate: string,
  scope?: string,
): RatingRule | null {
  const at = startOfDay(onDate);

  const candidates = rules
    .filter(r => r.masterPolicyId === masterPolicyId)
    .filter(r => startOfDay(r.effectiveFrom) <= at)
    .filter(r => !r.effectiveTo || at < startOfDay(r.effectiveTo))
    // A scoped rule only applies to its scope; an unscoped rule is the default.
    .filter(r => (scope ? r.scope === scope || !r.scope : !r.scope));

  if (candidates.length === 0) return null;

  // Prefer a scoped match over the cover default, then the most recent rule.
  return candidates.sort((a, b) => {
    const scoped = Number(Boolean(b.scope)) - Number(Boolean(a.scope));
    if (scoped !== 0) return scoped;
    return startOfDay(b.effectiveFrom) - startOfDay(a.effectiveFrom);
  })[0];
}

/* -------------------------------------------------------------------------- */
/*                            Premium derivation                              */
/* -------------------------------------------------------------------------- */

export interface DeclarationRating {
  clientRatePercent: number;
  /** Null on Single Rate covers. */
  insurerRatePercent: number | null;
  /** Always derived, never stored. Zero on Single Rate. */
  spreadPercent: number;

  /** clientRate × sumInsured. What the client is charged. */
  clientPremium: number;
  /** insurerRate × sumInsured. What the insurer books and pays commission on. */
  insurerPremium: number;
  /** clientPremium − insurerPremium. Broker income, not commissionable. */
  spreadAmount: number;

  /** True when the cover's minimum premium floored the figures. */
  minimumPremiumApplied: boolean;

  /** Ready to spread onto a Deal — see the mapping note at the top of the file. */
  toDealPremiumFields: {
    basicPremium: number;
    premiumMarkup: number;
  };
}

/**
 * Rate one declaration.
 *
 * Minimum premium floors the **insurer** premium, since it is the floor the
 * insurer accepts. The spread is preserved in absolute terms on top of the
 * floored insurer premium, so the broker's income is unchanged by the floor
 * and the client pays floor + spread.
 *
 * NOTE: this is a judgement call, flagged for confirmation — the alternative is
 * to floor the client premium and let the spread absorb the difference, which
 * would shrink broker income on small shipments.
 */
export function rateDeclaration(
  cover: Pick<MasterPolicy, 'rateStructure' | 'minimumPremium'>,
  rule: Pick<RatingRule, 'clientRatePercent' | 'insurerRatePercent'>,
  sumInsured: number,
): DeclarationRating {
  const clientRatePercent = rule.clientRatePercent;

  // Single Rate: one rate both sides, no spread, regardless of what the rule holds.
  const insurerRatePercent = cover.rateStructure === 'Dual Rate'
    ? rule.insurerRatePercent
    : null;

  const spreadPercent = insurerRatePercent === null
    ? 0
    : clientRatePercent - insurerRatePercent;

  let clientPremium = sumInsured * (clientRatePercent / 100);
  let insurerPremium = insurerRatePercent === null
    ? clientPremium
    : sumInsured * (insurerRatePercent / 100);

  let minimumPremiumApplied = false;
  const floor = cover.minimumPremium ?? 0;
  if (floor > 0 && insurerPremium < floor) {
    const spreadAmount = clientPremium - insurerPremium;
    insurerPremium = floor;
    clientPremium = floor + spreadAmount;
    minimumPremiumApplied = true;
  }

  return {
    clientRatePercent,
    insurerRatePercent,
    spreadPercent,
    clientPremium,
    insurerPremium,
    spreadAmount: clientPremium - insurerPremium,
    minimumPremiumApplied,
    toDealPremiumFields: {
      basicPremium: insurerPremium,
      premiumMarkup: clientPremium - insurerPremium,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Guards                                   */
/* -------------------------------------------------------------------------- */

/** A deal is a declaration when it was raised under a master policy. */
export const isDeclaration = (deal: Pick<Deal, 'masterPolicyId'>): boolean =>
  Boolean(deal.masterPolicyId);

/**
 * Rates on a declaration are locked — no override, by any role.
 *
 * TODO(supabase): this is the client-side half. When the backend lands, reject
 * writes to clientRateApplied / insurerRateApplied / premiumMarkup on any deal
 * with masterPolicyId set, in a row-level policy or an API guard. Until then
 * the UI is the only enforcement point.
 */
export const areRatesLocked = isDeclaration;

/**
 * The manual Markup field is hidden on declarations — the spread supplies it.
 * It remains available for standalone submissions with no cover behind them.
 */
export const showsManualMarkup = (deal: Pick<Deal, 'masterPolicyId'>): boolean =>
  !isDeclaration(deal);

/**
 * Policy Type is immutable once the cover has any declaration, because it
 * determines what those declarations are.
 *
 * TODO(supabase): mirror this as a server-side check when the backend lands.
 */
export const canChangePolicyType = (
  masterPolicyId: string,
  deals: Pick<Deal, 'masterPolicyId'>[],
): boolean => !deals.some(d => d.masterPolicyId === masterPolicyId);
