export type DealType = 'New Business' | 'Renewal' | 'Cross Sell' | 'Upsell' | 'Existing Client Update';
export type DealStage = 'Leads' | 'Data Collection' | 'Quote' | 'Nego' | 'Bind / Closed Won' | 'Policy On Progress' | 'Lost';
export type LineOfBusiness = 'Manufacture' | 'Trading' | 'Financial Institution' | 'Property' | 'Others' | string;

export interface Client {
  id: string;
  companyName: string;
  lineOfBusiness: LineOfBusiness;
  companyAddress?: string;
  businessOccupation: string;
  assetDetail?: string;
  estimatedValueAsset?: number;
  picName?: string;
  picEmail?: string;
  picPhone?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

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
  status: 'Reported' | 'Assessing' | 'Approved' | 'Declined';
  dateFiled: string;
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
