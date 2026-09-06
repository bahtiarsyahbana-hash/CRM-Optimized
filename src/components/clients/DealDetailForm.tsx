import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  Deal,
  DealType,
  DealStage,
  PaymentStatus,
  ProductType,
  PRODUCT_TYPES,
  insuranceTypesForProduct,
  DealApprovalStatus,
  DealDocuments,
  PolicyLine,
  PremiumType,
  PREMIUM_TYPES,
  DEFAULT_STAMP_DUTY,
} from '../../types';
import {
  defaultCommissionRate,
  DEFAULT_TAX_PERCENT,
  computeCommission,
  PremiumInputs,
  CommissionBreakdown,
} from '../../utils/commissionCalc';
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
  Info,
  Calculator,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isRenewal } from '../../utils/dealTrack';
import { selectableInsurers, resolveBaseCommissionRate } from '../../utils/insurers';
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

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** Money formatter used across the calculation and preview panels. */
const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const { addDeal, updateDeal, clients, insurers } = useData();

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
  // Premium entry lives entirely in step 3 (Premium Calculation).
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
  const [insurerId, setInsurerId] = useState(deal?.insurerId || '');
  const insurerOptions = selectableInsurers(insurers, deal?.insurerId);
  const selectedInsurer = insurers.find(i => i.id === insurerId) || null;

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

  /** Types available for the currently selected product category. */
  const availableInsuranceTypes = useMemo(
    () => insuranceTypesForProduct(productType),
    [productType]
  );

  /**
   * Changing the product category invalidates any insurance type that doesn't
   * belong to the new one — on the primary product and on every extra line.
   * Anything still valid is kept so switching back and forth isn't destructive.
   */
  const handleProductTypeChange = (next: ProductType | '') => {
    setProductType(next);
    const valid = insuranceTypesForProduct(next);
    setTypeOfInsurance(prev => (prev && valid.includes(prev) ? prev : ''));
    setExtraLines(prev =>
      prev.map(l => (l.productName && valid.includes(l.productName) ? l : { ...l, productName: '' }))
    );
  };

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

  // Sum insured across the primary product and every extra line — the base
  // for a percentage-derived premium.
  const allLineSumInsured = useMemo(() => {
    const primary = parseNum(sumInsured) ?? 0;
    const extras = extraLines.reduce((acc, l) => acc + (parseNum(l.sumInsured) ?? 0), 0);
    return primary + extras;
  }, [sumInsured, extraLines]);

  /* ----- Step 3: Premium calculation ----- */
  const [premiumType, setPremiumType] = useState<PremiumType>(
    (deal?.premiumType as PremiumType) === 'Percentage from Sum Insured'
      ? 'Percentage from Sum Insured'
      : 'Fixed Amount'
  );
  const [basicPremiumInput, setBasicPremiumInput] = useState<string>(
    deal?.basicPremium != null ? formatNumber(String(deal.basicPremium)) : ''
  );
  const [premiumRatePercent, setPremiumRatePercent] = useState<string>(
    deal?.premiumRatePercent != null ? String(deal.premiumRatePercent) : ''
  );
  const [premiumMarkup, setPremiumMarkup] = useState<string>(
    deal?.premiumMarkup != null ? formatNumber(String(deal.premiumMarkup)) : ''
  );
  const [adminFee, setAdminFee] = useState<string>(
    deal?.adminFee != null ? formatNumber(String(deal.adminFee)) : ''
  );
  const [policyFee, setPolicyFee] = useState<string>(
    deal?.policyFee != null ? formatNumber(String(deal.policyFee)) : ''
  );
  const [stampDuty, setStampDuty] = useState<string>(
    deal?.stampDuty != null ? formatNumber(String(deal.stampDuty)) : formatNumber(String(DEFAULT_STAMP_DUTY))
  );

  /** Basic premium — keyed in directly, or derived from the sum insured. */
  const basicPremium = useMemo(() => {
    if (premiumType === 'Percentage from Sum Insured') {
      const rate = parseNum(premiumRatePercent) ?? 0;
      return allLineSumInsured * (rate / 100);
    }
    return parseNum(basicPremiumInput) ?? 0;
  }, [premiumType, premiumRatePercent, allLineSumInsured, basicPremiumInput]);

  const premiumInputs: PremiumInputs = useMemo(() => ({
    basicPremium,
    premiumMarkup: parseNum(premiumMarkup) ?? 0,
    adminFee: parseNum(adminFee) ?? 0,
    policyFee: parseNum(policyFee) ?? 0,
    stampDuty: parseNum(stampDuty) ?? 0,
  }), [basicPremium, premiumMarkup, adminFee, policyFee, stampDuty]);

  // On a multi-product deal the extra lines carry their own premium; the
  // primary product takes whatever is left of the basic premium so the lines
  // always reconcile to the deal total.
  const extraLinesPremiumTotal = useMemo(
    () => extraLines.reduce((acc, l) => acc + (parseNum(l.premiumAmount) ?? 0), 0),
    [extraLines]
  );
  const primaryLinePremium = Math.max(0, basicPremium - extraLinesPremiumTotal);

  /* ----- Step 4: Status & Documents ----- */
  const [statusStage, setStatusStage] = useState<DealStage>(deal?.statusStage || 'Leads');
  const [documents, setDocuments] = useState<DealDocuments>(deal?.documents || {});

  // Renewals skip the Leads stage — they start already on the books.
  const statusStageOptions: DealStage[] = isRenewal(dealType)
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
  const [overrideFee, setOverrideFee] = useState<string>(
    deal?.commission?.overrideFee != null ? String(deal.commission.overrideFee) : ''
  );
  const [overrideFeeType, setOverrideFeeType] = useState<'percent' | 'fixed'>(
    deal?.commission?.overrideFeeType || 'fixed'
  );

  /**
   * Suggest a base commission. The insurer's own rate wins when one is selected
   * and has a rate; otherwise defaultCommissionRate supplies it.
   *
   * Still seeds only when the field is empty — a rate the user has typed is
   * never overwritten, including when they later change insurer.
   */
  const commissionSuggestion = useMemo(
    () => resolveBaseCommissionRate(selectedInsurer, selectedClient || undefined, typeOfInsurance, productType),
    [selectedInsurer, selectedClient, typeOfInsurance, productType],
  );

  useEffect(() => {
    if (typeOfInsurance && !baseRate) {
      setBaseRate(String(commissionSuggestion.rate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeOfInsurance, productType, selectedClient?.id, insurerId]);

  /**
   * Live breakdown, recomputed as the user types. Drives the totals panel in
   * step 3, the commission panel in step 5, and the preview.
   */
  const breakdown = useMemo(() => computeCommission(premiumInputs, {
    baseRate: parseNum(baseRate),
    discountPercent: parseNum(discountPercent),
    efCommissionPercent: parseNum(efCommissionPercent),
    taxPercent: parseNum(taxPercent) ?? DEFAULT_TAX_PERCENT,
    agentName: agentName || undefined,
    overrideFee: parseNum(overrideFee),
    overrideFeeType: overrideFee ? overrideFeeType : undefined,
  }), [premiumInputs, baseRate, discountPercent, efCommissionPercent, taxPercent, agentName, overrideFee, overrideFeeType]);

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
      !insurerId ? 'Insurer is required.' : null,
    ].filter(Boolean) as string[],
    premium: [
      premiumType === 'Percentage from Sum Insured' && !premiumRatePercent
        ? 'Premium rate % is required.' : null,
      premiumType === 'Percentage from Sum Insured' && allLineSumInsured <= 0
        ? 'Sum Insured must be set in step 2 to derive a premium from it.' : null,
      premiumType === 'Fixed Amount' && !basicPremiumInput
        ? 'Basic Premium is required.' : null,
    ].filter(Boolean) as string[],
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
            premiumAmount: primaryLinePremium,
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

    /* Premium calculation */
    premiumType,
    premiumRatePercent: premiumType === 'Percentage from Sum Insured'
      ? parseNum(premiumRatePercent) : undefined,
    basicPremium,
    premiumMarkup: premiumInputs.premiumMarkup || undefined,
    adminFee: premiumInputs.adminFee || undefined,
    policyFee: premiumInputs.policyFee || undefined,
    stampDuty: premiumInputs.stampDuty || undefined,
    // premiumAmount is the total the client is invoiced, which is what the
    // policies list, GWP and invoice aging all read.
    premiumAmount: breakdown.totalPremiumPayable,

    coverNoteNumber: isMultiProductMode ? undefined : (primaryCoverNoteNumber || deal?.coverNoteNumber),
    insurerId: insurerId || undefined,
    // Name kept alongside the id so documents and older views still read.
    insuranceCompany: selectedInsurer?.name,
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
      overrideFee: parseNum(overrideFee),
      overrideFeeType: overrideFee ? overrideFeeType : undefined,
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
                productType, setProductType: handleProductTypeChange,
                availableInsuranceTypes,
                sumInsured, setSumInsured,
                currency, setCurrency,
                riskLocation, setRiskLocation,
                riskDetail, setRiskDetail,
                periodStart, setPeriodStart,
                periodEnd, setPeriodEnd,
                picName, setPicName,
                picEmail, setPicEmail,
                picPhone, setPicPhone,
                insurerId, setInsurerId, insurerOptions,
                commissionSuggestion,
                extraLines, addProductLine, removeProductLine, updateProductLine,
                primaryCoverNoteNumber, setPrimaryCoverNoteNumber,
                allLineSumInsured,
                extraLinesPremiumTotal,
              }}
            />
          )}
          {currentStep.key === 'premium' && (
            <StepPremium
              currency={currency}
              sumInsured={allLineSumInsured}
              premiumType={premiumType}
              setPremiumType={setPremiumType}
              basicPremiumInput={basicPremiumInput}
              setBasicPremiumInput={setBasicPremiumInput}
              premiumRatePercent={premiumRatePercent}
              setPremiumRatePercent={setPremiumRatePercent}
              premiumMarkup={premiumMarkup}
              setPremiumMarkup={setPremiumMarkup}
              adminFee={adminFee}
              setAdminFee={setAdminFee}
              policyFee={policyFee}
              setPolicyFee={setPolicyFee}
              stampDuty={stampDuty}
              setStampDuty={setStampDuty}
              breakdown={breakdown}
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
                overrideFee, setOverrideFee,
                overrideFeeType, setOverrideFeeType,
                currency,
                breakdown,
              }}
            />
          )}
          {currentStep.key === 'preview' && (
            <StepPreview
              client={selectedClient}
              data={{
                clientAddress, dealType, typeOfInsurance, productType, sumInsured,
                currency, premiumType, riskLocation, riskDetail, periodStart, periodEnd,
                picName, picEmail, picPhone, insurerName: selectedInsurer?.name ?? '', statusStage, documents,
                agentName, overrideFeeType,
                premiumRatePercent,
                breakdown,
                primaryCoverNoteNumber,
                extraLines,
                allLineSumInsured,
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
  /** Type of Insurance options for the selected product category. */
  availableInsuranceTypes: string[];
  sumInsured: string;                                 setSumInsured: (v: string) => void;
  currency: string;                                   setCurrency: (v: string) => void;
  riskLocation: string;                               setRiskLocation: (v: string) => void;
  riskDetail: string;                                 setRiskDetail: (v: string) => void;
  periodStart: string;                                setPeriodStart: (v: string) => void;
  periodEnd: string;                                  setPeriodEnd: (v: string) => void;
  picName: string;                                    setPicName: (v: string) => void;
  picEmail: string;                                   setPicEmail: (v: string) => void;
  picPhone: string;                                   setPicPhone: (v: string) => void;
  insurerId: string;                                  setInsurerId: (v: string) => void;
  insurerOptions: { id: string; code: string; name: string; commissionRatePercent?: number }[];
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
  extraLinesPremiumTotal: number;
}

const StepCoverage: React.FC<StepCoverageProps> = (p) => {
  const insuranceTypeOptions = p.availableInsuranceTypes;
  const hasProduct = !!p.productType;
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

        <Field label="Product" required hint="Choosing a product narrows the Type of Insurance options.">
          <select
            value={p.productType}
            onChange={e => p.setProductType(e.target.value as ProductType | '')}
            className={inputClass}
          >
            <option value="">Select Product</option>
            {PRODUCT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field
          label="Type of Insurance"
          required
          hint={hasProduct ? undefined : 'Select a product first.'}
        >
          <select
            value={p.typeOfInsurance}
            onChange={e => p.setTypeOfInsurance(e.target.value)}
            disabled={!hasProduct}
            className={cn(inputClass, !hasProduct && 'bg-slate-50 text-slate-400 cursor-not-allowed')}
          >
            <option value="">{hasProduct ? 'Select Insurance Type' : 'Select a product first'}</option>
            {insuranceTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field label="Currency" required>
          <select value={p.currency} onChange={e => p.setCurrency(e.target.value)} className={inputClass}>
            {currencyOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <Field
          label={`Sum Insured (${p.currency})`}
          hint="Premium is worked out in step 3."
        >
          <input
            type="text" value={p.sumInsured}
            onChange={e => p.setSumInsured(formatNumber(e.target.value))}
            className={inputClass} placeholder="1,000,000"
          />
        </Field>

        <Field label="Insurer" required hint="Managed in Administration → Insurers.">
          <select value={p.insurerId} onChange={e => p.setInsurerId(e.target.value)} className={inputClass}>
            <option value="">Select insurer</option>
            {p.insurerOptions.map(i => (
              <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
            ))}
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
              All lines draw from the <span className="font-semibold">{p.productType || 'selected'}</span> product.
              Each carries its own cover note number; everything else (period, insurer, PIC, invoice,
              approval) stays shared.
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
                      disabled={!hasProduct}
                      className={cn(inputClass, !hasProduct && 'bg-slate-50 text-slate-400 cursor-not-allowed')}
                    >
                      <option value="">{hasProduct ? 'Select Insurance Type' : 'Select a product first'}</option>
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
                  <Field
                    label={`Premium Share (${p.currency})`}
                    hint="Optional — this product's slice of the basic premium."
                  >
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
                <div className="text-emerald-700 font-semibold uppercase tracking-wider text-[10px]">Allocated to Extra Products</div>
                <div className="font-mono font-bold text-slate-900">{p.currency} {p.extraLinesPremiumTotal.toLocaleString()}</div>
              </div>
              <div className="ml-auto text-[11px] text-slate-500 self-end">
                {p.extraLines.length + 1} products · premium set in step 3
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
/*                        Step 3: Premium Calculation                         */
/* -------------------------------------------------------------------------- */

interface StepPremiumProps {
  currency: string;
  sumInsured: number;
  premiumType: PremiumType;                setPremiumType: (v: PremiumType) => void;
  basicPremiumInput: string;               setBasicPremiumInput: (v: string) => void;
  premiumRatePercent: string;              setPremiumRatePercent: (v: string) => void;
  premiumMarkup: string;                   setPremiumMarkup: (v: string) => void;
  adminFee: string;                        setAdminFee: (v: string) => void;
  policyFee: string;                       setPolicyFee: (v: string) => void;
  stampDuty: string;                       setStampDuty: (v: string) => void;
  breakdown: CommissionBreakdown;
}

const StepPremium: React.FC<StepPremiumProps> = (p) => {
  const b = p.breakdown;
  const isPercent = p.premiumType === 'Percentage from Sum Insured';

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-4xl mx-auto space-y-6">
      <SectionTitle
        index={3}
        color="purple"
        label="Premium Calculation"
        subtitle="Set the basic premium, then any markup and fees. Commission is worked out from the basic premium in step 5."
      />

      {/* ---- Premium type ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Premium Type" required hint="How the basic premium is arrived at.">
          <select
            value={p.premiumType}
            onChange={e => p.setPremiumType(e.target.value as PremiumType)}
            className={inputClass}
          >
            {PREMIUM_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </Field>
      </div>

      {/* ---- Basic premium ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {isPercent ? (
          <>
            <Field label="Rate (% of Sum Insured)" required>
              <input
                type="number" min="0" step="0.0001"
                value={p.premiumRatePercent}
                onChange={e => p.setPremiumRatePercent(e.target.value)}
                className={inputClass}
                placeholder="e.g. 0.15"
              />
            </Field>
            <Field label={`Basic Premium (${p.currency})`} hint="Derived from rate × sum insured.">
              <div className={cn(inputClass, 'bg-slate-50 font-mono text-slate-700 flex items-center justify-between')}>
                <span className="text-[11px] text-slate-400">
                  {p.sumInsured.toLocaleString()} × {p.premiumRatePercent || 0}%
                </span>
                <span className="font-semibold text-slate-900">{money(b.basicPremium)}</span>
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label={`Basic Premium (${p.currency})`} required>
              <input
                type="text"
                value={p.basicPremiumInput}
                onChange={e => p.setBasicPremiumInput(formatNumber(e.target.value))}
                className={inputClass}
                placeholder="0"
              />
            </Field>
            <Field label={`Sum Insured (${p.currency})`} hint="Set in step 2, shown here for reference.">
              <div className={cn(inputClass, 'bg-slate-50 font-mono text-slate-600')}>
                {p.sumInsured.toLocaleString()}
              </div>
            </Field>
          </>
        )}

        <Field
          label={`Premium Markup (${p.currency})`}
          hint="Optional uplift retained by the broker — becomes additional commission."
        >
          <input
            type="text"
            value={p.premiumMarkup}
            onChange={e => p.setPremiumMarkup(formatNumber(e.target.value))}
            className={inputClass}
            placeholder="0"
          />
        </Field>

        <Field label={`Stamp Duty (${p.currency})`} hint="Bea materai. Passed through to the insurer.">
          <input
            type="text"
            value={p.stampDuty}
            onChange={e => p.setStampDuty(formatNumber(e.target.value))}
            className={inputClass}
            placeholder="0"
          />
        </Field>

        <Field label={`Admin Fee (${p.currency})`}>
          <input
            type="text"
            value={p.adminFee}
            onChange={e => p.setAdminFee(formatNumber(e.target.value))}
            className={inputClass}
            placeholder="0"
          />
        </Field>

        <Field label={`Policy Fee (${p.currency})`}>
          <input
            type="text"
            value={p.policyFee}
            onChange={e => p.setPolicyFee(formatNumber(e.target.value))}
            className={inputClass}
            placeholder="0"
          />
        </Field>
      </div>

      {/* ---- Totals ---- */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Premium Summary
        </div>
        <div className="p-4 space-y-2 text-[13px]">
          <TotalLine label="Basic Premium" value={money(b.basicPremium)} />
          {b.premiumMarkup > 0 && (
            <TotalLine label="Premium Markup" value={`+ ${money(b.premiumMarkup)}`} accent="blue" />
          )}
          {b.adminFee > 0 && <TotalLine label="Admin Fee" value={`+ ${money(b.adminFee)}`} />}
          {b.policyFee > 0 && <TotalLine label="Policy Fee" value={`+ ${money(b.policyFee)}`} />}
          {b.stampDuty > 0 && <TotalLine label="Stamp Duty" value={`+ ${money(b.stampDuty)}`} />}
        </div>

        {/* What the client is invoiced */}
        <div className="bg-emerald-50 border-t border-emerald-200 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-emerald-900">Premium Due to Insured (Client)</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              Basic Premium + Markup + Admin Fee + Policy Fee + Stamp Duty
            </div>
          </div>
          <span className="text-[16px] font-bold font-mono text-emerald-900">
            {p.currency} {money(b.totalPremiumPayable)}
          </span>
        </div>
      </div>

      {b.premiumMarkup > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
          A markup of <span className="font-semibold">{p.currency} {money(b.premiumMarkup)}</span> is
          retained by the broker and shows up as additional commission in step 5. It is not passed to the insurer.
        </div>
      )}
    </div>
  );
};

const TotalLine: React.FC<{ label: string; value: string; accent?: 'blue' }> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between">
    <span className={cn('font-medium', accent === 'blue' ? 'text-blue-700' : 'text-slate-600')}>{label}</span>
    <span className={cn('font-mono', accent === 'blue' ? 'text-blue-700 font-semibold' : 'text-slate-800')}>
      {value}
    </span>
  </div>
);
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
/*                            Step 5: Commission                              */
/* -------------------------------------------------------------------------- */

const StepCommission: React.FC<{
  baseRate: string;            setBaseRate: (v: string) => void;
  discountPercent: string;     setDiscountPercent: (v: string) => void;
  efCommissionPercent: string; setEfCommissionPercent: (v: string) => void;
  taxPercent: string;          setTaxPercent: (v: string) => void;
  agentName: string;           setAgentName: (v: string) => void;
  overrideFee: string;         setOverrideFee: (v: string) => void;
  overrideFeeType: 'percent' | 'fixed'; setOverrideFeeType: (v: 'percent' | 'fixed') => void;
  currency: string;
  breakdown: CommissionBreakdown;
}> = (p) => {
  const b = p.breakdown;
  const hasMarkup = b.premiumMarkup > 0;

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200 max-w-4xl mx-auto space-y-6">
      <SectionTitle
        index={5}
        color="amber"
        label="Commission"
        subtitle="Commission, discount and EF are percentages of the basic premium; tax is charged on the commission earned. Markup flows straight into commission."
      />

      {hasMarkup && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-800 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Additional commission from premium markup.</strong> This deal carries a markup of{' '}
            <span className="font-semibold">{p.currency} {money(b.premiumMarkup)}</span>, which is added to both
            gross and net commission below on top of the basic commission.
          </div>
        </div>
      )}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-600 flex items-center justify-between">
        <span className="font-medium">Basic Premium (all rates apply to this)</span>
        <span className="font-mono font-bold text-slate-900">{p.currency} {money(b.basicPremium)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Base Commission %" required hint={`= ${p.currency} ${money(b.basicCommission)}`}>
          <input type="number" min="0" max="100" step="0.01" value={p.baseRate}
            onChange={e => p.setBaseRate(e.target.value)} className={inputClass} placeholder="e.g. 15" />
        </Field>

        <Field
          label="Discount to Client %"
          hint={p.baseRate
            ? `Cannot exceed ${p.baseRate}%. = ${p.currency} ${money(b.discountAmount)}`
            : undefined}
        >
          <input type="number" min="0" max={p.baseRate || undefined} step="0.01" value={p.discountPercent}
            onChange={e => p.setDiscountPercent(e.target.value)} className={inputClass} placeholder="0" />
        </Field>

        <Field label="EF Commission %" hint={`Behind-the-table. = ${p.currency} ${money(b.efAmount)}`}>
          <input type="number" min="0" max="100" step="0.01" value={p.efCommissionPercent}
            onChange={e => p.setEfCommissionPercent(e.target.value)} className={inputClass} placeholder="0" />
        </Field>

        <Field
          label="Tax %"
          hint={`Net Basic Commission (${p.currency} ${money(b.netBasicCommission)}) × ${p.taxPercent || DEFAULT_TAX_PERCENT}% = ${p.currency} ${money(b.taxAmount)}`}
        >
          <input type="number" min="0" max="100" step="0.01" value={p.taxPercent}
            onChange={e => p.setTaxPercent(e.target.value)} className={inputClass}
            placeholder={`${DEFAULT_TAX_PERCENT}`} />
        </Field>
      </div>

      {/* ---- Override fee ---- */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-[13px] font-semibold text-slate-800 mb-3">Override Fee (Optional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Paid To">
            <input type="text" value={p.agentName} onChange={e => p.setAgentName(e.target.value)}
              className={inputClass} placeholder="Agent / introducer name" />
          </Field>

          <Field
            label={p.overrideFeeType === 'percent' ? 'Override Fee %' : `Override Fee (${p.currency})`}
            hint={`Deducted after net commission. = ${p.currency} ${money(b.overrideFee)}`}
          >
            <div className="flex gap-2">
              <div className="flex rounded-md overflow-hidden border border-slate-200 shrink-0">
                {(['percent', 'fixed'] as const).map((t, idx) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => p.setOverrideFeeType(t)}
                    className={cn(
                      'px-3 py-2 text-[12px] font-semibold transition-colors',
                      idx > 0 && 'border-l border-slate-200',
                      p.overrideFeeType === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    )}
                    title={t === 'percent' ? 'Percent of basic premium' : 'Fixed amount'}
                  >
                    {t === 'percent' ? '%' : p.currency}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={p.overrideFeeType === 'fixed' ? formatNumber(p.overrideFee) : p.overrideFee}
                onChange={e => {
                  const v = e.target.value;
                  p.setOverrideFee(p.overrideFeeType === 'fixed' ? formatNumber(v) : v.replace(/[^\d.]/g, ''));
                }}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </Field>
        </div>
      </div>

      {/* ---- Breakdown ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Commission
          </div>
          <div className="p-4 space-y-2 text-[13px]">
            <TotalLine label="Basic Commission" value={money(b.basicCommission)} />
            <TotalLine label="Discount" value={`− ${money(b.discountAmount)}`} />
            <div className="flex items-center justify-between border-y border-dashed border-slate-200 py-1.5 my-1">
              <span className="font-semibold text-slate-700">Net Basic Commission</span>
              <span className="font-mono font-semibold text-slate-900">{money(b.netBasicCommission)}</span>
            </div>
            <TotalLine label={`Tax (${b.taxPercent}% of net)`} value={`− ${money(b.taxAmount)}`} />
            <TotalLine label="Markup" value={`+ ${money(b.premiumMarkup)}`} accent="blue" />
            <TotalLine label="EF Commission" value={`+ ${money(b.efAmount)}`} />
            <div className="pt-2 mt-1 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-900">Total Net Commission</span>
              <span className="text-[14px] font-bold font-mono text-emerald-700">
                {money(b.totalNetCommission)}
              </span>
            </div>
            {b.overrideFee > 0 && (
              <>
                <TotalLine label="Override Fee" value={`− ${money(b.overrideFee)}`} />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-600">Net After Override</span>
                  <span className="text-[13px] font-bold font-mono text-slate-900">
                    {money(b.netAfterOverride)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Stat
            label="Total Gross Commission"
            value={`${p.currency} ${money(b.totalGrossCommission)}`}
          />

          {/* Both sides of the money flow, side by side */}
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Premium Due to Insured
              </span>
              <span className="text-[13px] font-bold font-mono text-emerald-900">
                {p.currency} {money(b.totalPremiumPayable)}
              </span>
            </div>
            <div className="bg-slate-50 px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Premium to Insurer
              </span>
              <span className="text-[13px] font-bold font-mono text-slate-900">
                {p.currency} {money(b.premiumToInsurer)}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 leading-relaxed">
            Net Basic Commission = Basic Commission − Discount.<br />
            Tax = Net Basic Commission × Tax%.<br />
            Gross = Basic Commission + Markup.<br />
            Due to Insured = Basic Premium + Markup + Fees + Stamp Duty.<br />
            To Insurer = Basic Premium − Basic Commission + Stamp Duty + Tax.
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                            Step 6: Preview                                 */
/* -------------------------------------------------------------------------- */

interface PreviewData {
  clientAddress: string;
  dealType: DealType;
  typeOfInsurance: string;
  productType: ProductType | '';
  sumInsured: string;
  currency: string;
  premiumType: PremiumType;
  premiumRatePercent: string;
  riskLocation: string;
  riskDetail: string;
  periodStart: string;
  periodEnd: string;
  picName: string;
  picEmail: string;
  picPhone: string;
  insurerName: string;
  statusStage: DealStage;
  documents: DealDocuments;
  agentName: string;
  overrideFeeType: 'percent' | 'fixed';
  breakdown: CommissionBreakdown;
  primaryCoverNoteNumber: string;
  extraLines: {
    id: string;
    productName: string;
    sumInsured: string;
    premiumAmount: string;
    coverNoteNumber: string;
  }[];
  allLineSumInsured: number;
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
          <PreviewRow label="Product" value={data.productType || '—'} />
          <PreviewRow label="Insurer" value={data.insurerName || '—'} />
          <PreviewRow label="Sum Insured" value={data.sumInsured ? `${data.currency} ${data.sumInsured}` : '—'} />
          <PreviewRow
            label="Premium Due to Insured"
            value={`${data.currency} ${money(data.breakdown.totalPremiumPayable)}`}
          />
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

      <PreviewBlock title="Premium Calculation">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Stat
            label="Premium Type"
            value={data.premiumType === 'Percentage from Sum Insured'
              ? `${data.premiumRatePercent || 0}% of SI`
              : 'Fixed Amount'}
          />
          <Stat label="Basic Premium" value={`${data.currency} ${money(data.breakdown.basicPremium)}`} />
          <Stat label="Markup" value={`${data.currency} ${money(data.breakdown.premiumMarkup)}`} />
          <Stat label="Due to Insured" value={`${data.currency} ${money(data.breakdown.totalPremiumPayable)}`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 text-[12px] text-slate-600">
          <div className="flex justify-between py-1">
            <span>Admin Fee</span>
            <span className="font-mono text-slate-800">{money(data.breakdown.adminFee)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Policy Fee</span>
            <span className="font-mono text-slate-800">{money(data.breakdown.policyFee)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Stamp Duty</span>
            <span className="font-mono text-slate-800">{money(data.breakdown.stampDuty)}</span>
          </div>
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
        {data.breakdown.premiumMarkup > 0 && (
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
            Includes additional commission from a premium markup of{' '}
            <span className="font-semibold">{data.currency} {money(data.breakdown.premiumMarkup)}</span>.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={`Base (${data.breakdown.baseRate}%)`} value={money(data.breakdown.basicCommission)} />
          <Stat label={`Discount (${data.breakdown.discountPercent}%)`} value={`− ${money(data.breakdown.discountAmount)}`} />
          <Stat label={`EF (${data.breakdown.efPercent}%)`} value={`+ ${money(data.breakdown.efAmount)}`} />
          <Stat
            label={`Tax (${data.breakdown.taxPercent}% of Net Basic Commission)`}
            value={`− ${money(data.breakdown.taxAmount)}`}
          />
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Total Gross Commission" value={`${data.currency} ${money(data.breakdown.totalGrossCommission)}`} />
          <Stat label="Total Net Commission" value={`${data.currency} ${money(data.breakdown.totalNetCommission)}`} />
          <Stat label="Premium to Insurer" value={`${data.currency} ${money(data.breakdown.premiumToInsurer)}`} />
        </div>

        {(data.agentName || data.breakdown.overrideFee > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-[13px] text-slate-700 flex items-center justify-between">
            <span>
              <span className="font-semibold">{data.agentName || 'Override'}</span>
              <span className="text-slate-500 ml-2">
                Override Fee{data.overrideFeeType === 'percent' ? ' (% of basic premium)' : ''}
              </span>
            </span>
            <span className="font-mono">
              − {data.currency} {money(data.breakdown.overrideFee)}
              <span className="text-slate-400 ml-2">
                → net {money(data.breakdown.netAfterOverride)}
              </span>
            </span>
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
