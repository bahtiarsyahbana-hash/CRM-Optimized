export type DealType = 'New Business' | 'Renewal' | 'Cross Sell' | 'Upsell' | 'Existing Client Update';
export type DealStage = 'Leads' | 'Data Collection' | 'Quote' | 'Nego' | 'Bind / Closed Won' | 'Policy On Progress' | 'Lost';
export type LineOfBusiness = 'Manufacture' | 'Trading' | 'Financial Institution' | 'Property' | 'Individual' | 'Others' | string;
export type CompanyClass = 'SME' | 'Large Enterprise' | 'Individual';
export type CompanyClassMode = 'auto' | 'manual';

export type Currency = 'IDR' | 'USD' | 'EUR' | 'SGD' | 'JPY' | 'AUD' | 'CNY';

export const CURRENCIES: Currency[] = ['IDR', 'USD', 'EUR', 'SGD', 'JPY', 'AUD', 'CNY'];

export type ClaimStatus =
  | 'Claim Registered'
  | 'Pending'
  | 'Under Assessment'
  | 'Approved'
  | 'Settled'
  | 'Reject';

/** Statuses after which a claim is locked and cannot be moved again. */
export const TERMINAL_CLAIM_STATUSES: ClaimStatus[] = ['Settled', 'Reject'];

/** Linear progression order. Reject is allowed as an off-ramp at any non-terminal step. */
export const CLAIM_PROGRESSION: ClaimStatus[] = [
  'Claim Registered',
  'Pending',
  'Under Assessment',
  'Approved',
  'Settled',
];

export type SourceClient = 'Client Existing' | 'Referral' | 'New Business';
export const SOURCE_CLIENT_OPTIONS: SourceClient[] = ['Client Existing', 'Referral', 'New Business'];

export interface Client {
  id: string;
  companyName: string;
  lineOfBusiness: LineOfBusiness;
  companyAddress?: string;
  /** Legacy — no longer captured on the client form, but preserved on records
   *  that have it (cover-note generator + spreadsheet imports still read it). */
  businessOccupation?: string;
  /** Legacy — see businessOccupation. */
  assetDetail?: string;
  /** Legacy — see businessOccupation. */
  estimatedValueAsset?: number;
  sourceClient?: SourceClient;
  estimatedAnnualPremium?: number;
  parentGroup?: string;
  companyClass?: CompanyClass;
  companyClassMode?: CompanyClassMode;
  picName?: string;
  picEmail?: string;
  picPhone?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface DealCommission {
  /** Base commission rate (%). Defaults from LOB on the client: General=15, MV=25, others=manual. */
  baseRate?: number;
  /** Discount given to client (%). Capped at baseRate. */
  discountPercent?: number;
  /** "EF" commission — behind-the-table, custom % paid by insurer. */
  efCommissionPercent?: number;
  /** Tax % applied to the basic premium. Defaults to 2. */
  taxPercent?: number;
  /** Recipient of the override fee (sales agent / introducer). */
  agentName?: string;
  /** Override fee paid out of commission. Interpretation depends on `overrideFeeType`. */
  overrideFee?: number;
  /** How to read `overrideFee`: a percentage of basic premium, or a fixed amount. */
  overrideFeeType?: 'percent' | 'fixed';
}

/**
 * Product category. Picking one narrows the Type of Insurance options —
 * see PRODUCT_INSURANCE_TYPES below. Product and type are chosen together
 * as a two-level cascade rather than as two independent fields.
 */
export type ProductType =
  | 'General Insurance'
  | 'Marine Cargo'
  | 'Financial'
  | 'Health'
  | 'Motor Vehicle'
  | 'Others';

export const PRODUCT_TYPES: ProductType[] = [
  'General Insurance',
  'Marine Cargo',
  'Financial',
  'Health',
  'Motor Vehicle',
  'Others',
];

/**
 * Types available under General Insurance — carried over verbatim from the
 * flat list that used to be the only Type of Insurance dropdown.
 */
export const GENERAL_INSURANCE_TYPES: string[] = [
  'Property All Risk',
  'Industrial All Risk',
  'Fire Insurance',
  'Earthquake Insurance',
  'Marine Cargo',
  'Marine Hull',
  'Motor Vehicle',
  'Heavy Equipment',
  'Liability Insurance',
  'Directors & Officers Liability',
  'Professional Indemnity',
  'Money Insurance',
  'Fidelity Guarantee',
  'Personal Accident',
  'Group Term Life',
  'Health Insurance',
  'Travel Insurance',
  'Cyber Insurance',
  'Credit Insurance',
  'Surety Bond',
  'Other',
];

/** Type of Insurance options for each product category. */
export const PRODUCT_INSURANCE_TYPES: Record<ProductType, string[]> = {
  'General Insurance': GENERAL_INSURANCE_TYPES,
  'Marine Cargo': ['Single Shipment Certificate', 'Declaration Bulk'],
  'Financial': ['Credit Insurance', 'Bank Guarantee', 'Credit Life'],
  'Health': ['Individual Health', 'Group Health', 'Personal Accident'],
  'Motor Vehicle': ['Comprehensive', 'Total Loss Only'],
  'Others': ['Trade Credit', 'Construction All Risk', 'Electrical All Risk'],
};

/** Types valid for a product, or an empty list when no product is chosen yet. */
export const insuranceTypesForProduct = (product?: ProductType | ''): string[] =>
  product ? (PRODUCT_INSURANCE_TYPES[product] ?? []) : [];

/**
 * How the basic premium is arrived at — either keyed in directly, or derived
 * as a percentage of the sum insured.
 */
export type PremiumType = 'Fixed Amount' | 'Percentage from Sum Insured';
export const PREMIUM_TYPES: PremiumType[] = ['Fixed Amount', 'Percentage from Sum Insured'];

/** Default bea materai applied per policy document (IDR). */
export const DEFAULT_STAMP_DUTY = 10_000;

export type DealApprovalStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Needs Adjustment';

export type DealApprovalAction = 'Approve' | 'Reject' | 'Need Adjustment';

export interface DealApprovalLogEntry {
  action: DealApprovalAction;
  notes?: string;
  at: string; // ISO timestamp
  by?: string;
}

export interface DealStageLogEntry {
  fromStage: DealStage;
  toStage: DealStage;
  notes?: string;
  at: string; // ISO timestamp
  by?: string;
}

export interface DealDocuments {
  termsCondition?: string;
  personalInformation?: string; // KTP / NPWP
  surveyReport?: string;
  existingPolicy?: string;
  otherDocument?: string;
  additionalInfo?: string; // free-text notes
}

export type PaymentStatus = 'Unpaid' | 'Paid';

/**
 * One product on a multi-product deal. Each line carries its own product
 * name, sum insured, premium and (critically) its own cover note number /
 * uploaded policy file. Everything else (period, insurer, PIC, invoice,
 * approval, commission, SOC) stays at the deal level.
 */
export interface PolicyLine {
  id: string;
  productName: string;          // e.g. "Property All Risk", "Earthquake", "Machinery Breakdown"
  sumInsured?: number;
  premiumAmount?: number;
  coverNoteNumber?: string;
  originalPolicyFile?: string;
}

export interface Deal {
  id: string;
  clientId: string;
  /** Deal-level client address. Defaults to the client's companyAddress at create time but can be edited. */
  clientAddress?: string;
  dealType: DealType;
  /** When `lines` has multiple entries this is a comma-joined summary;
   *  for single-product deals it is the only product name. */
  typeOfInsurance: string;
  productType?: ProductType;
  sumInsured?: number;
  sumInsuredBreakdown?: { assetName: string; amount: number }[];
  /** Optional multi-product breakdown. When present, the deal totals
   *  (sumInsured, premiumAmount, typeOfInsurance) are derived from the lines
   *  on save, but the top-level fields are still written so older views work. */
  lines?: PolicyLine[];
  currency: string;

  /* ---- Premium calculation -------------------------------------------- */
  /** How basicPremium is arrived at: keyed in, or a % of sum insured. */
  premiumType: PremiumType | string;
  /** Rate applied to sumInsured when premiumType is 'Percentage from Sum Insured'. */
  premiumRatePercent?: number;
  /** The risk premium, before markup and fees. All commission maths keys off this. */
  basicPremium?: number;
  /** Optional uplift retained by the broker as additional commission. */
  premiumMarkup?: number;
  adminFee?: number;
  policyFee?: number;
  /** Bea materai. Passed through to the insurer, not broker income. */
  stampDuty?: number;
  /** Total payable by the client: basicPremium + markup + adminFee + policyFee + stampDuty. */
  premiumAmount?: number;
  /** Free-text rate note shown on the cover note. */
  premiumRate?: string;
  socDetails?: SOCDetails;
  insuranceCompany?: string;
  statusStage: DealStage;
  riskLocation?: string;
  riskDetail?: string;
  notes?: string;
  periodStart?: string;
  periodEnd?: string;
  /** Deal-level PIC, may differ from the master client PIC. */
  picName?: string;
  picEmail?: string;
  picPhone?: string;
  /** Optional supporting documents (filenames only — actual storage is TBD). */
  documents?: DealDocuments;
  /** Approval workflow status set on the preview step of the wizard. */
  approvalStatus?: DealApprovalStatus;
  /** Notes attached to the latest approval decision (most recent first). */
  approvalLog?: DealApprovalLogEntry[];
  /** Per-deal history of stage transitions with optional notes. */
  stageLog?: DealStageLogEntry[];
  /* ---- Declaration under a master policy ------------------------------ *
   * A declaration is a Deal with `masterPolicyId` set, so it inherits
   * invoicing, claims, commission and the policy register rather than
   * duplicating them. Presence of this field is what makes a deal a
   * declaration, and it drives three rules:
   *   - rates are locked (no override, any role)
   *   - the manual Markup field is hidden (the spread supplies it)
   *   - premiums derive from the cover's rating rules, never from an import file
   */
  /** Set when this deal was declared under a master policy. */
  masterPolicyId?: string;
  declarationNumber?: string;
  /** Date of declaration. Selects the rating rule and fixes the FX rate. */
  declaredAt?: string;
  /** Rule this declaration was rated from — lineage only. */
  ratingRuleId?: string;
  /**
   * Rates snapshotted at declaration time. Stored rather than re-read from the
   * rule so that later edits to the rule cannot rewrite a historical
   * declaration. `insurerRateApplied` is null on Single Rate covers.
   */
  clientRateApplied?: number;
  insurerRateApplied?: number | null;
  /** FX captured at declaration date, cover currency → reporting currency. */
  rateOfExchange?: number;

  /** Set when the deal is bound (via the pipeline Bind action). Anchors invoice aging. */
  bindDate?: string;
  coverNoteNumber?: string;
  originalPolicyFile?: string;
  /** Additional named parties on the policy (QQ = atas nama). Max 5. */
  qq?: string[];
  /** Commission breakdown — added in v0.2. Optional for backward compat. */
  commission?: DealCommission;
  /** Date the invoice was sent to the client (ISO). Drives receivables aging. */
  invoiceDate?: string;
  /** Payment status for the invoice. Defaults to 'Unpaid' once invoice exists. */
  paymentStatus?: PaymentStatus;
  /** Date the client paid the premium (ISO). Only set when paymentStatus = 'Paid'. */
  paymentDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface HistoryLog {
  id: string;
  dealId: string;
  fromStage: string;
  toStage: string;
  date: string;
}

/* -------------------------------------------------------------------------- */
/*                              Master Policies                               */
/* -------------------------------------------------------------------------- */

/**
 * Open Cover and Certificate are two *types* of master policy, not two pages.
 * Set at creation and immutable once the policy has any declaration — the
 * type determines how declarations behave, so changing it under live
 * declarations would retroactively change what they are.
 */
export type MasterPolicyType = 'Open Cover' | 'Certificate';
export const MASTER_POLICY_TYPES: MasterPolicyType[] = ['Open Cover', 'Certificate'];

/**
 * Single Rate — one rate applies to both sides, no spread.
 * Dual Rate  — separate client and insurer rates; the difference is the spread,
 *              which is broker income and is never stored (always derived).
 */
export type RateStructure = 'Single Rate' | 'Dual Rate';
export const RATE_STRUCTURES: RateStructure[] = ['Single Rate', 'Dual Rate'];

export interface MasterPolicy {
  id: string;
  /** Cover reference, e.g. OC/2026/0012. */
  policyNumber: string;
  clientId: string;

  /** Immutable once declarations exist. See `canChangePolicyType`. */
  policyType: MasterPolicyType;
  rateStructure: RateStructure;

  /** Read-only in the policy form — the list is managed in Administration. */
  lineOfBusiness: LineOfBusiness;
  productType?: ProductType;
  typeOfInsurance?: string;
  insuranceCompany?: string;

  /** Cover currency. Marine cargo routinely runs USD, hence a field per cover. */
  currency: Currency;

  periodStart?: string;
  periodEnd?: string;
  /**
   * Limit of Liability — the maximum insured value accepted per declaration,
   * in cover currency.
   *
   * A cap on sum insured, not on premium, and it enters no calculation. A
   * declaration above it raises a warning and is still accepted; the decision
   * to write it belongs to the broker, not the form.
   */
  sumInsuredLimit?: number;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * An effective-dated rate for a master policy.
 *
 * Rates apply to SUM INSURED, never to premium. Rules are effective-dated
 * because rates change mid-term and re-opening an old declaration must
 * recalculate at the rate that applied *then*, not today's.
 *
 * The spread is never a column. It is always `clientRatePercent −
 * insurerRatePercent`, derived at the point of use.
 */
export interface RatingRule {
  id: string;
  masterPolicyId: string;

  /**
   * Optional narrowing, e.g. a commodity or voyage class. Undefined means the
   * rule is the cover's default and applies to any declaration.
   */
  scope?: string;

  /** Percent of sum insured charged to the client. */
  clientRatePercent: number;
  /**
   * Percent of sum insured the insurer books. Null on Single Rate covers,
   * where the client rate applies to both sides.
   */
  insurerRatePercent: number | null;

  /** Inclusive ISO date from which this rule applies. */
  effectiveFrom: string;
  /** Exclusive ISO date. Undefined means open-ended. */
  effectiveTo?: string;

  createdAt: string;
}

export interface Claim {
  id: string;
  dealId: string;
  title: string;
  description: string;
  status: ClaimStatus;
  /** When the claim was registered in the system (auto). */
  dateRegistered: string;
  /** When the incident was originally reported by the insured. User-provided. */
  dateReported?: string;
  /** Estimated claim amount. */
  estimatedAmount?: number;
  currency?: Currency;
  /** Snapshot of the insurance company at claim time (inherited from the policy). */
  insuranceCompany?: string;
  /** @deprecated Use dateRegistered instead. Kept for legacy data. */
  dateFiled?: string;
}

export interface Endorsement {
  id: string;
  dealId: string;
  type: string;
  description: string;
  status: 'Requested' | 'Underwriting' | 'Re-bound' | 'Declined';
  dateRequested: string;
}

export interface SOCCoverage {
  id: string;
  name: string;
  rate: string;
  rateType: 'percentage' | 'fixed';
  amount: number;
}

export interface SOCDetails {
  templateType: 'Motor Vehicle' | 'General' | 'Other';
  coverages: SOCCoverage[];
  subTotal: number;
  discountPercent: number;
  adminFee: number;
  policyFee?: number;
  deductible?: string;
  totalPremium: number;
  attentionTo?: string;
  socDate?: string;
  socNumber?: string;
}