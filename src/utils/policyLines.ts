import { Deal, PolicyLine } from '../types';

/**
 * Returns a normalized list of policy lines for a deal.
 *
 * - If `deal.lines` exists and has 1+ entries, those are returned.
 * - Otherwise a single synthetic line is fabricated from the deal's
 *   top-level fields so callers can always iterate over lines.
 *
 * Cover-note number and original policy file fall back to the deal-level
 * values for the synthetic line, so single-product deals show the same
 * cover note they always have.
 */
export function getDealLines(deal: Deal): PolicyLine[] {
  if (deal.lines && deal.lines.length > 0) return deal.lines;
  return [{
    id: `__primary_${deal.id}`,
    productName: deal.typeOfInsurance || 'Untitled product',
    sumInsured: deal.sumInsured,
    premiumAmount: deal.premiumAmount,
    coverNoteNumber: deal.coverNoteNumber,
    originalPolicyFile: deal.originalPolicyFile,
  }];
}

export function isMultiProduct(deal: Deal): boolean {
  return !!deal.lines && deal.lines.length > 1;
}

/** Summary string for showing on list rows. */
export function summarizeLines(deal: Deal): string {
  const lines = getDealLines(deal);
  if (lines.length === 1) return lines[0].productName;
  return lines.map(l => l.productName).filter(Boolean).join(' + ');
}
