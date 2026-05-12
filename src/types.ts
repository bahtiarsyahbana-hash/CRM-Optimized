export type DealType = 'New Business' | 'Renewal' | 'Cross Sell' | 'Upsell' | 'Existing Client Update';
export type DealStage = 'Leads' | 'Data Collection' | 'Quote' | 'Nego' | 'Bind / Closed Won' | 'Policy On Progress' | 'Lost';
export type LineOfBusiness = 'Manufacture' | 'Trading' | 'Financial Institution' | 'Property' | 'Others' | string;
export type CompanyClass = 'SME' | 'Large Enterprise';
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

export interface Client {
  id: string;
  companyName: string;
  lineOfBusiness: LineOfBusiness;
  companyAddress?: string;
  businessOccupation: string;
  assetDetail?: string;
  estimatedValueAsset?: number;
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
  /** PPh 23 tax % withheld by insurer on commission. Defaults to 2. */
  taxPercent?: number;
  /** Optional cashback paid to a sales agent. */
  agentName?: string;
  agentCashback?: number;
}

export type PaymentStatus = 'Unpaid' | 'Paid';

export interface Deal {
  id: string;
  clientId: string;
  dealType: DealType;
  typeOfInsurance: string;
  sumInsured?: number;
  sumInsuredBreakdown?: { assetName: string; amount: number }[];
  currency: string;
  premiumType: string;
  premiumAmount?: number;
  premiumRate?: string;
  socDetails?: SOCDetails;
  insuranceCompany?: string;
  statusStage: DealStage;
  riskLocation?: string;
  riskDetail?: string;
  notes?: string;
  periodStart?: string;
  periodEnd?: string;
  coverNoteNumber?: string;
  originalPolicyFile?: string;
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