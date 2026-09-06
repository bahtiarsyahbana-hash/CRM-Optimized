import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  MasterPolicy, MasterPolicyType, MASTER_POLICY_TYPES,
  RateStructure, RATE_STRUCTURES,
  Currency, CURRENCIES,
  ProductType, PRODUCT_TYPES, insuranceTypesForProduct,
} from '../../types';
import { INSURANCE_COMPANIES } from '../../constants/insuranceCompanies';
import { canChangePolicyType } from '../../utils/masterPolicyRating';
import { X, Umbrella, Lock, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]';

const readOnlyClass =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-600';

const formatNumber = (v: string) => {
  const n = v.replace(/[^0-9.]/g, '');
  if (!n) return '';
  const parts = n.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};
const parseNum = (v: string): number | undefined =>
  v && v.trim() !== '' ? parseFloat(v.replace(/,/g, '')) : undefined;

const Field: React.FC<{
  label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode;
}> = ({ label, required, hint, className, children }) => (
  <div className={className}>
    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);

export const MasterPolicyForm: React.FC<{
  policy?: MasterPolicy | null;
  onClose: () => void;
}> = ({ policy, onClose }) => {
  const { clients, deals, addMasterPolicy, updateMasterPolicy, addRatingRule } = useData();

  const [policyNumber, setPolicyNumber] = useState(policy?.policyNumber || '');
  const [clientId, setClientId] = useState(policy?.clientId || '');
  const [policyType, setPolicyType] = useState<MasterPolicyType>(policy?.policyType || 'Open Cover');
  const [rateStructure, setRateStructure] = useState<RateStructure>(policy?.rateStructure || 'Single Rate');
  const [productType, setProductType] = useState<ProductType | ''>(policy?.productType || '');
  const [typeOfInsurance, setTypeOfInsurance] = useState(policy?.typeOfInsurance || '');
  const [insuranceCompany, setInsuranceCompany] = useState(policy?.insuranceCompany || '');
  const [currency, setCurrency] = useState<Currency>(policy?.currency || 'IDR');
  // Default rates seed a RatingRule on save — they are not columns on the cover.
  // Only offered when creating; an existing cover's rates are managed as rules.
  const [insurerRate, setInsurerRate] = useState('');
  const [insuredRate, setInsuredRate] = useState('');
  const [periodStart, setPeriodStart] = useState(
    policy?.periodStart ? policy.periodStart.slice(0, 10) : '');
  const [periodEnd, setPeriodEnd] = useState(
    policy?.periodEnd ? policy.periodEnd.slice(0, 10) : '');
  const [sumInsuredLimit, setSumInsuredLimit] = useState(
    policy?.sumInsuredLimit != null ? formatNumber(String(policy.sumInsuredLimit)) : '');
  const [notes, setNotes] = useState(policy?.notes || '');

  const selectedClient = clients.find(c => c.id === clientId) || null;
  const isDual = rateStructure === 'Dual Rate';

  // Policy Type is immutable once the cover has declarations, because it
  // determines what those declarations are.
  const typeLocked = policy ? !canChangePolicyType(policy.id, deals) : false;
  const declarationCount = policy ? deals.filter(d => d.masterPolicyId === policy.id).length : 0;

  const availableTypes = insuranceTypesForProduct(productType);

  /* ---- Default rates ------------------------------------------------------
   * These seed a RatingRule on save rather than persisting on the cover, so
   * rates have exactly one home. Dated rules added later resolve against the
   * seeded rule the same as against any other.
   * Only offered on create — an existing cover's rates live in its rule list.
   */
  const insured = parseNum(insuredRate);
  const insurerR = parseNum(insurerRate);
  const limit = parseNum(sumInsuredLimit) ?? 0;

  const rateValidation = useMemo(() => {
    if (policy) return null;                       // editing: rules are managed separately
    if (insuredRate === '' && insurerRate === '') return null;  // both blank: seed nothing
    if (insured === undefined || insured <= 0) return 'Enter a rate for the insured.';
    if (isDual) {
      if (insurerR === undefined || insurerR <= 0) return 'Dual Rate covers need a rate from the insurer.';
      if (insurerR > insured) return 'Insurer rate cannot exceed the insured rate — that is a negative spread.';
    }
    return null;
  }, [policy, insuredRate, insurerRate, insured, insurerR, isDual]);

  // Live spread, in percent and in currency at the limit of liability.
  const spreadPercent = isDual && insured !== undefined && insurerR !== undefined
    ? insured - insurerR
    : null;
  const spreadAtLimit = spreadPercent !== null && limit > 0
    ? limit * (spreadPercent / 100)
    : null;

  const handleProductChange = (next: ProductType | '') => {
    setProductType(next);
    const valid = insuranceTypesForProduct(next);
    setTypeOfInsurance(prev => (prev && valid.includes(prev) ? prev : ''));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyNumber.trim()) return toast.error('Policy number is required.');
    if (!clientId) return toast.error('Select a client.');
    if (rateValidation) return toast.error(rateValidation);

    const payload = {
      policyNumber: policyNumber.trim(),
      clientId,
      policyType,
      rateStructure,
      // Read-only here — taken from the client record, managed in Administration.
      lineOfBusiness: selectedClient?.lineOfBusiness || 'Others',
      productType: (productType || undefined) as ProductType | undefined,
      typeOfInsurance: typeOfInsurance || undefined,
      insuranceCompany: insuranceCompany || undefined,
      currency,
      periodStart: periodStart ? new Date(periodStart).toISOString() : undefined,
      periodEnd: periodEnd ? new Date(periodEnd).toISOString() : undefined,
      sumInsuredLimit: parseNum(sumInsuredLimit),
      notes: notes || undefined,
    };

    if (policy) {
      // Guard the immutable field even if the UI was bypassed.
      updateMasterPolicy(policy.id, typeLocked ? { ...payload, policyType: policy.policyType } : payload);
      toast.success('Master policy updated');
    } else {
      const newId = addMasterPolicy(payload);

      // Seed the opening rating rule from the default rates. It is an ordinary
      // rule — editable, supersedable by a later-dated one — not a special case.
      if (insured !== undefined && insured > 0) {
        addRatingRule({
          masterPolicyId: newId,
          clientRatePercent: insured,
          insurerRatePercent: isDual ? (insurerR ?? null) : null,
          // The cover's effective date, falling back to today when it has none.
          effectiveFrom: payload.periodStart ?? new Date().toISOString(),
        });
        toast.success('Master policy created with its opening rating rule');
      } else {
        toast.success('Master policy created — add a rating rule before declaring');
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Umbrella className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {policy ? 'Edit Master Policy' : 'New Master Policy'}
              </h2>
              <p className="text-[13px] text-slate-500">
                Declarations under this cover rate from its rating rules.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <form id="master-policy-form" onSubmit={submit} className="space-y-6">

            {/* ---- Identity ---- */}
            <section className="bg-white rounded-lg p-5 border border-slate-200 space-y-4">
              <h3 className="text-[13px] font-bold text-slate-800 border-b border-slate-100 pb-2">Cover</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Policy Number" required>
                  <input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)}
                    className={inputClass} placeholder="e.g. OC/2026/0012" />
                </Field>

                <Field label="Client" required>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
                    <option value="">Select a client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </Field>

                <Field
                  label="Policy Type"
                  required
                  hint={typeLocked
                    ? `Locked — this cover has ${declarationCount} declaration${declarationCount === 1 ? '' : 's'}.`
                    : 'Set at creation. Immutable once the cover has a declaration.'}
                >
                  <div className="relative">
                    <select
                      value={policyType}
                      onChange={e => setPolicyType(e.target.value as MasterPolicyType)}
                      disabled={typeLocked}
                      className={cn(inputClass, typeLocked && 'bg-slate-50 text-slate-500 cursor-not-allowed pr-9')}
                    >
                      {MASTER_POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {typeLocked && (
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </Field>

                <Field
                  label="Line of Business"
                  hint="From the client record. Managed in Administration."
                >
                  <div className={readOnlyClass}>
                    {selectedClient?.lineOfBusiness || <span className="text-slate-400 italic">select a client</span>}
                  </div>
                </Field>

                <Field label="Product">
                  <select value={productType} onChange={e => handleProductChange(e.target.value as ProductType | '')} className={inputClass}>
                    <option value="">Select product</option>
                    {PRODUCT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>

                <Field label="Type of Insurance" hint={productType ? undefined : 'Select a product first.'}>
                  <select
                    value={typeOfInsurance}
                    onChange={e => setTypeOfInsurance(e.target.value)}
                    disabled={!productType}
                    className={cn(inputClass, !productType && 'bg-slate-50 text-slate-400 cursor-not-allowed')}
                  >
                    <option value="">{productType ? 'Select type' : 'Select a product first'}</option>
                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>

                <Field label="Insurer">
                  <select value={insuranceCompany} onChange={e => setInsuranceCompany(e.target.value)} className={inputClass}>
                    <option value="">Select insurer</option>
                    {INSURANCE_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </Field>

                <Field label="Currency" required hint="Declarations capture a rate of exchange at their own date.">
                  <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={inputClass}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="Period Start">
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Period End">
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={inputClass} />
                </Field>

                <Field label={`Limit of Liability (${currency})`} hint="Maximum insured value per declaration. Advisory — a declaration above it warns but is still accepted." className="md:col-span-2">
                  <input type="text" value={sumInsuredLimit}
                    onChange={e => setSumInsuredLimit(formatNumber(e.target.value))}
                    className={inputClass} placeholder="0" />
                </Field>
              </div>
            </section>

            {/* ---- Rate structure ---- */}
            <section className="bg-white rounded-lg p-5 border border-slate-200 space-y-4">
              <h3 className="text-[13px] font-bold text-slate-800 border-b border-slate-100 pb-2">Rate Structure</h3>

              <Field label="Rate Structure" required>
                <select value={rateStructure} onChange={e => setRateStructure(e.target.value as RateStructure)} className={inputClass}>
                  {RATE_STRUCTURES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>

              <div className="flex items-start gap-2 text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  {isDual
                    ? 'Separate client and insurer rates. The difference is the spread — broker income, not commissionable. Rates are entered as rating rules on the cover.'
                    : 'One rate applies to both sides. No spread.'}
                </span>
              </div>
            </section>

            {/* ---- Default rates: seed the opening rating rule ---- */}
            {!policy && (
              <section className="bg-white rounded-lg p-5 border border-slate-200 space-y-4">
                <h3 className="text-[13px] font-bold text-slate-800 border-b border-slate-100 pb-2">Default Rates</h3>
                <p className="text-[12px] text-slate-500">
                  These create the cover&rsquo;s opening rating rule, effective from the cover&rsquo;s start date.
                  Rates live as rating rules, not on the cover — add dated rules later to change them mid-term.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isDual && (
                    <Field label="Rate % from Insurer" hint="Of sum insured. Commission calculates on this.">
                      <input type="number" step="0.0001" min="0" value={insurerRate}
                        onChange={e => setInsurerRate(e.target.value)}
                        className={inputClass} placeholder="e.g. 0.18" />
                    </Field>
                  )}
                  <Field
                    label="Rate % for Insured"
                    hint={isDual ? 'Of sum insured. What the client is charged.' : 'Of sum insured. Applies to both sides.'}
                  >
                    <input type="number" step="0.0001" min="0" value={insuredRate}
                      onChange={e => setInsuredRate(e.target.value)}
                      className={inputClass} placeholder="e.g. 0.25" />
                  </Field>
                </div>

                {rateValidation && (
                  <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {rateValidation}
                  </div>
                )}

                {/* Live spread, in percent and in currency at the limit of liability. */}
                {isDual && !rateValidation && spreadPercent !== null && (
                  <div className="text-[12px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2 flex items-center justify-between">
                    <span>Spread</span>
                    <span className="font-mono font-bold">
                      {spreadPercent.toFixed(4)}%
                      {spreadAtLimit !== null
                        ? ` · ${currency} ${spreadAtLimit.toLocaleString(undefined, { maximumFractionDigits: 2 })} at the limit of liability`
                        : ' · set a limit of liability to see this in currency'}
                    </span>
                  </div>
                )}
              </section>
            )}

            <section className="bg-white rounded-lg p-5 border border-slate-200">
              <Field label="Notes">
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  className={cn(inputClass, 'resize-none')} placeholder="Cover wording notes, warranties, exclusions..." />
              </Field>
            </section>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
            Cancel
          </button>
          <button type="submit" form="master-policy-form" disabled={Boolean(rateValidation)}
            className={cn(
              'px-5 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm transition-colors',
              rateValidation ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
            )}>
            {policy ? 'Save Changes' : 'Create Master Policy'}
          </button>
        </div>
      </div>
    </div>
  );
};
