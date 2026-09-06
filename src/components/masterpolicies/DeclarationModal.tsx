import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { MasterPolicy, RatingRule, Client } from '../../types';
import {
  resolveRatingRule, rateDeclaration, MissingRatingRuleError,
} from '../../utils/masterPolicyRating';
import { X, FileCheck, Lock, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]';

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatNumber = (v: string) => {
  const n = v.replace(/[^0-9.]/g, '');
  if (!n) return '';
  const parts = n.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};
const parseNum = (v: string): number | undefined =>
  v && v.trim() !== '' ? parseFloat(v.replace(/,/g, '')) : undefined;

const Field: React.FC<{ label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }> =
  ({ label, required, hint, className, children }) => (
    <div className={className}>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );

/**
 * Declare a shipment or risk under a master policy.
 *
 * Rates are never entered here. They resolve from the cover's rating rules at
 * the declaration date and render read-only — there is no override, for any
 * role. The manual Markup field is absent entirely: on a Dual Rate cover the
 * spread supplies it, and on a Single Rate cover there is none.
 */
export const DeclarationModal: React.FC<{
  cover: MasterPolicy;
  client: Client | null;
  rules: RatingRule[];
  onClose: () => void;
}> = ({ cover, client, rules, onClose }) => {
  const { addDeal, deals } = useData();

  const today = new Date().toISOString().slice(0, 10);
  const [declarationNumber, setDeclarationNumber] = useState('');
  const [declaredAt, setDeclaredAt] = useState(today);
  const [sumInsured, setSumInsured] = useState('');
  const [rateOfExchange, setRateOfExchange] = useState('');
  const [riskDetail, setRiskDetail] = useState('');

  const si = parseNum(sumInsured) ?? 0;

  // The rule in force on the declaration date — not today's rule.
  const rule = useMemo(
    () => resolveRatingRule(rules, cover.id, declaredAt),
    [rules, cover.id, declaredAt],
  );

  const rating = useMemo(
    () => (rule && si > 0 ? rateDeclaration(cover, rule, si) : null),
    [cover, rule, si],
  );

  const isDual = cover.rateStructure === 'Dual Rate';
  const canSubmit = Boolean(rule) && si > 0 && declarationNumber.trim() !== '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationNumber.trim()) return toast.error('Declaration number is required.');
    if (si <= 0) return toast.error('Enter a sum insured.');

    // A missing rule is a hard failure — never rate at zero, never snap to the
    // nearest rule by date.
    let applied;
    try {
      if (!rule) throw new MissingRatingRuleError(cover.id, declaredAt);
      applied = rateDeclaration(cover, rule, si);
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : 'Could not rate this declaration.');
    }

    addDeal({
      clientId: cover.clientId,
      // Declaration linkage — this is what locks rates and hides manual markup.
      masterPolicyId: cover.id,
      declarationNumber: declarationNumber.trim(),
      declaredAt: new Date(declaredAt).toISOString(),
      ratingRuleId: rule!.id,
      clientRateApplied: applied.clientRatePercent,
      insurerRateApplied: applied.insurerRatePercent,
      rateOfExchange: parseNum(rateOfExchange),
      minimumPremiumApplied: applied.minimumPremiumApplied,

      // Inherited from the cover.
      dealType: 'New Business',
      typeOfInsurance: cover.typeOfInsurance || cover.policyType,
      productType: cover.productType,
      insuranceCompany: cover.insuranceCompany,
      currency: cover.currency,
      riskDetail: riskDetail || undefined,

      // Premium, from the rating engine. basicPremium is what the insurer
      // books and commission calculates on; the spread rides as markup.
      sumInsured: si,
      premiumType: 'Percentage from Sum Insured',
      premiumRatePercent: applied.clientRatePercent,
      basicPremium: applied.toDealPremiumFields.basicPremium,
      premiumMarkup: applied.toDealPremiumFields.premiumMarkup,
      premiumAmount: applied.clientPremium,

      // A declaration under a placed cover is already bound business.
      statusStage: 'Policy On Progress',
      approvalStatus: 'Approved',
      bindDate: new Date(declaredAt).toISOString(),
    });

    toast.success(`Declaration ${declarationNumber.trim()} added`);
    onClose();
  };

  const existingCount = deals.filter(d => d.masterPolicyId === cover.id).length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">New Declaration</h2>
              <p className="text-[13px] text-slate-500">
                {cover.policyNumber} · {client?.companyName || 'Unknown client'} · declaration {existingCount + 1}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <form id="declaration-form" onSubmit={submit} className="space-y-5">

            <section className="bg-white rounded-lg p-5 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Declaration Number" required>
                  <input type="text" value={declarationNumber}
                    onChange={e => setDeclarationNumber(e.target.value)}
                    className={inputClass} placeholder="e.g. DEC/2026/0148" />
                </Field>

                <Field label="Declaration Date" required hint="Selects the rating rule and fixes the FX rate.">
                  <input type="date" value={declaredAt}
                    onChange={e => setDeclaredAt(e.target.value)} className={inputClass} />
                </Field>

                <Field label={`Sum Insured (${cover.currency})`} required>
                  <input type="text" value={sumInsured}
                    onChange={e => setSumInsured(formatNumber(e.target.value))}
                    className={inputClass} placeholder="0" />
                </Field>

                <Field label="Rate of Exchange" hint={`Captured at the declaration date. ${cover.currency} → reporting currency.`}>
                  <input type="text" value={rateOfExchange}
                    onChange={e => setRateOfExchange(e.target.value.replace(/[^\d.]/g, ''))}
                    className={inputClass} placeholder="e.g. 16250" />
                </Field>

                <Field label="Risk Detail" className="md:col-span-2">
                  <textarea rows={2} value={riskDetail} onChange={e => setRiskDetail(e.target.value)}
                    className={cn(inputClass, 'resize-none')}
                    placeholder="Commodity, voyage, vessel, conveyance..." />
                </Field>
              </div>
            </section>

            {/* ---- Rating: read-only, no override ---- */}
            <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Rating — from the cover, not editable
                </span>
              </div>

              {!rule ? (
                <div className="p-5">
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-[13px] text-red-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">No rating rule in effect on {declaredAt}</div>
                      <div className="text-[12px] mt-0.5">
                        This declaration cannot be rated. Add a rating rule covering that date on the
                        cover, or change the declaration date. Nothing is rated at zero and no nearby
                        rule is substituted.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 space-y-3 text-[13px]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Client Rate</div>
                      <div className="text-[16px] font-bold text-slate-900 font-mono">{rule.clientRatePercent}%</div>
                    </div>
                    {isDual && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Insurer Rate</div>
                        <div className="text-[16px] font-bold text-slate-900 font-mono">
                          {rule.insurerRatePercent ?? '—'}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1">
                    Rule effective {rule.effectiveFrom.slice(0, 10)}
                    {rule.effectiveTo ? ` to ${rule.effectiveTo.slice(0, 10)}` : ' onwards'}
                    {rule.scope && ` · scope: ${rule.scope}`}
                  </div>

                  {rating && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Client premium</span>
                        <span className="font-mono font-bold text-slate-900">
                          {cover.currency} {money(rating.clientPremium)}
                        </span>
                      </div>
                      {isDual && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Insurer premium</span>
                            <span className="font-mono text-slate-800">
                              {cover.currency} {money(rating.insurerPremium)}
                            </span>
                          </div>
                          <div className="flex justify-between text-indigo-700">
                            <span className="font-medium">Spread</span>
                            <span className="font-mono font-semibold">
                              {cover.currency} {money(rating.spreadAmount)}
                            </span>
                          </div>
                        </>
                      )}
                      {rating.minimumPremiumApplied && (
                        <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                          Minimum premium applied
                          {rating.insurerFloored && rating.clientFloored ? ' to both sides'
                            : rating.insurerFloored ? ' to the insurer side'
                            : ' to the client side'}.
                          {isDual && ' The spread is the difference between the two floors.'}
                        </div>
                      )}
                      {rating.spreadIsNegative && (
                        <div className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
                          Negative spread — check the cover’s minimum premiums.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
            Cancel
          </button>
          <button type="submit" form="declaration-form" disabled={!canSubmit}
            className={cn(
              'px-5 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm transition-colors',
              canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed',
            )}>
            Add Declaration
          </button>
        </div>
      </div>
    </div>
  );
};
