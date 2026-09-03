import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  Deal,
  DealType,
  DealStage,
  PaymentStatus,
  ProductType,
  PRODUCT_TYPES,
  DealApprovalStatus,
  DealDocuments,
  SOCCoverage,
  SOCDetails,
  PolicyLine,
} from '../../types';
import { defaultCommissionRate, DEFAULT_TAX_PERCENT } from '../../utils/commissionCalc';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  Shield,
  ClipboardList,
  Percent,
  Eye,
  Upload,
  FileText,
  Send,
  Calculator,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { INSURANCE_COMPANIES } from '../../constants/insuranceCompanies';
import { cn } from '../../lib/utils';

/* -------------------------------------------------------------------------- */
/*                             Wizard step config                             */
/* -------------------------------------------------------------------------- */

type StepKey = 'client' | 'coverage' | 'premium' | 'status' | 'commission' | 'preview';

interface StepDef {
  key: StepKey;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepDef[] = [
  { key: 'client',     label: 'Client Information', hint: 'Pick the company',            icon: Building2     },
  { key: 'coverage',   label: 'Insurance Coverage', hint: 'Risk & policy details',       icon: Shield        },
  { key: 'premium',    label: 'Premium Calculation',hint: 'SOC-style coverage breakdown',icon: Calculator    },
  { key: 'status',     label: 'Status & Documents', hint: 'Stage and attachments',       icon: ClipboardList },
  { key: 'commission', label: 'Commission',         hint: 'Rates, agent, cashback',      icon: Percent       },
  { key: 'preview',    label: 'Preview & Submit',   hint: 'Review, send for approval',   icon: Eye           },
];

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const formatNumber = (value: string) => {
  const num = value.replace(/[^0-9.]/g, '');
  if (!num) return '';
  const parts = num.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const parseNum = (v: string): number | undefined =>
  v && v.trim() !== '' ? parseFloat(v.replace(/,/g, '')) : undefined;

type SOCTemplate = 'General' | 'Motor Vehicle' | 'Other';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const SOC_TEMPLATES: Record<SOCTemplate, Omit<SOCCoverage, 'id' | 'amount'>[]> = {
  General: [
    { name: 'FLEXAS (KEBAKARAN)',         rate: '0.0294',  rateType: 'percentage' },
    { name: 'FWTWD (BANJIR)',             rate: '0.05',    rateType: 'percentage' },
    { name: 'RSMDCC (HURU-HARA)',         rate: '0.00001', rateType: 'percentage' },
    { name: 'OTHERS (LAIN-LAIN)',         rate: '0.00001', rateType: 'percentage' },
    { name: 'EARTHQUAKE (GEMPA BUMI)',    rate: '0',       rateType: 'percentage' },
    { name: 'MACHINERY BREAKDOWN',        rate: '0',       rateType: 'percentage' },
    { name: 'PUBLIC LIABILITY',           rate: '0',       rateType: 'percentage' },
    { name: 'BUSINESS INTERUPTION',       rate: '0',       rateType: 'percentage' },
  ],
  'Motor Vehicle': [
    { name: 'Comprehensive',                                  rate: '1.2',     rateType: 'percentage' },
    { name: 'LOADING RATE',                                   rate: '0',       rateType: 'percentage' },
    { name: 'FWTWD',                                          rate: '0.10',    rateType: 'percentage' },
    { name: 'SRCC',                                           rate: '0.05',    rateType: 'percentage' },
    { name: 'TERRORISM SABOTAGE',                             rate: '0',       rateType: 'percentage' },
    { name: 'PERSONAL ACCIDENT DRIVER : 10,000,000',          rate: '50000',   rateType: 'fixed' },
    { name: 'PERSONAL ACCIDENT PASSENGER : 10,000,000',       rate: '40000',   rateType: 'fixed' },
    { name: 'THIRD PARTY LIABILITY : 50,000,000',             rate: '375000',  rateType: 'fixed' },
    { name: 'THEFT BY OWN DRIVER',                            rate: '0.01',    rateType: 'percentage' },
    { name: 'AUTHORIZED GARAGE',                              rate: '0.01',    rateType: 'percentage' },
  ],
  Other: [{ name: 'Main Coverage', rate: '0', rateType: 'fixed' }],
};

const buildTemplateCoverages = (t: SOCTemplate): SOCCoverage[] =>
  SOC_TEMPLATES[t].map(c => ({ ...c, id: newId(), amount: 0 }));

const calcCoverageAmount = (cov: SOCCoverage, sumInsured: number): number => {
  const rate = parseFloat(cov.rate || '0');
  if (isNaN(rate)) return 0;
  return cov.rateType === 'percentage' ? (rate / 100) * sumInsured : rate;
};

const guessTemplateFromInsuranceType = (insuranceType: string): SOCTemplate => {
  const t = insuranceType.toLowerCase();
  if (t.includes('motor') || t.includes('kendaraan') || t.includes('vehicle')) return 'Motor Vehicle';
  return 'General';
};

/* -------------------------------------------------------------------------- */
/*                                Main wizard                                 */
/* -------------------------------------------------------------------------- */

export const DealDetailForm = ({
  deal,
  onClose,
}: {
  deal?: Deal | null;
  onClose: () => void;
}) => {
  const { addDeal, updateDeal, clients } = useData();

  /* ----- Step navigation ----- */
  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx];

  /* ----- Step 1: Client ----- */
  const [clientId, setClientId] = useState(deal?.clientId || '');
  const [clientAddress, setClientAddress] = useState(deal?.clientAddress || '');

  const selectedClient = useMemo(
    () => clients.find(c => c.id === clientId) || null,
    [clientId, clients]
  );

  // Auto-fill the deal-level address when the client changes, but never overwrite
  // a value the user has already typed.
  useEffect(() => {
    if (!selectedClient) return;
    if (clientAddress.trim() === '') {
      setClientAddress(selectedClient.companyAddress || '');
    }
    // Same for PIC fields below — auto-fill from master client only if blank.
    setPicName(prev => prev || selectedClient.picName || '');
    setPicEmail(prev => prev || selectedClient.picEmail || '');
    setPicPhone(prev => prev || selectedClient.picPhone || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.id]);

  /* ----- Step 2: Coverage ----- */
  const [dealType, setDealType] = useState<DealType>(deal?.dealType || 'New Business');
  const [typeOfInsurance, setTypeOfInsurance] = useState(deal?.typeOfInsurance || '');
  const [productType, setProductType] = useState<ProductType | ''>(deal?.productType || '');
  const [sumInsured, setSumInsured] = useState<string>(
    deal?.sumInsured != null ? formatNumber(deal.sumInsured.toString()) : ''
  );
  const [currency, setCurrency] = useState(deal?.currency || 'IDR');
  const [premiumType, setPremiumType] = useState(deal?.premiumType || 'Estimated Premium');
  const [premiumAmount, setPremiumAmount] = useState<string>(
    deal?.premiumAmount != null ? formatNumber(deal.premiumAmount.toString()) : ''
  );
  const [riskLocation, setRiskLocation] = useState(deal?.riskLocation || '');
  const [riskDetail, setRiskDetail] = useState(deal?.riskDetail || '');
  const [periodStart, setPeriodStart] = useState(
    deal?.periodStart ? new Date(deal.periodStart).toISOString().split('T')[0] : ''
  );
  const [periodEnd, setPeriodEnd] = useState(
    deal?.periodEnd ? new Date(deal.periodEnd).toISOString().split('T')[0] : ''
  );
  const [picName, setPicName] = useState(deal?.picName || '');
  const [picEmail, setPicEmail] = useState(deal?.picEmail || '');
  const [picPhone, setPicPhone] = useState(deal?.picPhone || '');
  const [insuranceCompany, setInsuranceCompany] = useState(deal?.insuranceCompany || '');

  /* ----- Step 2: Multi-product support -----
   *
   *  - When the deal has 0/1 products, we work with the single-product fields
   *    above and `extraLines` stays empty.
   *  - When the user adds a second product, the single-product fields become
   *    "Product 1" and each entry in `extraLines` is Product 2+, with its own
   *    cover note number. Sum Insured / Premium Amount on the deal become
   *    the sum across all lines.
   *
   *  Cover note is the only field intentionally NOT shared — the user wants
   *  to issue a separate cover note per product.
   */
  type LineDraft = {
    id: string;
    productName: string;
    sumInsured: string;       // formatted
    premiumAmount: string;    // formatted
    coverNoteNumber: string;
  };

  const initialExtraLines: LineDraft[] = (() => {
    const stored = deal?.lines || [];
    if (stored.length <= 1) return [];
    // The first stored line populates the single-product fields; the rest
    // become "extra lines".
    return stored.slice(1).map(l => ({
      id: l.id,
      productName: l.productName,
      sumInsured: l.sumInsured != null ? formatNumber(String(l.sumInsured)) : '',
      premiumAmount: l.premiumAmount != null ? formatNumber(String(l.premiumAmount)) : '',
      coverNoteNumber: l.coverNoteNumber || '',
    }));
  })();

  const [extraLines, setExtraLines] = useState<LineDraft[]>(initialExtraLines);
  const [primaryCoverNoteNumber, setPrimaryCoverNoteNumber] = useState<string>(() => {
    const stored = deal?.lines || [];
    if (stored.length > 1) return stored[0].coverNoteNumber || '';
    return deal?.coverNoteNumber || '';
  });

  const isMultiProductMode = extraLines.length > 0;

  const addProductLine = () => {
    setExtraLines(prev => [
      ...prev,
      { id: newId(), productName: '', sumInsured: '', premiumAmount: '', coverNoteNumber: '' },
    ]);
  };
  const removeProductLine = (id: string) => {
    setExtraLines(prev => prev.filter(l => l.id !== id));
  };
  const updateProductLine = (id: string, patch: Partial<LineDraft>) => {
    setExtraLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  // Derived totals — used by the SOC step (sumInsuredNumber) and the preview.
  const allLineSumInsured = useMemo(() => {
    const primary = parseNum(sumInsured) ?? 0;
    const extras = extraLines.reduce((acc, l) => acc + (parseNum(l.sumInsured) ?? 0), 0);
    return primary + extras;
  }, [sumInsured, extraLines]);

  const allLinePremium = useMemo(() => {
    const primary = parseNum(premiumAmount) ?? 0;
    const extras = extraLines.reduce((acc, l) => acc + (parseNum(l.premiumAmount) ?? 0), 0);
    return primary + extras;
  }, [premiumAmount, extraLines]);

  /* ----- Step 3: Premium calculation (SOC-style) ----- */
  const [socTemplate, setSocTemplate] = useState<SOCTemplate>(
    (deal?.socDetails?.templateType as SOCTemplate)
      || guessTemplateFromInsuranceType(deal?.typeOfInsurance || '')
  );
  const [socCoverages, setSocCoverages] = useState<SOCCoverage[]>(
    deal?.socDetails?.coverages?.length
      ? deal.socDetails.coverages
      : buildTemplateCoverages(
          (deal?.socDetails?.templateType as SOCTemplate)
            || guessTemplateFromInsuranceType(deal?.typeOfInsurance || '')
        )
  );
  const [socDiscountPercent, setSocDiscountPercent] = useState<number>(deal?.socDetails?.discountPercent ?? 0);
  const [socAdminFee, setSocAdminFee] = useState<number>(deal?.socDetails?.adminFee ?? 67000);
  const [socPolicyFee, setSocPolicyFee] = useState<number>(deal?.socDetails?.policyFee ?? 0);
  const [socDeductible, setSocDeductible] = useState<string>(deal?.socDetails?.deductible ?? '');
  // When true, the calculator drives premiumAmount and the manual field in step 2 is locked.
  const [premiumFromSoc, setPremiumFromSoc] = useState<boolean>(!!deal?.socDetails?.totalPremium);

  // Use the multi-line total so SOC % rates apply across all products.
  const currentSumInsuredNumber = allLineSumInsured;

  const derivedSocCoverages: SOCCoverage[] = useMemo(
    () => socCoverages.map(c => ({ ...c, amount: calcCoverageAmount(c, currentSumInsuredNumber) })),
    [socCoverages, currentSumInsuredNumber]
  );

  const socSubTotal = useMemo(
    () => derivedSocCoverages.reduce((acc, c) => acc + c.amount, 0),
    [derivedSocCoverages]
  );
  const socDiscountAmount = (socSubTotal * socDiscountPercent) / 100;
  const socTotalPremium = socSubTotal - socDiscountAmount + socAdminFee + socPolicyFee;

  // When the SOC drives premium, mirror the total into the premium input.
  useEffect(() => {
    if (premiumFromSoc) {
      setPremiumAmount(formatNumber(socTotalPremium.toFixed(0)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiumFromSoc, socTotalPremium]);

  /* ----- Step 4: Status & Documents ----- */
  const [statusStage, setStatusStage] = useState<DealStage>(deal?.statusStage || 'Leads');
  const [documents, setDocuments] = useState<DealDocuments>(deal?.documents || {});

  // statusStage available options depend on dealType
  const statusStageOptions: DealStage[] = ['Renewal', 'Existing Client Update'].includes(dealType)
    ? ['Policy On Progress', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Lost']
    : ['Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress', 'Lost'];

  // Keep statusStage in sync if dealType makes the current option invalid.
  useEffect(() => {
    if (!statusStageOptions.includes(statusStage)) {
      setStatusStage(statusStageOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealType]);

  /* ----- Step 5: Commission ----- */
  const [baseRate, setBaseRate] = useState<string>(
    deal?.commission?.baseRate != null ? String(deal.commission.baseRate) : ''
  );
  const [discountPercent, setDiscountPercent] = useState<string>(
    deal?.commission?.discountPercent != null ? String(deal.commission.discountPercent) : ''
  );
  const [efCommissionPercent, setEfCommissionPercent] = useState<string>(
    deal?.commission?.efCommissionPercent != null ? String(deal.commission.efCommissionPercent) : ''
  );
  const [taxPercent, setTaxPercent] = useState<string>(
    deal?.commission?.taxPercent != null ? String(deal.commission.taxPercent) : String(DEFAULT_TAX_PERCENT)
  );
  const [agentName, setAgentName] = useState<string>(deal?.commission?.agentName || '');
  const [agentCashback, setAgentCashback] = useState<string>(
    deal?.commission?.agentCashback != null ? String(deal.commission.agentCashback) : ''
  );
  const [agentCashbackType, setAgentCashbackType] = useState<'percent' | 'fixed'>(
    deal?.commission?.agentCashbackType || 'fixed'
  );

  // Auto-suggest base commission once a Type of Insurance is chosen.
  useEffect(() => {
    if (typeOfInsurance && !baseRate) {
      setBaseRate(String(defaultCommissionRate(selectedClient || undefined, typeOfInsurance)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeOfInsurance, selectedClient?.id]);

  /* ----- Step 5: Preview / approval ----- */
  // Pre-existing invoicing fields are preserved silently — out of scope of this wizard,
  // but we keep them so editing an old deal doesn't lose data.
  const [invoiceDate] = useState<string>(
    deal?.invoiceDate ? new Date(deal.invoiceDate).toISOString().split('T')[0] : ''
  );
  const [paymentStatus] = useState<PaymentStatus>(deal?.paymentStatus || 'Unpaid');
  const [paymentDate] = useState<string>(
    deal?.paymentDate ? new Date(deal.paymentDate).toISOString().split('T')[0] : ''
  );

  /* ----- Per-step validity ----- */
  const stepErrors: Record<StepKey, string[]> = {
    client: !clientId ? ['Please select a client.'] : [],
    coverage: [
      !dealType ? 'Deal Type is required.' : null,
      !typeOfInsurance ? 'Type of Insurance is required.' : null,
      !productType ? 'Product Type is required.' : null,
      !premiumType ? 'Premium Type is required.' : null,
      !insuranceCompany ? 'Insurance Company is required.' : null,
    ].filter(Boolean) as string[],
    premium: [],
    status: !statusStage ? ['Status Stage is required.'] : [],
    commission: [
      baseRate === '' ? 'Base Commission % is required.' : null,
      discountPercent && baseRate && parseFloat(discountPercent) > parseFloat(baseRate)
        ? 'Discount % cannot exceed Base Commission %.'
        : null,
    ].filter(Boolean) as string[],
    preview: [],
  };

  const canAdvance = stepErrors[currentStep.key].length === 0;

  const goNext = () => {
    if (!canAdvance) {
      stepErrors[currentStep.key].forEach(err => toast.error(err));
      return;
    }
    setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => setStepIdx(i => Math.max(i - 1, 0));

  // Allow jumping back to any visited step, or forward only if all preceding
  // steps are valid.
  const goToStep = (target: number) => {
    if (target <= stepIdx) {
      setStepIdx(target);
      return;
    }
    for (let i = stepIdx; i < target; i++) {
      const errs = stepErrors[STEPS[i].key];
      if (errs.length > 0) {
        errs.forEach(err => toast.error(err));
        return;
      }
    }
    setStepIdx(target);
  };

  /* ----- Final submit ----- */
  const buildSocDetails = (): SOCDetails | undefined => {
    const hasMeaningfulData =
      premiumFromSoc
      || socTotalPremium > 0
      || socCoverages.some(c => parseFloat(c.rate || '0') > 0)
      || socDiscountPercent !== 0
      || socAdminFee !== 0
      || socPolicyFee !== 0
      || (socDeductible && socDeductible.trim() !== '');
    if (!hasMeaningfulData) return undefined;

    return {
      templateType: socTemplate,
      coverages: derivedSocCoverages,
      subTotal: socSubTotal,
      discountPercent: socDiscountPercent,
      adminFee: socAdminFee,
      policyFee: socPolicyFee,
      deductible: socDeductible || undefined,
      totalPremium: socTotalPremium,
      // Preserve existing meta if any (set later in SOCManagerModal when issuing the PDF).
      attentionTo: deal?.socDetails?.attentionTo,
      socDate: deal?.socDetails?.socDate,
      socNumber: deal?.socDetails?.socNumber,
    };
  };

  const buildPayload = (approval: DealApprovalStatus): Omit<Deal, 'id' | 'createdAt' | 'updatedAt'> => {
    // Build line array. Only persist `lines` when the user has chosen
    // multi-product mode; otherwise legacy top-level fields are the source
    // of truth and `lines` stays undefined for backward compat.
    const lines: PolicyLine[] | undefined = isMultiProductMode
      ? [
          {
            id: deal?.lines?.[0]?.id || `${deal?.id || 'primary'}_p0`,
            productName: typeOfInsurance,
            sumInsured: parseNum(sumInsured),
            premiumAmount: parseNum(premiumAmount),
            coverNoteNumber: primaryCoverNoteNumber || undefined,
            originalPolicyFile: deal?.lines?.[0]?.originalPolicyFile,
          },
          ...extraLines.map((l, i): PolicyLine => ({
            id: l.id,
            productName: l.productName,
            sumInsured: parseNum(l.sumInsured),
            premiumAmount: parseNum(l.premiumAmount),
            coverNoteNumber: l.coverNoteNumber || undefined,
            originalPolicyFile: deal?.lines?.[i + 1]?.originalPolicyFile,
          })),
        ]
      : undefined;

    // When in multi-product mode the rolled-up totals become the canonical
    // values for any single-field consumers (claim screens, reporting…).
    const rollupSumInsured = isMultiProductMode ? allLineSumInsured : parseNum(sumInsured);
    const rollupPremium = premiumFromSoc
      ? socTotalPremium
      : isMultiProductMode ? allLinePremium : parseNum(premiumAmount);
    const rollupTypeOfInsurance = isMultiProductMode
      ? [typeOfInsurance, ...extraLines.map(l => l.productName)].filter(Boolean).join(' + ')
      : typeOfInsurance;

    return {
    clientId,
    clientAddress: clientAddress || undefined,
    dealType,
    typeOfInsurance: rollupTypeOfInsurance,
    productType: (productType || undefined) as ProductType | undefined,
    sumInsured: rollupSumInsured,
    lines,
    currency,
    premiumType,
    premiumAmount: rollupPremium,
    coverNoteNumber: isMultiProductMode ? undefined : (primaryCoverNoteNumber || deal?.coverNoteNumber),
    socDetails: buildSocDetails(),
    insuranceCompany: insuranceCompany || undefined,
    periodStart: periodStart ? new Date(periodStart).toISOString() : undefined,
    periodEnd: periodEnd ? new Date(periodEnd).toISOString() : undefined,
    statusStage,
    riskLocation: riskLocation || undefined,
    riskDetail: riskDetail || undefined,
    picName: picName || undefined,
    picEmail: picEmail || undefined,
    picPhone: picPhone || undefined,
    documents: Object.values(documents).some(v => v && String(v).trim() !== '') ? documents : undefined,
    approvalStatus: approval,
    commission: {
      baseRate: parseNum(baseRate),
      discountPercent: parseNum(discountPercent),
      efCommissionPercent: parseNum(efCommissionPercent),
      taxPercent: parseNum(taxPercent) ?? DEFAULT_TAX_PERCENT,
      agentName: agentName || undefined,
      agentCashback: parseNum(agentCashback),
      agentCashbackType: agentCashback ? agentCashbackType : undefined,
    },
    invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
    paymentStatus: invoiceDate ? paymentStatus : undefined,
    paymentDate: paymentStatus === 'Paid' && paymentDate ? new Date(paymentDate).toISOString() : undefined,
    };
  };

  const submitForApproval = () => {
    // Re-check every step before submitting.
    for (const s of STEPS) {
      const errs = stepErrors[s.key];
      if (errs.length > 0) {
        errs.forEach(err => toast.error(`${s.label}: ${err}`));
        setStepIdx(STEPS.findIndex(x => x.key === s.key));
        return;
      }
    }
    const payload = buildPayload('Pending Approval');
    if (deal) {
      updateDeal(deal.id, payload);
      toast.success('Deal updated and submitted for approval');
    } else {
      addDeal(payload);
      toast.success('Submission created and sent for approval');
    }
    onClose();
  };

  const saveDraft = () => {
    const payload = buildPayload(deal?.approvalStatus || 'Draft');
    if (deal) {
      updateDeal(deal.id, payload);
      toast.success('Draft saved');
    } else {
      if (!clientId) {
        toast.error('Pick a client before saving a draft.');
        return;
      }
      addDeal(payload);
      toast.success('Draft created');
    }
    onClose();
  };

  /* -------------------------------------------------------------------- */
  /*                                Render                                */
  /* -------------------------------------------------------------------- */
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{deal ? 'Edit Submission' : 'New Submission'}</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Step {stepIdx + 1} of {STEPS.length} — {currentStep.label}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-white shrink-0">
          <ol className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIdx && stepErrors[s.key].length === 0;
              const active = i === stepIdx;
              const reachable = i <= stepIdx || STEPS.slice(0, i).every(p => stepErrors[p.key].length === 0);
              return (
                <li key={s.key} className="flex-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => reachable && goToStep(i)}
                    disabled={!reachable}
                    className={cn(
                      'flex items-center gap-2 group',
                      reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <span
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center border text-[12px] font-bold shrink-0 transition-colors',
                        active && 'bg-blue-600 text-white border-blue-600',
                        done && !active && 'bg-emerald-500 text-white border-emerald-500',
                        !done && !active && 'bg-white text-slate-500 border-slate-300 group-hover:border-slate-400'
                      )}
                    >
                      {done && !active ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </span>
                    <span className="hidden md:flex flex-col text-left">
                      <span
                        className={cn(
                          'text-[12px] font-semibold',
                          active ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-500'
                        )}
                      >
                        {s.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{s.hint}</span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn('flex-1 h-px mx-3', i < stepIdx ? 'bg-emerald-300' : 'bg-slate-200')} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {currentStep.key === 'client' && (
            <StepClient
              clients={clients}
              clientId={clientId}
              setClientId={setClientId}
              clientAddress={clientAddress}
              setClientAddress={setClientAddress}
              selectedClient={selectedClient}
            />
          )}
          {currentStep.key === 'coverage' && (
            <StepCoverage
              {...{
                dealType, setDealType,
                typeOfInsurance, setTypeOfInsurance,
                productType, setProductType,
                sumInsured, setSumInsured,
                currency, setCurrency,
                premiumType, setPremiumType,
                premiumAmount, setPremiumAmount,
                premiumLocked: premiumFromSoc,
                riskLocation, setRiskLocation,
                riskDetail, setRiskDetail,
                periodStart, setPeriodStart,
                periodEnd, setPeriodEnd,
                picName, setPicName,
                picEmail, setPicEmail,
                picPhone, setPicPhone,
                insuranceCompany, setInsuranceCompany,
                extraLines, addProductLine, removeProductLine, updateProductLine,
                primaryCoverNoteNumber, setPrimaryCoverNoteNumber,
                allLineSumInsured, allLinePremium,
              }}
            />
          )}
          {currentStep.key === 'premium' && (
            <StepPremium
              currency={currency}
              sumInsuredNumber={currentSumInsuredNumber}
              template={socTemplate}
              setTemplate={(t) => {
                setSocTemplate(t);
                setSocCoverages(buildTemplateCoverages(t));
              }}
              coverages={derivedSocCoverages}
              setCoverages={setSocCoverages}
              discountPercent={socDiscountPercent}
              setDiscountPercent={setSocDiscountPercent}
              adminFee={socAdminFee}
              setAdminFee={setSocAdminFee}
              policyFee={socPolicyFee}
              setPolicyFee={setSocPolicyFee}
              deductible={socDeductible}
              setDeductible={setSocDeductible}
              subTotal={socSubTotal}
              discountAmount={socDiscountAmount}
              totalPremium={socTotalPremium}
              premiumFromSoc={premiumFromSoc}
              setPremiumFromSoc={setPremiumFromSoc}
            />
          )}
          {currentStep.key === 'status' && (
            <StepStatus
              statusStage={statusStage}
              setStatusStage={setStatusStage}
              statusStageOptions={statusStageOptions}
              documents={documents}
              setDocuments={setDocuments}
            />
          )}
          {currentStep.key === 'commission' && (
            <StepCommission
              {...{
                baseRate, setBaseRate,
                discountPercent, setDiscountPercent,
                efCommissionPercent, setEfCommissionPercent,
                taxPercent, setTaxPercent,
                agentName, setAgentName,
                agentCashback, setAgentCashback,
                agentCashbackType, setAgentCashbackType,
                currency,
              }}
            />
          )}
          {currentStep.key === 'preview' && (
            <StepPreview
              client={selectedClient}
              data={{
                clientAddress, dealType, typeOfInsurance, productType, sumInsured,
                currency, premiumType, premiumAmount, riskLocation, riskDetail, periodStart, periodEnd,
                picName, picEmail, picPhone, insuranceCompany, statusStage, documents,
                baseRate, discountPercent, efCommissionPercent, taxPercent,
                agentName, agentCashback, agentCashbackType,
                socTemplate,
                socCoverages: derivedSocCoverages,
                socDiscountPercent,
                socAdminFee,
                socPolicyFee,
                socDeductible,
                socSubTotal,
                socTotalPremium,
                premiumFromSoc,
                primaryCoverNoteNumber,
                extraLines,
                allLineSumInsured,
                allLinePremium,
              }}
            />
          )}
        </div>

        {/* Footer / nav */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 rounded-b-lg">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
            >
              Save Draft
            </button>
          </div>

          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}

            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className={cn(
                  'px-5 py-2 text-[13px] font-semibold text-white rounded-md transition-colors flex items-center gap-1.5 shadow-sm',
                  canAdvance ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'
                )}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submitForApproval}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-4 h-4" /> Submit for Approval
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Shared field UI                               */
/* -------------------------------------------------------------------------- */

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children, className }) => (
  <div className={className}>
    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]';

/* -------------------------------------------------------------------------- */
/*                              Step 1: Client                                */
/* -------------------------------------------------------------------------- */

const StepClient: React.FC<{
  clients: ReturnType<typeof useData>['clients'];
  clientId: string;
  setClientId: (v: string) => void;
  clientAddress: string;
  setClientAddress: (v: string) => void;
  selectedClient: ReturnType<typeof useData>['clients'][number] | null;
}> = ({ clients, clientId, setClientId, clientAddress, setClientAddress, selectedClient }) => (
  <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-3xl mx-auto space-y-5">
    <SectionTitle index={1} color="blue" label="Client Information" subtitle="Select an existing client and confirm their address." />

    <Field label="Client / Company" required>
      {clients.length === 0 ? (
        <div className="text-[13px] text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
          No clients found. Please create a Client Profile first in the Clients view.
        </div>
      ) : (
        <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
          <option value="">Select a Client</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
      )}
    </Field>

    {selectedClient && (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
        <div className="font-semibold text-slate-800 mb-0.5">{selectedClient.companyName}</div>
        <div>Line of Business: {selectedClient.lineOfBusiness}</div>
        {selectedClient.parentGroup && <div>Parent Group: {selectedClient.parentGroup}</div>}
        {selectedClient.sourceClient && <div>Source: {selectedClient.sourceClient}</div>}
      </div>
    )}

    <Field
      label="Client Address"
      hint="Auto-filled from the client record. You can edit it freely for this deal."
    >
      <textarea
        rows={3}
        value={clientAddress}
        onChange={e => setClientAddress(e.target.value)}
        className={cn(inputClass, 'resize-none')}
        placeholder="Full correspondence address..."
      />
    </Field>
  </div>
);

/* -------------------------------------------------------------------------- */
/*                            Step 2: Coverage                                */
/* -------------------------------------------------------------------------- */

interface StepCoverageProps {
  dealType: DealType;                                 setDealType: (v: DealType) => void;
  typeOfInsurance: string;                            setTypeOfInsurance: (v: string) => void;
  productType: ProductType | '';                      setProductType: (v: ProductType | '') => void;
  sumInsured: string;                                 setSumInsured: (v: string) => void;
  currency: string;                                   setCurrency: (v: string) => void;
  premiumType: string;                                setPremiumType: (v: string) => void;
  premiumAmount: string;                              setPremiumAmount: (v: string) => void;
  /** When true, the premium amount field is locked because the SOC calculator drives it. */
  premiumLocked?: boolean;
  riskLocation: string;                               setRiskLocation: (v: string) => void;
  riskDetail: string;                                 setRiskDetail: (v: string) => void;
  periodStart: string;                                setPeriodStart: (v: string) => void;
  periodEnd: string;                                  setPeriodEnd: (v: string) => void;
  picName: string;                                    setPicName: (v: string) => void;
  picEmail: string;                                   setPicEmail: (v: string) => void;
  picPhone: string;                                   setPicPhone: (v: string) => void;
  insuranceCompany: string;                           setInsuranceCompany: (v: string) => void;
  /** Multi-product (extra) lines beyond the primary product. */
  extraLines: {
    id: string;
    productName: string;
    sumInsured: string;
    premiumAmount: string;
    coverNoteNumber: string;
  }[];
  addProductLine: () => void;
  removeProductLine: (id: string) => void;
  updateProductLine: (id: string, patch: Partial<{
    productName: string; sumInsured: string; premiumAmount: string; coverNoteNumber: string;
  }>) => void;
  primaryCoverNoteNumber: string;
  setPrimaryCoverNoteNumber: (v: string) => void;
  allLineSumInsured: number;
  allLinePremium: number;
}

const StepCoverage: React.FC<StepCoverageProps> = (p) => {
  const insuranceTypeOptions = [
    'Property All Risk', 'Industrial All Risk', 'Fire Insurance', 'Earthquake Insurance',
    'Marine Cargo', 'Marine Hull', 'Motor Vehicle', 'Heavy Equipment', 'Liability Insurance',
    'Directors & Officers Liability', 'Professional Indemnity', 'Money Insurance',
    'Fidelity Guarantee', 'Personal Accident', 'Group Term Life', 'Health Insurance',
    'Travel Insurance', 'Cyber Insurance', 'Credit Insurance', 'Surety Bond', 'Other',
  ];
  const currencyOptions = ['IDR', 'USD', 'CNY', 'MYR', 'JPY', 'EUR'];

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-4xl mx-auto space-y-6">
      <SectionTitle index={2} color="emerald" label="Insurance Coverage" subtitle="Define what's covered, for how much, and when." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Deal Type" required>
          <div className="flex rounded-md overflow-hidden border border-slate-200">
            {(['New Business', 'Renewal'] as DealType[]).map((opt, idx) => (
              <button
                key={opt}
                type="button"
                onClick={() => p.setDealType(opt)}
                className={cn(
                  'flex-1 px-3 py-2 text-[13px] font-semibold transition-colors',
                  idx > 0 && 'border-l border-slate-200',
                  p.dealType === opt ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Type of Insurance" required>
          <select value={p.typeOfInsurance} onChange={e => p.setTypeOfInsurance(e.target.value)} className={inputClass}>
            <option value="">Select Insurance Type</option>
            {insuranceTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field label="Product Type" required>
          <select value={p.productType} onChange={e => p.setProductType(e.target.value as ProductType | '')} className={inputClass}>
            <option value="">Select Product Type</option>
            {PRODUCT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field label="Currency" required>
          <select value={p.currency} onChange={e => p.setCurrency(e.target.value)} className={inputClass}>
            {currencyOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field label={`Sum Insured (${p.currency})`}>
          <input
            type="text" value={p.sumInsured}
            onChange={e => p.setSumInsured(formatNumber(e.target.value))}
            className={inputClass} placeholder="1,000,000"
          />
        </Field>

        <Field
          label={`Premium Amount (${p.currency})`}
          hint={p.premiumLocked ? 'Driven by the SOC calculator in step 3 — edit there to change.' : undefined}
        >
          <input
            type="text" value={p.premiumAmount}
            onChange={e => p.setPremiumAmount(formatNumber(e.target.value))}
            disabled={p.premiumLocked}
            className={cn(inputClass, p.premiumLocked && 'bg-slate-50 text-slate-500 cursor-not-allowed')}
            placeholder="0"
          />
        </Field>

        <Field label="Premium Type" required>
          <select value={p.premiumType} onChange={e => p.setPremiumType(e.target.value)} className={inputClass}>
            <option value="Estimated Premium">Estimated Premium</option>
            <option value="Fixed Premium">Fixed Premium</option>
          </select>
        </Field>

        <Field label="Insurance Company" required>
          <select value={p.insuranceCompany} onChange={e => p.setInsuranceCompany(e.target.value)} className={inputClass}>
            <option value="">Select Insurance Company</option>
            {INSURANCE_COMPANIES.map(co => <option key={co} value={co}>{co}</option>)}
            <option value="Other">Other</option>
          </select>
        </Field>

        <Field label="Risk Location" hint="Optional — where the insured risk is located." className="md:col-span-2">
          <textarea
            value={p.riskLocation} onChange={e => p.setRiskLocation(e.target.value)} rows={2}
            className={cn(inputClass, 'resize-none')} placeholder="e.g. Jl. Industri No. 5, Cikarang, Bekasi"
          />
        </Field>

        <Field label="Risk Detail" hint="Optional — underwriting notes, exposure description, asset specifics, etc." className="md:col-span-2">
          <textarea
            value={p.riskDetail} onChange={e => p.setRiskDetail(e.target.value)} rows={3}
            className={cn(inputClass, 'resize-none')} placeholder="Underwriting notes, exposure notes, asset details..."
          />
        </Field>

        <Field label="Period Start">
          <input type="date" value={p.periodStart} onChange={e => p.setPeriodStart(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Period End">
          <input type="date" value={p.periodEnd} onChange={e => p.setPeriodEnd(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {/* ---------- Additional products (multi-product mode) ---------- */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-[13px] font-semibold text-slate-800">Additional Products</h4>
            <p className="text-[11px] text-slate-500">
              Add other coverages on the same placement — e.g. Property All Risk + Earthquake + MB + PL.
              Each product can carry its own cover note number; everything else (period, insurer, PIC,
              invoice, approval) stays shared.
            </p>
          </div>
          <button
            type="button"
            onClick={p.addProductLine}
            className="shrink-0 text-[12px] font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-2.5 py-1 rounded flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add another product
          </button>
        </div>

        {(p.extraLines.length > 0) && (
          <div className="space-y-3 mt-3">
            {/* Primary product card with cover note */}
            <div className="border border-blue-200 bg-blue-50/40 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-bold text-blue-700 uppercase tracking-wider">Product 1 (Primary)</div>
                <div className="text-[11px] text-slate-500">{p.typeOfInsurance || 'No product selected'}</div>
              </div>
              <Field label="Cover Note Number" hint="Per-product. Leave blank to assign later.">
                <input
                  type="text"
                  value={p.primaryCoverNoteNumber}
                  onChange={e => p.setPrimaryCoverNoteNumber(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. CN/2026/001"
                />
              </Field>
              <div className="mt-1 text-[11px] text-slate-500">
                Type, Sum Insured and Premium Amount for the primary product come from the fields above.
              </div>
            </div>

            {/* Extra lines */}
            {p.extraLines.map((line, idx) => (
              <div key={line.id} className="border border-slate-200 bg-white rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">
                    Product {idx + 2}
                  </div>
                  <button
                    type="button"
                    onClick={() => p.removeProductLine(line.id)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Remove product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Type of Insurance">
                    <select
                      value={line.productName}
                      onChange={e => p.updateProductLine(line.id, { productName: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select Insurance Type</option>
                      {insuranceTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Cover Note Number" hint="Per-product. Leave blank to assign later.">
                    <input
                      type="text"
                      value={line.coverNoteNumber}
                      onChange={e => p.updateProductLine(line.id, { coverNoteNumber: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. CN/2026/002"
                    />
                  </Field>
                  <Field label={`Sum Insured (${p.currency})`}>
                    <input
                      type="text"
                      value={line.sumInsured}
                      onChange={e => p.updateProductLine(line.id, { sumInsured: formatNumber(e.target.value) })}
                      className={inputClass}
                      placeholder="0"
                    />
                  </Field>
                  <Field label={`Premium Amount (${p.currency})`}>
                    <input
                      type="text"
                      value={line.premiumAmount}
                      onChange={e => p.updateProductLine(line.id, { premiumAmount: formatNumber(e.target.value) })}
                      className={inputClass}
                      placeholder="0"
                    />
                  </Field>
                </div>
              </div>
            ))}

            {/* Rollup totals */}
            <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 flex flex-wrap gap-4 text-[12px]">
              <div>
                <div className="text-emerald-700 font-semibold uppercase tracking-wider text-[10px]">Total Sum Insured</div>
                <div className="font-mono font-bold text-slate-900">{p.currency} {p.allLineSumInsured.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-emerald-700 font-semibold uppercase tracking-wider text-[10px]">Total Premium</div>
                <div className="font-mono font-bold text-slate-900">{p.currency} {p.allLinePremium.toLocaleString()}</div>
              </div>
              <div className="ml-auto text-[11px] text-slate-500 self-end">
                {p.extraLines.length + 1} products on this deal
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-[13px] font-semibold text-slate-800 mb-3">Person in Charge (PIC)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="PIC Name">
            <input type="text" value={p.picName} onChange={e => p.setPicName(e.target.value)} className={inputClass} placeholder="Full name" />
          </Field>
          <Field label="PIC Email">
            <input type="email" value={p.picEmail} onChange={e => p.setPicEmail(e.target.value)} className={inputClass} placeholder="pic@example.com" />
          </Field>
          <Field label="PIC Phone">
            <input type="tel" value={p.picPhone} onChange={e => p.setPicPhone(e.target.value)} className={inputClass} placeholder="+62..." />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Auto-filled from the master client PIC — you can override here for this deal.</p>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                      Step 3: Premium Calculation (SOC)                     */
/* -------------------------------------------------------------------------- */

interface StepPremiumProps {
  currency: string;
  sumInsuredNumber: number;
  template: SOCTemplate;
  setTemplate: (t: SOCTemplate) => void;
  coverages: SOCCoverage[]; // already derived (amount computed)
  setCoverages: React.Dispatch<React.SetStateAction<SOCCoverage[]>>;
  discountPercent: number;
  setDiscountPercent: (v: number) => void;
  adminFee: number;
  setAdminFee: (v: number) => void;
  policyFee: number;
  setPolicyFee: (v: number) => void;
  deductible: string;
  setDeductible: (v: string) => void;
  subTotal: number;
  discountAmount: number;
  totalPremium: number;
  premiumFromSoc: boolean;
  setPremiumFromSoc: (v: boolean) => void;
}

const fmtAmount = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StepPremium: React.FC<StepPremiumProps> = (p) => {
  const update = (id: string, field: keyof SOCCoverage, value: any) => {
    p.setCoverages(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const remove = (id: string) => p.setCoverages(prev => prev.filter(c => c.id !== id));
  const addRow = () => p.setCoverages(prev => [
    ...prev,
    { id: newId(), name: '', rate: '0', rateType: 'percentage', amount: 0 },
  ]);

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-5xl mx-auto space-y-5">
      <SectionTitle
        index={3}
        color="purple"
        label="Premium Calculation"
        subtitle="Build the premium with the same SOC coverage structure used on the final document."
      />

      {p.sumInsuredNumber === 0 && (
        <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Sum Insured is 0 — percentage-rated coverages will calculate to 0. Set Sum Insured in step 2 first.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="SOC Template" className="md:col-span-1">
          <select
            value={p.template}
            onChange={e => p.setTemplate(e.target.value as SOCTemplate)}
            className={inputClass}
          >
            <option value="General">General Insurance</option>
            <option value="Motor Vehicle">Motor Vehicle</option>
            <option value="Other">Other / Custom</option>
          </select>
        </Field>
        <Field label="Deductible" className="md:col-span-2">
          <input
            type="text"
            value={p.deductible}
            onChange={e => p.setDeductible(e.target.value)}
            className={inputClass}
            placeholder="e.g. As per policy"
          />
        </Field>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden text-[13px]">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-3 py-2 font-semibold w-10 text-center">NO.</th>
              <th className="px-3 py-2 font-semibold">COVERAGE</th>
              <th className="px-3 py-2 font-semibold w-56">RATE</th>
              <th className="px-3 py-2 font-semibold text-right w-40">AMOUNT ({p.currency})</th>
              <th className="px-2 py-2 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {p.coverages.map((cov, i) => (
              <tr key={cov.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-center text-slate-500">{i + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={cov.name}
                    onChange={e => update(cov.id, 'name', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-[12px] font-medium text-slate-800 uppercase"
                    placeholder="Coverage Name"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={cov.rate}
                      onChange={e => update(cov.id, 'rate', e.target.value)}
                      className="w-20 px-1 py-1 bg-white border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 text-right font-mono"
                    />
                    <select
                      value={cov.rateType}
                      onChange={e => update(cov.id, 'rateType', e.target.value as 'percentage' | 'fixed')}
                      className="bg-transparent border-none text-[11px] text-slate-500 focus:ring-0 cursor-pointer p-0"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium text-slate-800 text-[12px]">
                  {fmtAmount(cov.amount)}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => remove(cov.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="px-4 py-2.5 bg-slate-50">
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" /> Add Coverage
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="bg-slate-100/50 p-5 border-t border-slate-200 grid grid-cols-2 gap-4">
          <div className="space-y-3 col-start-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-600 font-medium">Sub Total:</span>
              <span className="font-mono text-slate-800">{fmtAmount(p.subTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600 text-[13px]">
              <span className="font-medium">Discount (%):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={p.discountPercent}
                  onChange={e => p.setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] text-right focus:outline-none focus:border-blue-500"
                />
                <span className="font-mono">-{fmtAmount(p.discountAmount)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-slate-600 text-[13px]">
              <span className="font-medium">Admin Cost:</span>
              <input
                type="number"
                value={p.adminFee}
                onChange={e => p.setAdminFee(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] text-right font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-between text-slate-600 text-[13px]">
              <span className="font-medium">Policy Fee:</span>
              <input
                type="number"
                value={p.policyFee}
                onChange={e => p.setPolicyFee(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] text-right font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="pt-3 border-t border-slate-300 flex items-center justify-between mt-2">
              <span className="text-[14px] font-bold text-slate-900">Total Premium:</span>
              <span className="text-[15px] font-bold font-mono text-slate-900">
                {p.currency} {fmtAmount(p.totalPremium)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <label className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors',
        p.premiumFromSoc
          ? 'bg-blue-50 border-blue-200'
          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
      )}>
        <input
          type="checkbox"
          className="mt-0.5"
          checked={p.premiumFromSoc}
          onChange={e => p.setPremiumFromSoc(e.target.checked)}
        />
        <div>
          <div className="text-[13px] font-semibold text-slate-800">
            Use this total as the deal's Premium Amount
          </div>
          <div className="text-[12px] text-slate-500">
            When on, the Premium Amount in step 2 is locked and follows this total automatically.
            Turn off if you'd rather enter premium manually and treat the SOC as reference only.
          </div>
        </div>
      </label>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                       Step 4: Status & Documents                           */
/* -------------------------------------------------------------------------- */

const DOC_FIELDS: { key: keyof DealDocuments; label: string; hint?: string }[] = [
  { key: 'termsCondition',      label: 'Terms & Condition' },
  { key: 'personalInformation', label: 'Personal Information', hint: 'KTP / NPWP' },
  { key: 'surveyReport',        label: 'Survey Report' },
  { key: 'existingPolicy',      label: 'Existing Policy' },
  { key: 'otherDocument',       label: 'Other Document' },
];

const StepStatus: React.FC<{
  statusStage: DealStage;
  setStatusStage: (v: DealStage) => void;
  statusStageOptions: DealStage[];
  documents: DealDocuments;
  setDocuments: (v: DealDocuments) => void;
}> = ({ statusStage, setStatusStage, statusStageOptions, documents, setDocuments }) => {
  const pickFile = (field: keyof DealDocuments) => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.onchange = (e: any) => {
      const f = e.target.files?.[0];
      if (f) setDocuments({ ...documents, [field]: f.name });
    };
    picker.click();
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-3xl mx-auto space-y-6">
      <SectionTitle index={4} color="rose" label="Status & Documents" subtitle="Set the pipeline stage and attach any supporting docs (all optional)." />

      <Field label="Status Stage" required>
        <select value={statusStage} onChange={e => setStatusStage(e.target.value as DealStage)} className={inputClass}>
          {statusStageOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>

      <div>
        <div className="text-[13px] font-semibold text-slate-800 mb-2">Document Uploads</div>
        <p className="text-[11px] text-slate-500 mb-3">Every document is optional — you can skip this step entirely.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOC_FIELDS.map(({ key, label, hint }) => {
            const value = documents[key];
            return (
              <div key={key} className="border border-slate-200 rounded-md px-3 py-2.5 bg-slate-50 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-700">{label}</div>
                  {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
                  {value && (
                    <div className="text-[11px] text-blue-700 font-medium truncate mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3 shrink-0" /> {value}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {value && (
                    <button
                      type="button"
                      onClick={() => setDocuments({ ...documents, [key]: undefined })}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => pickFile(key)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" /> {value ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Field label="Additional Info" hint="Free-text notes that travel with the deal.">
        <textarea
          rows={3}
          value={documents.additionalInfo || ''}
          onChange={e => setDocuments({ ...documents, additionalInfo: e.target.value })}
          className={cn(inputClass, 'resize-none')}
          placeholder="Anything else underwriting / approvers should know..."
        />
      </Field>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                           Step 4: Commission                               */
/* -------------------------------------------------------------------------- */

const StepCommission: React.FC<{
  baseRate: string;            setBaseRate: (v: string) => void;
  discountPercent: string;     setDiscountPercent: (v: string) => void;
  efCommissionPercent: string; setEfCommissionPercent: (v: string) => void;
  taxPercent: string;          setTaxPercent: (v: string) => void;
  agentName: string;           setAgentName: (v: string) => void;
  agentCashback: string;       setAgentCashback: (v: string) => void;
  agentCashbackType: 'percent' | 'fixed'; setAgentCashbackType: (v: 'percent' | 'fixed') => void;
  currency: string;
}> = (p) => (
  <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-4xl mx-auto space-y-6">
    <SectionTitle index={5} color="amber" label="Commission" subtitle="Set commission, agent and cashback details." />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Base Commission %" required>
        <input type="number" min="0" max="100" step="0.01" value={p.baseRate} onChange={e => p.setBaseRate(e.target.value)} className={inputClass} placeholder="e.g. 15" />
      </Field>

      <Field
        label="Discount to Client %"
        hint={p.baseRate ? `Cannot exceed ${p.baseRate}%.` : undefined}
      >
        <input
          type="number" min="0" max={p.baseRate || undefined} step="0.01"
          value={p.discountPercent} onChange={e => p.setDiscountPercent(e.target.value)}
          className={inputClass} placeholder="0"
        />
      </Field>

      <Field label="EF Commission %" hint="Behind-the-table commission paid by insurer.">
        <input type="number" min="0" max="100" step="0.01" value={p.efCommissionPercent} onChange={e => p.setEfCommissionPercent(e.target.value)} className={inputClass} placeholder="0" />
      </Field>

      <Field label="PPh 23 Tax %" hint={`Defaults to ${DEFAULT_TAX_PERCENT}.`}>
        <input type="number" min="0" max="100" step="0.01" value={p.taxPercent} onChange={e => p.setTaxPercent(e.target.value)} className={inputClass} placeholder={`${DEFAULT_TAX_PERCENT}`} />
      </Field>
    </div>

    <div className="pt-4 border-t border-slate-100">
      <h4 className="text-[13px] font-semibold text-slate-800 mb-3">Sales Agent &amp; Cashback (Optional)</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Sales Agent Name">
          <input type="text" value={p.agentName} onChange={e => p.setAgentName(e.target.value)} className={inputClass} placeholder="Agent name" />
        </Field>

        <Field
          label={p.agentCashbackType === 'percent' ? 'Cashback %' : `Cashback Amount (${p.currency})`}
          hint="Cashback paid to the sales agent."
        >
          <div className="flex gap-2">
            <div className="flex rounded-md overflow-hidden border border-slate-200 shrink-0">
              {(['percent', 'fixed'] as const).map((t, idx) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => p.setAgentCashbackType(t)}
                  className={cn(
                    'px-3 py-2 text-[12px] font-semibold transition-colors',
                    idx > 0 && 'border-l border-slate-200',
                    p.agentCashbackType === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  title={t === 'percent' ? 'Percent of premium' : 'Fixed amount'}
                >
                  {t === 'percent' ? '%' : p.currency}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={p.agentCashbackType === 'fixed' ? formatNumber(p.agentCashback) : p.agentCashback}
              onChange={e => {
                const v = e.target.value;
                p.setAgentCashback(p.agentCashbackType === 'fixed' ? formatNumber(v) : v.replace(/[^\d.]/g, ''));
              }}
              className={inputClass}
              placeholder="0"
            />
          </div>
        </Field>
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/*                            Step 5: Preview                                 */
/* -------------------------------------------------------------------------- */

interface PreviewData {
  clientAddress: string;
  dealType: DealType;
  typeOfInsurance: string;
  productType: ProductType | '';
  sumInsured: string;
  currency: string;
  premiumType: string;
  premiumAmount: string;
  riskLocation: string;
  riskDetail: string;
  periodStart: string;
  periodEnd: string;
  picName: string;
  picEmail: string;
  picPhone: string;
  insuranceCompany: string;
  statusStage: DealStage;
  documents: DealDocuments;
  baseRate: string;
  discountPercent: string;
  efCommissionPercent: string;
  taxPercent: string;
  agentName: string;
  agentCashback: string;
  agentCashbackType: 'percent' | 'fixed';
  socTemplate: SOCTemplate;
  socCoverages: SOCCoverage[];
  socDiscountPercent: number;
  socAdminFee: number;
  socPolicyFee: number;
  socDeductible: string;
  socSubTotal: number;
  socTotalPremium: number;
  premiumFromSoc: boolean;
  primaryCoverNoteNumber: string;
  extraLines: {
    id: string;
    productName: string;
    sumInsured: string;
    premiumAmount: string;
    coverNoteNumber: string;
  }[];
  allLineSumInsured: number;
  allLinePremium: number;
}

const StepPreview: React.FC<{
  client: ReturnType<typeof useData>['clients'][number] | null;
  data: PreviewData;
}> = ({ client, data }) => {
  const docsFilled = Object.entries(data.documents).filter(([, v]) => v && String(v).trim() !== '');
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <SectionTitle index={6} color="slate" label="Preview & Submit" subtitle="Final review. Submitting will send this deal for approval." />

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 flex gap-2">
        <Send className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Approval required.</strong> Once you submit, the deal status will move to
          <span className="font-semibold"> Pending Approval</span> until a manager reviews it.
        </div>
      </div>

      <PreviewBlock title="Client Information">
        <PreviewRow label="Client" value={client?.companyName || '—'} />
        <PreviewRow label="Address" value={data.clientAddress || '—'} multiline />
      </PreviewBlock>

      <PreviewBlock title="Insurance Coverage">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <PreviewRow label="Deal Type" value={data.dealType} />
          <PreviewRow label="Type of Insurance" value={data.typeOfInsurance} />
          <PreviewRow label="Product Type" value={data.productType || '—'} />
          <PreviewRow label="Insurance Company" value={data.insuranceCompany || '—'} />
          <PreviewRow label="Sum Insured" value={data.sumInsured ? `${data.currency} ${data.sumInsured}` : '—'} />
          <PreviewRow label="Premium" value={data.premiumAmount ? `${data.currency} ${data.premiumAmount} (${data.premiumType})` : '—'} />
          <PreviewRow label="Period" value={data.periodStart && data.periodEnd ? `${data.periodStart} → ${data.periodEnd}` : '—'} />
          <PreviewRow label="Risk Location" value={data.riskLocation || '—'} multiline />
          <PreviewRow label="Risk Detail" value={data.riskDetail || '—'} multiline />
        </div>
        {data.extraLines.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
              Products on this deal ({data.extraLines.length + 1})
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">Product</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Sum Insured</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Premium</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Cover Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-blue-50/30">
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{data.typeOfInsurance || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                      {data.sumInsured ? `${data.currency} ${data.sumInsured}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                      {data.premiumAmount ? `${data.currency} ${data.premiumAmount}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{data.primaryCoverNoteNumber || <span className="italic text-slate-400">unassigned</span>}</td>
                  </tr>
                  {data.extraLines.map(l => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5 text-slate-800">{l.productName || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                        {l.sumInsured ? `${data.currency} ${l.sumInsured}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                        {l.premiumAmount ? `${data.currency} ${l.premiumAmount}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">{l.coverNoteNumber || <span className="italic text-slate-400">unassigned</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 font-semibold text-slate-900">
                    <td className="px-3 py-1.5">Total</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {data.currency} {data.allLineSumInsured.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {data.currency} {data.allLinePremium.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">PIC</div>
          <div className="text-[13px] text-slate-700">
            {data.picName || '—'} {data.picEmail && <span className="text-slate-400">• {data.picEmail}</span>}
            {data.picPhone && <span className="text-slate-400"> • {data.picPhone}</span>}
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Premium Calculation (SOC)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Stat label="Template" value={data.socTemplate} />
          <Stat label="Sub Total" value={`${data.currency} ${fmtAmount(data.socSubTotal)}`} />
          <Stat label="Discount" value={`${data.socDiscountPercent || 0}%`} />
          <Stat label="Total Premium" value={`${data.currency} ${fmtAmount(data.socTotalPremium)}`} />
        </div>
        {data.socCoverages.length > 0 && data.socTotalPremium > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Coverage</th>
                  <th className="px-3 py-1.5 text-right font-semibold w-24">Rate</th>
                  <th className="px-3 py-1.5 text-right font-semibold w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.socCoverages
                  .filter(c => c.amount > 0 || c.name.trim() !== '')
                  .map(c => (
                    <tr key={c.id}>
                      <td className="px-3 py-1.5 text-slate-700">{c.name || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                        {c.rate}{c.rateType === 'percentage' ? '%' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-800">{fmtAmount(c.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12px] text-slate-400 italic">No SOC coverages entered.</p>
        )}
        <div className="mt-2 text-[11px] text-slate-500">
          {data.premiumFromSoc
            ? 'This total drives the deal\'s Premium Amount.'
            : 'SOC stored as reference only — Premium Amount was entered manually.'}
          {data.socDeductible && <> · Deductible: <span className="text-slate-700">{data.socDeductible}</span></>}
        </div>
      </PreviewBlock>

      <PreviewBlock title="Status & Documents">
        <PreviewRow label="Status Stage" value={data.statusStage} />
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-2 mb-1.5">Documents</div>
        {docsFilled.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic">No documents attached.</p>
        ) : (
          <ul className="space-y-1">
            {docsFilled.map(([k, v]) => (
              <li key={k} className="text-[12px] text-slate-700 flex items-center gap-2">
                <FileText className="w-3 h-3 text-slate-400" /> <span className="font-semibold">{DOC_LABEL[k as keyof DealDocuments] || k}:</span> {String(v)}
              </li>
            ))}
          </ul>
        )}
      </PreviewBlock>

      <PreviewBlock title="Commission">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Base" value={`${data.baseRate || 0}%`} />
          <Stat label="Discount" value={`${data.discountPercent || 0}%`} />
          <Stat label="EF" value={`${data.efCommissionPercent || 0}%`} />
          <Stat label="Tax (PPh 23)" value={`${data.taxPercent || DEFAULT_TAX_PERCENT}%`} />
        </div>
        {(data.agentName || data.agentCashback) && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-[13px] text-slate-700">
            <span className="font-semibold">{data.agentName || 'Agent'}</span>
            {data.agentCashback && (
              <span className="text-slate-500 ml-2">
                Cashback: {data.agentCashbackType === 'percent'
                  ? `${data.agentCashback}%`
                  : `${data.currency} ${data.agentCashback}`}
              </span>
            )}
          </div>
        )}
      </PreviewBlock>
    </div>
  );
};

const DOC_LABEL: Record<keyof DealDocuments, string> = {
  termsCondition: 'Terms & Condition',
  personalInformation: 'Personal Information',
  surveyReport: 'Survey Report',
  existingPolicy: 'Existing Policy',
  otherDocument: 'Other Document',
  additionalInfo: 'Additional Info',
};

/* -------------------------------------------------------------------------- */
/*                            Small render helpers                            */
/* -------------------------------------------------------------------------- */

const SectionTitle: React.FC<{
  index: number;
  color: 'blue' | 'emerald' | 'purple' | 'amber' | 'slate' | 'rose';
  label: string;
  subtitle?: string;
}> = ({ index, color, label, subtitle }) => {
  const colorMap: Record<typeof color, string> = {
    blue:    'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    purple:  'bg-purple-100 text-purple-700',
    amber:   'bg-amber-100 text-amber-700',
    slate:   'bg-slate-200 text-slate-700',
    rose:    'bg-rose-100 text-rose-700',
  };
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold', colorMap[color])}>
        {index}
      </div>
      <div>
        <h3 className="text-[14px] font-bold text-slate-900">{label}</h3>
        {subtitle && <p className="text-[12px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
};

const PreviewBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-5">
    <div className="text-[12px] uppercase tracking-wider text-slate-500 font-bold mb-3">{title}</div>
    {children}
  </div>
);

const PreviewRow: React.FC<{ label: string; value: string; multiline?: boolean }> = ({ label, value, multiline }) => (
  <div className={cn('py-1.5', multiline && 'col-span-full')}>
    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
    <div className="text-[13px] text-slate-800 whitespace-pre-wrap">{value || '—'}</div>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
    <div className="text-[14px] font-bold text-slate-800">{value}</div>
  </div>
);
