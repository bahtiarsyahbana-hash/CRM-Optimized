import type { ViewId } from './lib/navigation';

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
  /**
   * Insurer name, kept as the display value and for records predating the
   * insurer catalogue. `insurerId` is the reference that matters.
   */
  insuranceCompany?: string;
  /** Reference into the insurer catalogue. Backfilled from insuranceCompany. */
  insurerId?: string;
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
  /** Insurer name, kept as the display value. `insurerId` is the reference. */
  insuranceCompany?: string;
  /** Reference into the insurer catalogue. Backfilled from insuranceCompany. */
  insurerId?: string;

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
/* -------------------------------------------------------------------------- */
/*                        Administration — Users & Roles                      */
/* -------------------------------------------------------------------------- */

/**
 * NOT SECURITY. There is no authentication and no server in this build, so
 * nothing here protects data — a determined user can edit localStorage
 * directly. This is role-based *UI convenience*: it shapes what each person
 * sees so they aren't wading through screens they never use.
 *
 * TODO(supabase): when auth lands, every permission read must be mirrored by a
 * server-side check. Until then no label, tooltip or copy anywhere should imply
 * these are access controls.
 */
export type UserRole = 'Administrator' | 'Operations' | 'Finance' | 'Viewer';
export const USER_ROLES: UserRole[] = ['Administrator', 'Operations', 'Finance', 'Viewer'];

/** Deliberately three values, not granular CRUD. */
export type PermissionLevel = 'None' | 'View' | 'Edit';
export const PERMISSION_LEVELS: PermissionLevel[] = ['None', 'View', 'Edit'];

export type PermissionModule =
  | 'dashboard'
  | 'submissions'
  | 'pipeline'
  | 'policies'
  | 'masterPolicies'
  | 'ratingRules'
  | 'commission'
  | 'invoices'
  | 'claims'
  | 'endorsements'
  | 'cancellations'
  | 'clients'
  | 'insurers'
  | 'products'
  | 'benefits'
  | 'linesOfBusiness'
  | 'users'
  | 'settings';

export interface PermissionModuleDef {
  id: PermissionModule;
  label: string;
  /**
   * The sidebar entry this module gates. A module set to None hides that entry
   * entirely. Undefined means the module is a permission gate on something
   * inside another page rather than a page of its own.
   */
  navView?: ViewId;
  description: string;
}

export const PERMISSION_MODULES: PermissionModuleDef[] = [
  { id: 'dashboard',       label: 'Dashboard',        navView: 'dashboard',        description: 'Reporting widgets and headline figures.' },
  { id: 'submissions',     label: 'Submissions',      navView: 'submission',       description: 'New business and renewal submissions.' },
  { id: 'pipeline',        label: 'Pipeline',         navView: 'pipelines',        description: 'Approved deals through to bind.' },
  { id: 'policies',        label: 'Policy Register',  navView: 'policies',         description: 'Bound policies and cover notes.' },
  { id: 'masterPolicies',  label: 'Master Policies',  navView: 'master-policies',  description: 'Open covers, certificates and their declarations.' },
  { id: 'ratingRules',     label: 'Rating Rules',                                  description: 'Rates on a master policy. Separate from the cover itself so a role can declare without changing rates.' },
  { id: 'commission',      label: 'Commission',                                    description: 'Commission figures on a deal.' },
  { id: 'invoices',        label: 'Invoices',         navView: 'invoices',         description: 'Premium billing, payment and collection.' },
  { id: 'claims',          label: 'Claims',           navView: 'claims',           description: 'Claim registration and progress.' },
  { id: 'endorsements',    label: 'Endorsements',     navView: 'aftersales',       description: 'Mid-term policy changes.' },
  { id: 'cancellations',   label: 'Cancellations',    navView: 'cancellations',    description: 'Mid-term cancellations and return premium.' },
  { id: 'clients',         label: 'Clients',          navView: 'clients',          description: 'Client records.' },
  { id: 'insurers',        label: 'Insurers',         navView: 'insurers',         description: 'Insurer panel — master data.' },
  { id: 'products',        label: 'Products',         navView: 'products',         description: 'Product catalogue — master data.' },
  { id: 'benefits',        label: 'Benefits',         navView: 'benefits',         description: 'Benefit catalogue — master data.' },
  { id: 'linesOfBusiness', label: 'Lines of Business',navView: 'lines-of-business',description: 'Client industry list — master data.' },
  { id: 'users',           label: 'Users & Roles',    navView: 'users-roles',      description: 'User accounts and the role matrix.' },
  { id: 'settings',        label: 'Settings',         navView: 'settings',         description: 'System settings.' },
];

/**
 * Default permission per role and module.
 *
 * Reading of the brief's role table:
 *   Operations  "no rate changes"  -> ratingRules View, not Edit
 *               "no master data"   -> insurers/products/benefits/LOB None
 *               "no users"         -> users None
 *   Finance     "read-only on pipeline" -> pipeline View; owns invoices and commission
 *   Viewer      "read-only everywhere"  -> View across the operational app
 *
 * Users is Administrator-only, since the table distinguishes Administrator by
 * "including user management". Viewer therefore does not see it, which is the
 * one place "read-only everywhere" is read as the operational app rather than
 * literally every screen.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Record<PermissionModule, PermissionLevel>> = {
  Administrator: {
    dashboard: 'Edit', submissions: 'Edit', pipeline: 'Edit', policies: 'Edit',
    masterPolicies: 'Edit', ratingRules: 'Edit', commission: 'Edit', invoices: 'Edit',
    claims: 'Edit', endorsements: 'Edit', cancellations: 'Edit', clients: 'Edit',
    insurers: 'Edit', products: 'Edit', benefits: 'Edit', linesOfBusiness: 'Edit',
    users: 'Edit', settings: 'Edit',
  },
  Operations: {
    dashboard: 'View', submissions: 'Edit', pipeline: 'Edit', policies: 'Edit',
    masterPolicies: 'Edit', ratingRules: 'View', commission: 'View', invoices: 'View',
    claims: 'Edit', endorsements: 'Edit', cancellations: 'Edit', clients: 'Edit',
    insurers: 'None', products: 'None', benefits: 'None', linesOfBusiness: 'None',
    users: 'None', settings: 'View',
  },
  Finance: {
    dashboard: 'View', submissions: 'View', pipeline: 'View', policies: 'View',
    masterPolicies: 'View', ratingRules: 'View', commission: 'Edit', invoices: 'Edit',
    claims: 'View', endorsements: 'View', cancellations: 'View', clients: 'View',
    insurers: 'View', products: 'View', benefits: 'View', linesOfBusiness: 'View',
    users: 'None', settings: 'View',
  },
  Viewer: {
    dashboard: 'View', submissions: 'View', pipeline: 'View', policies: 'View',
    masterPolicies: 'View', ratingRules: 'View', commission: 'View', invoices: 'View',
    claims: 'View', endorsements: 'View', cancellations: 'View', clients: 'View',
    insurers: 'View', products: 'View', benefits: 'View', linesOfBusiness: 'View',
    users: 'None', settings: 'View',
  },
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  division?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*                          Administration — Insurers                         */
/* -------------------------------------------------------------------------- */

/**
 * A contact at an insurer. There are several per insurer deliberately — a
 * broker typically deals with a marine PIC and a non-marine PIC at the same
 * company, and collapsing them to one loses the distinction that matters.
 */
export interface InsurerContact {
  id: string;
  /** Person In Charge. */
  name: string;
  email?: string;
  phone?: string;
  /** What this contact covers, e.g. "Marine", "Non-Marine", "Claims". */
  scope?: string;
}

/**
 * Document METADATA ONLY. No file contents are stored, ever.
 *
 * IRIS persists everything to localStorage, which has roughly a 5 MB quota
 * shared across the entire app. A single 2 MB PDF base64-encodes to about
 * 2.7 MB, so two documents would exhaust the quota and take clients, deals,
 * policies and declarations down with them.
 *
 * TODO(supabase): when the backend lands, add a storage bucket and put the
 * object key here. The upload control in InsurerForm is a placeholder until
 * then and says so.
 */
export interface InsurerDocument {
  id: string;
  name: string;
  /** Free text — "Slip", "Treaty", "Rate sheet", "Agency agreement"... */
  type: string;
  /** ISO date the document was received, not when the row was created. */
  uploadDate: string;
  note?: string;
}

export interface Insurer {
  id: string;
  name: string;
  /** Unique, uppercase, short reference. */
  code: string;
  email?: string;
  phone?: string;
  /**
   * Default commission for this insurer. Pre-fills a deal's base commission
   * when the insurer is selected, and stays editable per deal.
   */
  commissionRatePercent?: number;
  contacts: InsurerContact[];
  documents: InsurerDocument[];
  /**
   * Soft delete. An insurer referenced by any deal or master policy is never
   * removed — it is deactivated, disappears from pickers, and keeps its
   * history intact.
   */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Written once by the insurerId backfill so the result stays inspectable. */
export interface InsurerMigrationReport {
  ranAt: string;
  seededInsurers: number;
  dealsTotal: number;
  dealsMatched: number;
  dealsUnmatched: { id: string; insuranceCompany: string; reason: string }[];
  masterPoliciesTotal: number;
  masterPoliciesMatched: number;
  masterPoliciesUnmatched: { id: string; policyNumber: string; insuranceCompany: string; reason: string }[];
}
