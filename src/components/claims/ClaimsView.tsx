import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import {
  Claim,
  ClaimStatus,
  CLAIM_PROGRESSION,
  TERMINAL_CLAIM_STATUSES,
} from '../../types';
import { ShieldAlert, Search, Filter, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type StatusFilter = 'all' | ClaimStatus;

const ALL_STATUSES: ClaimStatus[] = [
  'Claim Registered',
  'Pending',
  'Under Assessment',
  'Approved',
  'Settled',
  'Reject',
];

const statusBadgeColor = (status: ClaimStatus): string => {
  switch (status) {
    case 'Claim Registered': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Pending': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'Under Assessment': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Settled': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'Reject': return 'bg-red-50 text-red-700 border-red-200';
  }
};

/**
 * Determine which statuses a claim can move to.
 * Linear: only the next stage in progression is allowed.
 * Reject: allowed from any non-terminal status.
 * Terminal (Settled / Reject): locked, no transitions allowed.
 */
function allowedNextStatuses(current: ClaimStatus): ClaimStatus[] {
  if (TERMINAL_CLAIM_STATUSES.includes(current)) return [];
  const idx = CLAIM_PROGRESSION.indexOf(current);
  const next: ClaimStatus[] = [];
  // Same status (no-op, but keeps the dropdown showing the current value)
  next.push(current);
  // Next step in linear progression
  if (idx >= 0 && idx < CLAIM_PROGRESSION.length - 1) {
    next.push(CLAIM_PROGRESSION[idx + 1]);
  }
  // Reject is an off-ramp from any non-terminal status
  if (!next.includes('Reject')) next.push('Reject');
  return next;
}

export const ClaimsView = () => {
  const { claims, deals, clients, updateClaimStatus } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const formatDate = (iso?: string) => {
    if (!iso) return '-';
    try {
      return format(new Date(iso), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (amount == null) return '-';
    return `${currency || ''} ${amount.toLocaleString()}`.trim();
  };

  // Compose richer rows by joining claim → deal → client.
  const enrichedClaims = useMemo(() => {
    return claims.map(claim => {
      const deal = deals.find(d => d.id === claim.dealId);
      const client = deal ? clients.find(c => c.id === deal.clientId) : undefined;
      return {
        claim,
        clientName: client?.companyName || 'Unknown Client',
        insuranceCompany: claim.insuranceCompany || deal?.insuranceCompany || '-',
        typeOfInsurance: deal?.typeOfInsurance || '-',
      };
    });
  }, [claims, deals, clients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enrichedClaims
      .filter(({ claim, clientName, insuranceCompany, typeOfInsurance }) => {
        const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
        const matchesSearch =
          !q ||
          claim.title.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q) ||
          insuranceCompany.toLowerCase().includes(q) ||
          typeOfInsurance.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(b.claim.dateRegistered).getTime() - new Date(a.claim.dateRegistered).getTime());
  }, [enrichedClaims, search, statusFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: enrichedClaims.length };
    for (const s of ALL_STATUSES) map[s] = 0;
    enrichedClaims.forEach(({ claim }) => { map[claim.status] = (map[claim.status] || 0) + 1; });
    return map;
  }, [enrichedClaims]);

  const handleStatusChange = (claim: Claim, next: ClaimStatus) => {
    if (next === claim.status) return;
    const allowed = allowedNextStatuses(claim.status);
    if (!allowed.includes(next)) {
      toast.error(`Cannot move from "${claim.status}" to "${next}".`);
      return;
    }
    if (TERMINAL_CLAIM_STATUSES.includes(next)) {
      const ok = window.confirm(
        `Moving this claim to "${next}" will lock it. You won't be able to change the status afterwards. Continue?`
      );
      if (!ok) return;
    }
    updateClaimStatus(claim.id, next);
    toast.success(`Claim moved to ${next}`);
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 relative">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Claims Management</h1>
          <p className="text-[13px] text-slate-500">Track every registered claim through to settlement. Submit new claims from the Policies menu.</p>
        </div>
      </div>

      {/* Pipeline-style status filter pills */}
      <div className="mb-4 bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2 mr-2 pl-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</span>
        </div>
        <FilterPill label={`All (${counts.all})`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        {ALL_STATUSES.map(s => (
          <FilterPill
            key={s}
            label={`${s} (${counts[s] || 0})`}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            color={statusBadgeColor(s)}
          />
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-md shrink-0">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by claim title, client, or insurance..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 overflow-auto">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
          <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">Claim</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Client</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Insurance</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Date Registered</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Date Reported</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">Est. Amount</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(({ claim, clientName, insuranceCompany, typeOfInsurance }) => {
              const isLocked = TERMINAL_CLAIM_STATUSES.includes(claim.status);
              const allowed = allowedNextStatuses(claim.status);
              return (
                <tr key={claim.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{claim.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 max-w-[280px] truncate" title={claim.description}>
                          {claim.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{clientName}</div>
                    <div className="text-[11px] text-slate-500">{typeOfInsurance}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{insuranceCompany}</td>
                  <td className="px-4 py-3 text-slate-700 text-[12px]">{formatDate(claim.dateRegistered)}</td>
                  <td className="px-4 py-3 text-slate-700 text-[12px]">{formatDate(claim.dateReported)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-800">
                    {formatAmount(claim.estimatedAmount, claim.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase whitespace-nowrap', statusBadgeColor(claim.status))}>
                        {claim.status}
                      </span>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" title="Status is locked because this claim has reached a terminal state.">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <select
                          value={claim.status}
                          onChange={(e) => handleStatusChange(claim, e.target.value as ClaimStatus)}
                          className="text-[11px] bg-white border border-slate-200 rounded text-slate-700 px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
                          title="Move to next status or Reject"
                        >
                          {allowed.map(s => (
                            <option key={s} value={s}>{s === claim.status ? `${s} (current)` : `→ ${s}`}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-slate-500 text-[13px]">
                  {claims.length === 0 ? (
                    <div className="flex flex-col items-center">
                      <ShieldAlert className="w-10 h-10 text-slate-300 mb-2" />
                      <div className="font-semibold text-slate-700 mb-1">No claims registered yet</div>
                      <div className="text-[12px]">Submit a new claim from the Policies menu to see it here.</div>
                    </div>
                  ) : (
                    'No claims match the current filter.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FilterPill: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string }> = ({ label, active, onClick, color }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-3 py-1 text-[12px] font-semibold rounded transition-colors border',
      active
        ? 'bg-slate-900 text-white border-slate-900'
        : color
          ? `${color} hover:opacity-80`
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    )}
  >
    {label}
  </button>
);