import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { MasterPolicy, MasterPolicyType, MASTER_POLICY_TYPES } from '../../types';
import { Plus, Search, Umbrella, FileCheck, Edit2, Trash2, AlertTriangle, X, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { MasterPolicyForm } from './MasterPolicyForm';

/**
 * One page, one list. Open Cover and Certificate are two *types* of master
 * policy, not two pages — so the type is a column and a filter, never a tab.
 */
type TypeFilter = 'All' | MasterPolicyType;

const TYPE_META: Record<MasterPolicyType, { icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  'Open Cover': { icon: Umbrella, badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Certificate': { icon: FileCheck, badge: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export const MasterPoliciesView = () => {
  const { masterPolicies, ratingRules, clients, deals, deleteMasterPolicy } = useData();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<MasterPolicy | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<MasterPolicy | null>(null);

  const counts = useMemo(() => {
    const base: Record<TypeFilter, number> = { All: masterPolicies.length, 'Open Cover': 0, 'Certificate': 0 };
    masterPolicies.forEach(mp => { base[mp.policyType] += 1; });
    return base;
  }, [masterPolicies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return masterPolicies
      .filter(mp => {
        if (typeFilter !== 'All' && mp.policyType !== typeFilter) return false;
        if (!q) return true;
        const client = clients.find(c => c.id === mp.clientId);
        return (
          mp.policyNumber.toLowerCase().includes(q) ||
          (client?.companyName || '').toLowerCase().includes(q) ||
          (mp.typeOfInsurance || '').toLowerCase().includes(q) ||
          (mp.insuranceCompany || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [masterPolicies, typeFilter, search, clients]);

  const declarationCount = (id: string) => deals.filter(d => d.masterPolicyId === id).length;
  const ruleCount = (id: string) => ratingRules.filter(r => r.masterPolicyId === id).length;

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    deleteMasterPolicy(deleteCandidate.id);
    toast.success(`${deleteCandidate.policyNumber} removed.`);
    setDeleteCandidate(null);
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Master Policies</h1>
          <p className="text-[13px] text-slate-500">
            Open covers and certificates. Declarations rate from each cover’s rating rules.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Master Policy
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by policy number, client, type or insurer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Type filter — not tabs. */}
          <div className="flex items-center gap-1.5">
            {(['All', ...MASTER_POLICY_TYPES] as TypeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                  typeFilter === t
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {t === 'All' ? 'All' : t} ({counts[t]})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Policy Number</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Type</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Client</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Cover</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Rate Structure</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Period</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-center">Declarations</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(mp => {
                const client = clients.find(c => c.id === mp.clientId);
                const meta = TYPE_META[mp.policyType];
                const Icon = meta.icon;
                const rules = ruleCount(mp.id);
                return (
                  <tr key={mp.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{mp.policyNumber}</div>
                      {rules === 0 && (
                        <div className="text-[11px] text-amber-700 mt-0.5">No rating rules yet</div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                        meta.badge,
                      )}>
                        <Icon className="w-3 h-3" />
                        {mp.policyType}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-slate-800">{client?.companyName || 'Unknown Client'}</div>
                      <div className="text-[11px] text-slate-500">{mp.lineOfBusiness}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-slate-700">{mp.typeOfInsurance || '—'}</div>
                      <div className="text-[11px] text-slate-500">{mp.insuranceCompany || 'No insurer set'}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                        mp.rateStructure === 'Dual Rate'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200',
                      )}>
                        {mp.rateStructure}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">{mp.currency}</div>
                    </td>
                    <td className="px-6 py-3 text-slate-600 text-[12px]">
                      {mp.periodStart ? new Date(mp.periodStart).toLocaleDateString() : 'TBA'}
                      {' → '}
                      {mp.periodEnd ? new Date(mp.periodEnd).toLocaleDateString() : 'TBA'}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                        declarationCount(mp.id) > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200',
                      )}>
                        {declarationCount(mp.id)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditPolicy(mp)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(mp)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500 flex flex-col justify-center items-center">
              <Layers className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-medium text-slate-900 mb-1">
                {masterPolicies.length === 0 ? 'No master policies yet' : 'Nothing matches this filter'}
              </p>
              <p className="text-[13px] text-slate-500 mb-4">
                {masterPolicies.length === 0
                  ? 'Create an open cover or a certificate to declare shipments against.'
                  : 'Try another type filter or clear your search.'}
              </p>
              {masterPolicies.length === 0 && (
                <button onClick={() => setIsAddOpen(true)} className="text-blue-600 text-[13px] font-bold hover:underline">
                  Create a Master Policy
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isAddOpen && <MasterPolicyForm onClose={() => setIsAddOpen(false)} />}
      {editPolicy && <MasterPolicyForm policy={editPolicy} onClose={() => setEditPolicy(null)} />}

      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-slate-900">Delete master policy?</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
              <button onClick={() => setDeleteCandidate(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[13px] text-slate-700">
              <p>
                Removing <span className="font-semibold">{deleteCandidate.policyNumber}</span> also deletes
                its {ruleCount(deleteCandidate.id)} rating rule{ruleCount(deleteCandidate.id) === 1 ? '' : 's'}.
              </p>
              {declarationCount(deleteCandidate.id) > 0 && (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  {declarationCount(deleteCandidate.id)} declaration
                  {declarationCount(deleteCandidate.id) === 1 ? '' : 's'} reference this cover. They will remain
                  but lose their link, and their rates can no longer be recalculated.
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button onClick={() => setDeleteCandidate(null)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
