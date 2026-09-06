import { jsPDF } from 'jspdf';
import { Deal, Client, DealStage } from '../types';

/* -------------------------------------------------------------------------- */
/*                    CLIENT-FACING DOCUMENT — READ THIS FIRST                */
/* -------------------------------------------------------------------------- */
/**
 * The cover note is a **client-facing** document. Everything printed here is
 * seen by the insured.
 *
 * TODO(certificate-generator): when a certificate generator is built for
 * declarations under a master policy, it must NOT take a raw `Deal`. Declarations
 * carry insurer-side figures on the same record as client-side ones:
 *
 *     insurerRateApplied   the insurer's rate on a Dual Rate cover
 *     basicPremium         what the insurer books
 *     premiumMarkup        the spread — broker income
 *
 * On a Dual Rate cover the spread and the insurer rate must never reach a
 * client-facing document or response. Passing a whole `Deal` into a client
 * document makes that a one-line mistake away, because the dangerous fields are
 * simply present on the object.
 *
 * Build a narrowed client-facing type instead — something like
 * `ClientFacingDeclaration` exposing only `clientRateApplied`, `premiumAmount`,
 * `sumInsured`, `currency`, period and identifiers — and have the generator
 * accept only that. Then omitting a field is a compile error rather than a
 * disclosure. Mirror it with an insurer-facing type for the bordereau.
 *
 * See the matching note in `utils/masterPolicyRating.ts`.
 *
 * This generator is safe today only because it is never handed a declaration:
 * it is reached from the Policy Register, and it prints no rate or markup field.
 */

/* -------------------------------------------------------------------------- */
/*                                   Gating                                   */
/* -------------------------------------------------------------------------- */

/** Stages at which a deal is bound and a cover note may be issued. */
const BOUND_STAGES: DealStage[] = ['Bind / Closed Won', 'Policy On Progress'];

export interface CoverNoteEligibility {
  allowed: boolean;
  /** Why not, phrased for the user. Undefined when allowed. */
  reason?: string;
}

/**
 * A cover note may only be issued once the submission is complete — approved,
 * and bound.
 *
 * Note that `originalPolicyFile` is deliberately *not* required. A cover note is
 * the interim document issued while the insurer's policy is still being drawn
 * up; requiring the policy PDF would block it exactly when it is needed.
 *
 * This matters because the Policy Register admits any deal whose `dealType` is
 * 'Renewal' regardless of stage or approval, so reaching the button is not by
 * itself evidence that the deal is bound.
 *
 * TODO(supabase): mirror as a server-side check when the backend lands, so an
 * API client cannot render a cover note for an unbound deal.
 */
export function canGenerateCoverNote(deal: Deal): CoverNoteEligibility {
  if (deal.approvalStatus !== 'Approved') {
    return {
      allowed: false,
      reason: `This submission is ${deal.approvalStatus || 'Draft'}. A cover note can only be issued once it is approved and bound.`,
    };
  }
  if (!BOUND_STAGES.includes(deal.statusStage)) {
    return {
      allowed: false,
      reason: `This deal is at ${deal.statusStage}. Bind it before issuing a cover note.`,
    };
  }
  return { allowed: true };
}

/** Thrown when generation is attempted on a deal that is not yet complete. */
export class CoverNoteNotAvailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CoverNoteNotAvailableError';
  }
}

export const generateCoverNote = (deal: Deal, client: Client) => {
  // Enforced here, not only at the call site, so a future caller cannot skip it.
  const eligibility = canGenerateCoverNote(deal);
  if (!eligibility.allowed) {
    throw new CoverNoteNotAvailableError(eligibility.reason!);
  }

  const doc = new jsPDF();
  
  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 50, 150);
  doc.text('COVER NOTE', 105, 20, { align: 'center' });
  
  // Date & Reference
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const cnNumber = deal.coverNoteNumber || `CN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  doc.text(`Cover Note No: ${cnNumber}`, 20, 35);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, 140, 35);
  
  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 42, 190, 42);

  // Content
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  
  let yPos = 55;
  const lineSpace = 10;
  
  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, yPos);
    
    doc.setFont("helvetica", "normal");
    const splitValue = doc.splitTextToSize(value || '-', 110);
    doc.text(splitValue, 70, yPos);
    
    yPos += splitValue.length * lineSpace;
  };
  
  addRow('Name of Insured:', client.companyName);
  addRow('Correspondence Address:', client.companyAddress || '-');
  
  const periodStart = deal.periodStart ? new Date(deal.periodStart).toLocaleDateString() : 'TBA';
  const periodEnd = deal.periodEnd ? new Date(deal.periodEnd).toLocaleDateString() : 'TBA';
  addRow('Period of Insurance:', `${periodStart} to ${periodEnd}`);
  
  addRow('Risk Occupation:', client.businessOccupation || '-');
  addRow('Risk Location:', deal.riskLocation || client.companyAddress || '-');
  addRow('Type of Insurance:', deal.typeOfInsurance || '-');
  addRow('Insurance Company:', deal.insuranceCompany || '-');
  
  // Sum Insured logic
  let sumInsuredStr = `${deal.currency} ${deal.sumInsured?.toLocaleString() || '0'}`;
  if (deal.sumInsuredBreakdown && deal.sumInsuredBreakdown.length > 0) {
    sumInsuredStr += '\n' + deal.sumInsuredBreakdown.map(b => `- ${b.assetName}: ${deal.currency} ${b.amount.toLocaleString()}`).join('\n');
  }
  addRow('Interest/Sum Insured:', sumInsuredStr);
  
  // Premium Rate
  if (deal.premiumRate) {
    addRow('Premium Rate:', deal.premiumRate);
  }
  
  // Premium Calculation
  if (deal.premiumAmount) {
    const basis = deal.premiumType === 'Percentage from Sum Insured' && deal.premiumRatePercent
      ? `${deal.premiumRatePercent}% of Sum Insured`
      : 'Fixed Amount';
    addRow('Premium Basis:', basis);
    addRow('Total Premium:', `${deal.currency} ${deal.premiumAmount.toLocaleString()}`);
  }

  // Footer / Signatures
  yPos = Math.max(yPos + 20, 220);
  doc.setFontSize(10);
  doc.text('This cover note is issued subject to the terms, conditions, and exceptions of the standard policy.', 20, yPos);
  
  yPos += 20;
  doc.text('Authorized Signature:', 20, yPos);
  doc.line(20, yPos + 10, 80, yPos + 10);
  doc.text('For and on behalf of RiskFlow Enterprise', 20, yPos + 15);

  doc.save(`${client.companyName.replace(/\s+/g, '_')}_Cover_Note.pdf`);
};
