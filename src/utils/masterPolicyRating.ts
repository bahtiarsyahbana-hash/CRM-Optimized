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
 * Raised when a declaration's date falls outside every rating rule on its
 * cover. This is always a hard failure — see `requireRatingRule`.
 */
export class MissingRatingRuleError extends Error {
  constructor(
    readonly masterPolicyId: string,
    readonly onDate: string,
    readonly scope?: string,
  ) {
    super(
      `No rating rule is in effect for this cover on ${onDate.slice(0, 10)}` +
      (scope ? ` (scope: ${scope})` : '') +
      '. Add a rule covering that date before declaring.',
    );
    this.name = 'MissingRatingRuleError';
  }
}

/**
 * The rule in force for a cover on a given date, or null when there is none.
 *
 * Effective dating exists so that re-opening an old declaration recalculates at
 * the rate that applied then, not today's. Always pass the declaration's own
 * `declaredAt`, never `new Date()`, when recalculating an existing record.
 *
 * `effectiveFrom` is inclusive, `effectiveTo` exclusive. When several rules
 * overlap, the one with the latest `effectiveFrom` wins, so a correction
 * layered over an existing rule takes precedence.
 *
 * A gap in coverage returns null — it never snaps to the nearest rule by date.
 * A near-miss rate is a wrong rate, and silently applying one would misprice
 * the declaration with no signal. Callers that must produce a premium should
 * use `requireRatingRule` instead.
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

/**
 * Same lookup, but a missing rule is a hard failure.
 *
 * Use this anywhere a premium is actually produced — declaration entry, bulk
 * import, recalculation. A declaration with no rule in effect must be blocked
 * outright: never rated at zero, never snapped to the nearest rule by date.
 * Both would put a wrong number on a financial record with nothing to show
 * that it was wrong.
 *
 * TODO(supabase): mirror as a server-side constraint when the backend lands,
 * so an API client cannot post a declaration that skipped this check.
 */
export function requireRatingRule(
  rules: RatingRule[],
  masterPolicyId: string,
  onDate: string,
  scope?: string,
): RatingRule {
  const rule = resolveRatingRule(rules, masterPolicyId, onDate, scope);
  if (!rule) throw new MissingRatingRuleError(masterPolicyId, onDate, scope);
  return rule;
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

  /**
   * True when the derived spread is negative — a data problem, not a valid
   * state. RatingRuleModal rejects an insurer rate above the client rate; this
   * is the backstop for any rule written before that check existed.
   */
  spreadIsNegative: boolean;

  /** Ready to spread onto a Deal — see the mapping note at the top of the file. */
  toDealPremiumFields: {
    basicPremium: number;
    premiumMarkup: number;
  };
}

/**
 * Rate one declaration.
 *
 * Premium is rate × sum insured, with no floor and no cap. The cover's Limit
 * of Liability caps *sum insured*, not premium, and is deliberately absent
 * from this function — exceeding it raises a warning at entry, never a silent
 * adjustment to the figures.
 */
export function rateDeclaration(
  cover: Pick<MasterPolicy, 'rateStructure'>,
  rule: Pick<RatingRule, 'clientRatePercent' | 'insurerRatePercent'>,
  sumInsured: number,
): DeclarationRating {
  const isDual = cover.rateStructure === 'Dual Rate';
  const clientRatePercent = rule.clientRatePercent;

  // Single Rate: one rate both sides, no spread, whatever the rule holds.
  const insurerRatePercent = isDual ? rule.insurerRatePercent : null;

  const spreadPercent = insurerRatePercent === null
    ? 0
    : clientRatePercent - insurerRatePercent;

  const clientPremium = sumInsured * (clientRatePercent / 100);
  const insurerPremium = insurerRatePercent === null
    ? clientPremium
    : sumInsured * (insurerRatePercent / 100);

  const spreadAmount = clientPremium - insurerPremium;

  return {
    clientRatePercent,
    insurerRatePercent,
    spreadPercent,
    clientPremium,
    insurerPremium,
    spreadAmount,
    spreadIsNegative: spreadAmount < 0,
    toDealPremiumFields: {
      basicPremium: insurerPremium,
      premiumMarkup: spreadAmount,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Guards                                   */
/* -------------------------------------------------------------------------- */

/**
 * Whether a declaration's sum insured exceeds the cover's Limit of Liability.
 *
 * Advisory only. The limit caps insured value, not premium, and it deliberately
 * does not enter `rateDeclaration` — a declaration above the limit still rates
 * normally and is still accepted. Whether to write it is the broker's call,
 * often after agreeing a special acceptance with the insurer, so the form warns
 * rather than blocks.
 */
export function exceedsLimitOfLiability(
  cover: Pick<MasterPolicy, 'sumInsuredLimit'>,
  sumInsured: number,
): boolean {
  const limit = cover.sumInsuredLimit ?? 0;
  return limit > 0 && sumInsured > limit;
}

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
