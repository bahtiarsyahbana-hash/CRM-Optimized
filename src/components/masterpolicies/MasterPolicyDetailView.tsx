import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { MasterPolicy, RatingRule, Deal } from '../../types';
import { rateDeclaration } from '../../utils/masterPolicyRating';
import {
  ArrowLeft, Umbrella, FileCheck, Plus, Percent, Edit2, Trash2,
  AlertTriangle, Lock, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { RatingRuleModal } from './RatingRuleModal';
import { DeclarationModal } from './DeclarationModal';

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A master policy's detail view holds its own rating rules and declarations.
 * Declarations do not appear in Submissions or Pipeline — this is where they
 * live.
 */
export const MasterPolicyDetailView: React.FC<{
  policy: MasterPolicy;
  onBack: () => void;
}> = ({ policy: initial, onBack }) => {
  const { masterPolicies, ratingRules, clients, deals, deleteRatingRule } = useData();

  // Always read the freshest copy so edits reflect immediately.
  const cover = masterPolicies.find(mp => mp.id === initial.id) || initial;
  const client = clients.find(c => c.id === cover.clientId) || null;
  const isDual = cover.rateStructure === 'Dual Rate';

  const [ruleModal, setRuleModal] = useState<{ open: boolean; rule?: RatingRule | null }>({ open: false });
  const [declOpen, setDeclOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<RatingRule | null>(null);

  const rules = useMemo(
    () => ratingRules
      .filter(r => r.masterPolicyId === cover.id)
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()),
    [ratingRules, cover.id],
  );

  const declarations = useMemo(
    () => deals
      .filter(d => d.masterPolicyId === cover.id)
      .sort((a, b) => new Date(b.declaredAt || b.createdAt).getTime()
                    - new Date(a.declaredAt || a.createdAt).getTime()),
    [deals, cover.id],
  );

  const totals = useMemo(() => declarations.reduce((acc, d) => ({
    sumInsured: acc.sumInsured + (d.sumInsured || 0),
    client: acc.client + (d.premiumAmount || 0),
    insurer: acc.insurer + (d.basicPremium || 0),
    spread: acc.spread + (d.premiumMarkup || 0),
  }), { sumInsured: 0, client: 0, insurer: 0, spread: 0 }), [declarations]);

  const TypeIcon = cover.policyType === 'Open Cover' ? Umbrella : FileCheck;

  const confirmDeleteRule = () => {
    if (!ruleToDelete) return;
    deleteRatingRule(ruleToDelete.id);
    toast.success('Rating rule removed');
    setRuleToDelete(null);
  };

  const usageCount = (ruleId: string) => deals.filter(d => d.ratingRuleId === ruleId).length;

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors" title="Back to master policies">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{cover.policyNumber}</h1>
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                cover.policyType === 'Open Cover'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200',
              )}>
                <TypeIcon className="w-3 h-3" />
                {cover.policyType}
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {client?.companyName || 'Unknown client'} · {cover.typeOfInsurance || 'No type set'} · {cover.insuranceCompany || 'No insurer'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className={cn(
            'px-2.5 py-1 rounded-full text-[12px] font-semibold border',
            isDual ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200',
          )}>
            {cover.rateStructure}
          </span>
          <div className="text-[11px] text-slate-500 mt-1">{cover.currency}</div>
        </div>
      </div>

      {/* Cover summary */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
        <Summary label="Period" value={
          `${cover.periodStart ? new Date(cover.periodStart).toLocaleDateString() : 'TBA'} → ${cover.periodEnd ? new Date(cover.periodEnd).toLocaleDateString() : 'TBA'}`} />
        <Summary label="Declarations" value={String(declarations.length)} />
        <Summary label="Sum insured declared" value={`${cover.currency} ${money(totals.sumInsured)}`} />
        <Summary label="Client premium" value={`${cover.currency} ${money(totals.client)}`} />
        {isDual && (
          <>
            <Summary label="Insurer premium" value={`${cover.currency} ${money(totals.insurer)}`} />
            <Summary label="Spread earned" value={`${cover.currency} ${money(totals.spread)}`} tone="indigo" />
          </>
        )}
        {(cover.minimumPremiumClient || cover.minimumPremiumInsurer) && (
          <Summary
            label="Minimum premium"
            value={isDual
              ? `${money(cover.minimumPremiumInsurer ?? 0)} / ${money(cover.minimumPremiumClient ?? 0)}`
              : money(cover.minimumPremiumClient ?? 0)}
            hint={isDual ? 'insurer / client' : undefined}
          />
        )}
        {cover.sumInsuredLimit != null && (
          <Summary label="Cover limit" value={`${cover.currency} ${money(cover.sumInsuredLimit)}`} />
        )}
      </div>

      {/* ---- Rating rules ---- */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] mb-6">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Rating Rules</h2>
            <p className="text-[12px] text-slate-500">
              Percent of sum insured, effective-dated. A declaration rates at the rule in force on its own date.
            </p>
          </div>
          <button
            onClick={() => setRuleModal({ open: true })}
            className="px-3 py-1.5 text-[12px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-md flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="p-6">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-[13px] text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">No rating rules yet</div>
                <div className="text-[12px] mt-0.5">
                  Declarations cannot be rated until a rule exists. Add one covering the dates you expect to declare.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#f8fafc] border-b border-slate-200">
              <tr>
                <th className="px-5 py-2 font-semibold text-slate-600">Effective</th>
                <th className="px-5 py-2 font-semibold text-slate-600">Scope</th>
                <th className="px-5 py-2 font-semibold text-slate-600 text-right">Client Rate</th>
                {isDual && <th className="px-5 py-2 font-semibold text-slate-600 text-right">Insurer Rate</th>}
                {isDual && <th className="px-5 py-2 font-semibold text-slate-600 text-right">Spread</th>}
                <th className="px-5 py-2 font-semibold text-slate-600 text-center">Used</th>
                <th className="px-5 py-2 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map(r => {
                // Derived every time — the spread is never stored.
                const spread = r.insurerRatePercent === null ? null : r.clientRatePercent - r.insurerRatePercent;
                return (
                  <tr key={r.id} className="hover:bg-slate-50 group">
                    <td className="px-5 py-2.5 text-slate-700">
                      {r.effectiveFrom.slice(0, 10)}
                      <span className="text-slate-400"> → </span>
                      {r.effectiveTo ? r.effectiveTo.slice(0, 10) : <span className="text-slate-400">open</span>}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {r.scope || <span className="text-slate-400 italic">default</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-slate-900 font-semibold">{r.clientRatePercent}%</td>
                    {isDual && (
                      <td className="px-5 py-2.5 text-right font-mono text-slate-700">
                        {r.insurerRatePercent ?? '—'}%
                      </td>
                    )}
                    {isDual && (
                      <td className="px-5 py-2.5 text-right font-mono text-indigo-700 font-semibold">
                        {spread === null ? '—' : `${spread.toFixed(4)}%`}
                      </td>
                    )}
                    <td className="px-5 py-2.5 text-center text-slate-500">{usageCount(r.id)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setRuleModal({ open: true, rule: r })}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setRuleToDelete(r)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Declarations ---- */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Declarations</h2>
            <p className="text-[12px] text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Rates come from the cover and cannot be overridden.
            </p>
          </div>
          <button
            onClick={() => setDeclOpen(true)}
            disabled={rules.length === 0}
            title={rules.length === 0 ? 'Add a rating rule first' : undefined}
            className={cn(
              'px-3 py-1.5 text-[12px] font-semibold rounded-md flex items-center gap-1.5 transition-colors',
              rules.length === 0
                ? 'text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm',
            )}
          >
            <Plus className="w-3.5 h-3.5" /> New Declaration
          </button>
        </div>

        {declarations.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Percent className="w-9 h-9 text-slate-300 mb-3 mx-auto" />
            <p className="font-medium text-slate-900 mb-1">No declarations yet</p>
            <p className="text-[13px]">
              {rules.length === 0
                ? 'Add a rating rule, then declare against this cover.'
                : 'Declare a shipment or risk against this cover.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] border-b border-slate-200">
              <tr>
                <th className="px-5 py-2 font-semibold text-slate-600">Declaration</th>
                <th className="px-5 py-2 font-semibold text-slate-600">Date</th>
                <th className="px-5 py-2 font-semibold text-slate-600 text-right">Sum Insured</th>
                <th className="px-5 py-2 font-semibold text-slate-600 text-right">Rate</th>
                <th className="px-5 py-2 font-semibold text-slate-600 text-right">Client Premium</th>
                {isDual && <th className="px-5 py-2 font-semibold text-slate-600 text-right">Insurer Premium</th>}
                {isDual && <th className="px-5 py-2 font-semibold text-slate-600 text-right">Spread</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {declarations.map((d: Deal) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <div className="font-semibold text-slate-900">{d.declarationNumber || '—'}</div>
                    {d.minimumPremiumApplied && (
                      <div className="text-[10px] text-amber-700">minimum applied</div>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {d.declaredAt ? new Date(d.declaredAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-slate-700">{money(d.sumInsured || 0)}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-slate-600">
                    {d.clientRateApplied != null ? `${d.clientRateApplied}%` : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-900">
                    {money(d.premiumAmount || 0)}
                  </td>
                  {isDual && (
                    <td className="px-5 py-2.5 text-right font-mono text-slate-700">{money(d.basicPremium || 0)}</td>
                  )}
                  {isDual && (
                    <td className="px-5 py-2.5 text-right font-mono text-indigo-700 font-semibold">
                      {money(d.premiumMarkup || 0)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ruleModal.open && (
        <RatingRuleModal cover={cover} rule={ruleModal.rule} onClose={() => setRuleModal({ open: false })} />
      )}
      {declOpen && (
        <DeclarationModal cover={cover} client={client} rules={rules} onClose={() => setDeclOpen(false)} />
      )}

      {ruleToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-slate-900">Delete rating rule?</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
              <button onClick={() => setRuleToDelete(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-[13px] text-slate-700 space-y-2">
              <p>
                Rule effective {ruleToDelete.effectiveFrom.slice(0, 10)}, client rate {ruleToDelete.clientRatePercent}%.
              </p>
              {usageCount(ruleToDelete.id) > 0 && (
                <p className="text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                  {usageCount(ruleToDelete.id)} declaration{usageCount(ruleToDelete.id) === 1 ? '' : 's'} were rated
                  from this rule. They keep the rate they were written at — but the lineage link will be broken.
                </p>
              )}
              <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Removing a rule can leave a gap in the effective dates. Declarations dated inside a gap are blocked
                rather than rated at a neighbouring rate.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button onClick={() => setRuleToDelete(null)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
                Cancel
              </button>
              <button onClick={confirmDeleteRule} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm">
                Delete rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Summary: React.FC<{ label: string; value: string; hint?: string; tone?: 'indigo' }> =
  ({ label, value, hint, tone }) => (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className={cn('font-semibold mt-0.5', tone === 'indigo' ? 'text-indigo-700' : 'text-slate-900')}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
