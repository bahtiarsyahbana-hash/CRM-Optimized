import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { MasterPolicy, RatingRule } from '../../types';
import { X, Percent, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]';

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> =
  ({ label, required, hint, children }) => (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );

/**
 * Add or edit an effective-dated rating rule on a cover.
 *
 * Rates are percentages of sum insured, never of premium. Rules are dated so
 * that re-opening an old declaration recalculates at the rate that applied
 * then. Editing a rule does not disturb existing declarations — each one
 * snapshotted the rate it was written at.
 */
export const RatingRuleModal: React.FC<{
  cover: MasterPolicy;
  rule?: RatingRule | null;
  onClose: () => void;
}> = ({ cover, rule, onClose }) => {
  const { addRatingRule, updateRatingRule, ratingRules, deals } = useData();
  const isDual = cover.rateStructure === 'Dual Rate';

  const [clientRate, setClientRate] = useState(
    rule ? String(rule.clientRatePercent) : '');
  const [insurerRate, setInsurerRate] = useState(
    rule?.insurerRatePercent != null ? String(rule.insurerRatePercent) : '');
  const [effectiveFrom, setEffectiveFrom] = useState(
    rule ? rule.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState(
    rule?.effectiveTo ? rule.effectiveTo.slice(0, 10) : '');
  const [scope, setScope] = useState(rule?.scope || '');

  const client = parseFloat(clientRate);
  const insurer = insurerRate === '' ? null : parseFloat(insurerRate);

  const validation = useMemo(() => {
    if (!clientRate || isNaN(client)) return 'Enter a client rate.';
    if (client <= 0) return 'Client rate must be greater than zero.';
    if (isDual) {
      if (insurer === null || isNaN(insurer)) return 'Dual Rate covers need an insurer rate.';
      if (insurer <= 0) return 'Insurer rate must be greater than zero.';
      if (insurer > client) return 'Insurer rate cannot exceed the client rate — that is a negative spread.';
    }
    if (effectiveTo && effectiveTo <= effectiveFrom) return 'Effective To must be after Effective From.';
    return null;
  }, [clientRate, client, insurer, insurerRate, isDual, effectiveFrom, effectiveTo]);

  const spread = isDual && insurer !== null && !isNaN(insurer) && !isNaN(client)
    ? client - insurer
    : null;

  // Declarations already written under this cover are unaffected by an edit —
  // worth saying, because it is the opposite of what people expect.
  const affected = rule ? deals.filter(d => d.ratingRuleId === rule.id).length : 0;

  // Warn when the new window overlaps an existing rule; the resolver prefers
  // the latest effectiveFrom, so this is legal but worth surfacing.
  const overlaps = useMemo(() => {
    const from = new Date(effectiveFrom).getTime();
    const to = effectiveTo ? new Date(effectiveTo).getTime() : Infinity;
    return ratingRules.filter(r =>
      r.masterPolicyId === cover.id &&
      r.id !== rule?.id &&
      (r.scope || '') === scope &&
      new Date(r.effectiveFrom).getTime() < to &&
      (r.effectiveTo ? new Date(r.effectiveTo).getTime() : Infinity) > from
    ).length;
  }, [ratingRules, cover.id, rule?.id, effectiveFrom, effectiveTo, scope]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validation) return toast.error(validation);

    const payload = {
      masterPolicyId: cover.id,
      scope: scope.trim() || undefined,
      clientRatePercent: client,
      // Single Rate covers store null — the client rate applies to both sides.
      insurerRatePercent: isDual ? insurer : null,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
    };

    if (rule) {
      updateRatingRule(rule.id, payload);
      toast.success('Rating rule updated');
    } else {
      addRatingRule(payload);
      toast.success('Rating rule added');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                {rule ? 'Edit Rating Rule' : 'New Rating Rule'}
              </h2>
              <p className="text-[12px] text-slate-500">
                {cover.policyNumber} · {cover.rateStructure}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="rating-rule-form" onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Rate %" required hint="Of sum insured.">
              <input type="number" step="0.0001" min="0" value={clientRate}
                onChange={e => setClientRate(e.target.value)} className={inputClass} placeholder="e.g. 0.25" />
            </Field>

            {isDual ? (
              <Field label="Insurer Rate %" required hint="Of sum insured. Commission calculates on this.">
                <input type="number" step="0.0001" min="0" value={insurerRate}
                  onChange={e => setInsurerRate(e.target.value)} className={inputClass} placeholder="e.g. 0.18" />
              </Field>
            ) : (
              <Field label="Insurer Rate %" hint="Single Rate cover — the client rate applies to both sides.">
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-[13px] text-slate-400 italic">
                  not applicable
                </div>
              </Field>
            )}
          </div>

          {spread !== null && (
            <div className={cn(
              'text-[12px] rounded-md px-3 py-2 flex items-center justify-between border',
              spread < 0
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800',
            )}>
              <span>Spread {spread < 0 && '(negative)'}</span>
              <span className="font-mono font-bold">{spread.toFixed(4)}%</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Effective From" required hint="Inclusive.">
              <input type="date" value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Effective To" hint="Exclusive. Blank means open-ended.">
              <input type="date" value={effectiveTo}
                onChange={e => setEffectiveTo(e.target.value)} className={inputClass} />
            </Field>
          </div>

          <Field label="Scope" hint="Optional — e.g. a commodity or voyage class. Blank makes this the cover default.">
            <input type="text" value={scope} onChange={e => setScope(e.target.value)}
              className={inputClass} placeholder="Leave blank for all declarations" />
          </Field>

          {overlaps > 0 && (
            <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Overlaps {overlaps} existing rule{overlaps === 1 ? '' : 's'} on the same scope. That is allowed —
                the rule with the later Effective From wins, so this will act as a correction over it.
              </span>
            </div>
          )}

          {affected > 0 && (
            <div className="text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              {affected} existing declaration{affected === 1 ? '' : 's'} used this rule. They keep the rate they were
              written at — editing here only affects declarations made from now on.
            </div>
          )}

          {validation && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {validation}
            </div>
          )}
        </form>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
            Cancel
          </button>
          <button type="submit" form="rating-rule-form" disabled={Boolean(validation)}
            className={cn(
              'px-4 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm transition-colors',
              validation ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
            )}>
            {rule ? 'Save Rule' : 'Add Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};
