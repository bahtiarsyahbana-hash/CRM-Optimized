import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Insurer } from '../../types';
import { insurerUsage, canHardDeleteInsurer } from '../../utils/insurers';
import {
  Plus, Search, Building, Edit2, Trash2, AlertTriangle, X, Percent, Users2, FileText, Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { InsurerForm } from './InsurerForm';

type StatusFilter = 'Active' | 'Inactive' | 'All';
type SortKey = 'name' | 'code' | 'commissionRatePercent';

export const InsurersView = () => {
  const {
    insurers, deals, masterPolicies, removeInsurer, updateInsurer, insurerMigrationReport,
  } = useData();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Active');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editInsurer, setEditInsurer] = useState<Insurer | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<Insurer | null>(null);
  const [showReport, setShowReport] = useState(false);

  const usageOf = (id: string) => insurerUsage(id, deals, masterPolicies);

  const counts = useMemo(() => ({
    Active: insurers.filter(i => i.active).length,
    Inactive: insurers.filter(i => !i.active).length,
    All: insurers.length,
  }), [insurers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = insurers.filter(i => {
      if (status === 'Active' && !i.active) return false;
      if (status === 'Inactive' && i.active) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q) ||
        i.contacts.some(c => c.name.toLowerCase().includes(q))
      );
    });
    return [...rows].sort((a, b) => {
      if (sortKey === 'commissionRatePercent') {
        const av = a.commissionRatePercent ?? -1;
        const bv = b.commissionRatePercent ?? -1;
        return sortAsc ? av - bv : bv - av;
      }
      const av = (a[sortKey] || '').toString().toLowerCase();
      const bv = (b[sortKey] || '').toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [insurers, search, status, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const confirmRemove = () => {
    if (!removeCandidate) return;
    const what = removeInsurer(removeCandidate.id);
    toast.success(what === 'deleted'
      ? `${removeCandidate.name} deleted.`
      : `${removeCandidate.name} deactivated — it is referenced by existing records.`);
    setRemoveCandidate(null);
  };

  const unmatchedCount = (insurerMigrationReport?.dealsUnmatched.length ?? 0)
    + (insurerMigrationReport?.masterPoliciesUnmatched.length ?? 0);

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50">
      <div className="flex justify-between items-start mb-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Insurers</h1>
          <p className="text-[13px] text-slate-500">
            The panel. Selected on deals and master policies, and the source of each insurer’s
            default commission rate.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Insurer
        </button>
      </div>

      {/* Migration outcome — surfaced rather than buried in storage. */}
      {insurerMigrationReport && (
        <div className={cn(
          'mb-5 rounded-md border px-4 py-3 text-[13px] shrink-0',
          unmatchedCount > 0
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-700',
        )}>
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>
                Catalogue seeded with <strong>{insurerMigrationReport.seededInsurers}</strong> insurers.
                {' '}Linked <strong>{insurerMigrationReport.dealsMatched}</strong> of{' '}
                {insurerMigrationReport.dealsTotal} deals and{' '}
                <strong>{insurerMigrationReport.masterPoliciesMatched}</strong> of{' '}
                {insurerMigrationReport.masterPoliciesTotal} master policies to an insurer record.
              </span>
              {unmatchedCount > 0 && (
                <button
                  onClick={() => setShowReport(true)}
                  className="ml-2 font-semibold underline hover:no-underline"
                >
                  {unmatchedCount} record{unmatchedCount === 1 ? '' : 's'} did not match — review
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, code, email or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['Active', 'Inactive', 'All'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                  status === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {s} ({counts[s]})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th onClick={() => toggleSort('code')}
                  className="px-6 py-3 font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-900 w-24">
                  Code {sortKey === 'code' && <span className="text-slate-400">{sortAsc ? '▲' : '▼'}</span>}
                </th>
                <th onClick={() => toggleSort('name')}
                  className="px-6 py-3 font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-900">
                  Name {sortKey === 'name' && <span className="text-slate-400">{sortAsc ? '▲' : '▼'}</span>}
                </th>
                <th className="px-6 py-3 font-semibold text-slate-600">Contact</th>
                <th onClick={() => toggleSort('commissionRatePercent')}
                  className="px-6 py-3 font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-900 text-right">
                  Commission {sortKey === 'commissionRatePercent' && <span className="text-slate-400">{sortAsc ? '▲' : '▼'}</span>}
                </th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-center">Used by</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(i => {
                const usage = usageOf(i.id);
                return (
                  <tr
                    key={i.id}
                    onClick={() => setEditInsurer(i)}
                    className={cn(
                      'hover:bg-slate-50 transition-colors group cursor-pointer',
                      !i.active && 'opacity-60',
                    )}
                  >
                    <td className="px-6 py-3">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {i.code}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{i.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2.5 mt-0.5">
                        {i.email && <span>{i.email}</span>}
                        {i.contacts.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users2 className="w-3 h-3" />{i.contacts.length} contact{i.contacts.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {i.documents.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="w-3 h-3" />{i.documents.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {i.contacts[0]
                        ? <>
                            {i.contacts[0].name}
                            {i.contacts[0].scope && <span className="text-slate-400"> · {i.contacts[0].scope}</span>}
                          </>
                        : <span className="text-slate-400 italic">none</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {i.commissionRatePercent != null
                        ? <span className="font-mono font-semibold text-slate-800">{i.commissionRatePercent}%</span>
                        : <span className="text-slate-400 italic text-[12px]">not set</span>}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        title={`${usage.deals} deal(s), ${usage.masterPolicies} master polic(ies)`}
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                          usage.total > 0
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200',
                        )}
                      >
                        {usage.total}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                        i.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200',
                      )}>
                        {i.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => e.stopPropagation()}
                      >
                        {!i.active && (
                          <button
                            onClick={() => { updateInsurer(i.id, { active: true }); toast.success(`${i.name} reactivated.`); }}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => setEditInsurer(i)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {i.active && (
                          <button
                            onClick={() => setRemoveCandidate(i)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={usage.total > 0 ? 'Deactivate — referenced by existing records' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <Building className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-medium text-slate-900 mb-1">
                {insurers.length === 0 ? 'No insurers yet' : 'Nothing matches this filter'}
              </p>
            </div>
          )}
        </div>
      </div>

      {isAddOpen && <InsurerForm onClose={() => setIsAddOpen(false)} />}
      {editInsurer && <InsurerForm insurer={editInsurer} onClose={() => setEditInsurer(null)} />}

      {/* ---- Unmatched migration records ---- */}
      {showReport && insurerMigrationReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Records without an insurer link</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  These kept their insurer name but could not be matched to a catalogue record, so
                  their commission rate cannot resolve from an insurer. Set the insurer on each to fix it.
                </p>
              </div>
              <button onClick={() => setShowReport(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-[13px]">
              {insurerMigrationReport.dealsUnmatched.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Deals ({insurerMigrationReport.dealsUnmatched.length})
                  </div>
                  <div className="space-y-1.5">
                    {insurerMigrationReport.dealsUnmatched.map(d => (
                      <div key={d.id} className="border border-slate-200 rounded px-3 py-2">
                        <div className="font-medium text-slate-800">{d.insuranceCompany}</div>
                        <div className="text-[11px] text-slate-500">{d.reason} · deal {d.id.slice(0, 8)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {insurerMigrationReport.masterPoliciesUnmatched.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Master policies ({insurerMigrationReport.masterPoliciesUnmatched.length})
                  </div>
                  <div className="space-y-1.5">
                    {insurerMigrationReport.masterPoliciesUnmatched.map(m => (
                      <div key={m.id} className="border border-slate-200 rounded px-3 py-2">
                        <div className="font-medium text-slate-800">{m.policyNumber} — {m.insuranceCompany}</div>
                        <div className="text-[11px] text-slate-500">{m.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Remove: delete or deactivate ---- */}
      {removeCandidate && (() => {
        const usage = usageOf(removeCandidate.id);
        const hard = canHardDeleteInsurer(usage);
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  hard ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
                )}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-slate-900">
                    {hard ? 'Delete insurer?' : 'Deactivate insurer?'}
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {hard ? 'Not referenced anywhere — safe to remove.' : 'Referenced by existing records.'}
                  </p>
                </div>
                <button onClick={() => setRemoveCandidate(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 text-[13px] text-slate-700 space-y-2">
                <p><span className="font-semibold">{removeCandidate.name}</span> ({removeCandidate.code})</p>
                {!hard && (
                  <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Used by {usage.deals} deal{usage.deals === 1 ? '' : 's'} and {usage.masterPolicies} master
                    polic{usage.masterPolicies === 1 ? 'y' : 'ies'}. It will be deactivated instead of deleted —
                    hidden from pickers, while those records keep resolving their insurer. Reactivate any time.
                  </p>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
                <button onClick={() => setRemoveCandidate(null)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
                  Cancel
                </button>
                <button
                  onClick={confirmRemove}
                  className={cn(
                    'px-4 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm flex items-center gap-1.5',
                    hard ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700',
                  )}
                >
                  <Trash2 className="w-4 h-4" /> {hard ? 'Delete' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
