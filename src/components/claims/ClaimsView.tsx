import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import {
  Claim,
  ClaimStatus,
  Currency,
  CURRENCIES,
  CLAIM_PROGRESSION,
  TERMINAL_CLAIM_STATUSES,
} from '../../types';
import {
  ShieldAlert,
  Search,
  Filter,
  Lock,
  Plus,
  X,
  Check,
  ArrowRight,
  Ban,
  Building2,
  Calendar,
  CircleDollarSign,
  FileText,
} from 'lucide-react';
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
 * Determines the single next stage in the linear claim progression.
 * Returns null if the claim is already at the last linear step or in a terminal state.
 */
function nextLinearStage(current: ClaimStatus): ClaimStatus | null {
  if (TERMINAL_CLAIM_STATUSES.includes(current)) return null;
  const idx = CLAIM_PROGRESSION.indexOf(current);
  if (idx < 0 || idx >= CLAIM_PROGRESSION.length - 1) return null;
  return CLAIM_PROGRESSION[idx + 1];
}

export const ClaimsView = () => {
  const { claims, deals, clients, updateClaimStatus } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

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

  const selectedClaim = selectedClaimId ? claims.find(c => c.id === selectedClaimId) : null;

  const handleAdvanceStatus = (claim: Claim) => {
    const next = nextLinearStage(claim.status);
    if (!next) return;
    if (TERMINAL_CLAIM_STATUSES.includes(next)) {
      const ok = window.confirm(
        `Moving this claim to "${next}" will lock it. You won't be able to change the status afterwards. Continue?`
      );
      if (!ok) return;
    }
    updateClaimStatus(claim.id, next);
    toast.success(`Claim moved to ${next}`);
  };

  const handleReject = (claim: Claim) => {
    const ok = window.confirm(
      `Reject this claim? Once rejected, the status will be locked and cannot be changed.`
    );
    if (!ok) return;
    updateClaimStatus(claim.id, 'Reject');
    toast.success('Claim rejected');
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 relative">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Claims Management</h1>
          <p className="text-[13px] text-slate-500">Track every registered claim through to settlement. Click a row to view details and move its status.</p>
        </div>
        <button
          onClick={() => setIsNewClaimOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Claim
        </button>
      </div>

      {/* Status filter pills */}
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
              return (
                <tr
                  key={claim.id}
                  onClick={() => setSelectedClaimId(claim.id)}
                  className={cn(
                    'hover:bg-blue-50/50 transition-colors cursor-pointer',
                    selectedClaimId === claim.id && 'bg-blue-50'
                  )}
                >
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
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" title="Status is locked because this claim has reached a terminal state.">
                          <Lock className="w-3 h-3" />
                        </span>
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
                      <div className="text-[12px] mb-3">Submit a new claim to get started.</div>
                      <button
                        onClick={() => setIsNewClaimOpen(true)}
                        className="text-blue-600 text-[13px] font-bold hover:underline"
                      >
                        Create your first claim
                      </button>
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

      {isNewClaimOpen && (
        <NewClaimModal onClose={() => setIsNewClaimOpen(false)} />
      )}

      {selectedClaim && (
        <ClaimDetailPanel
          claim={selectedClaim}
          onClose={() => setSelectedClaimId(null)}
          onAdvance={() => handleAdvanceStatus(selectedClaim)}
          onReject={() => handleReject(selectedClaim)}
        />
      )}
    </div>
  );
};

// --- New Claim Modal ----------------------------------------------------------

const NewClaimModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { deals, clients, addClaim } = useData();

  const [dealId, setDealId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateReported, setDateReported] = useState<string>(new Date().toISOString().slice(0, 10));
  const [estimatedAmount, setEstimatedAmount] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('IDR');

  // Active policies: any deal that has reached binding or beyond.
  const policyOptions = useMemo(() => {
    return deals
      .filter(d => d.statusStage === 'Policy On Progress' || d.statusStage === 'Bind / Closed Won')
      .map(d => {
        const client = clients.find(c => c.id === d.clientId);
        return {
          id: d.id,
          label: `${client?.companyName || 'Unknown Client'} — ${d.typeOfInsurance}`,
          insuranceCompany: d.insuranceCompany,
          currency: d.currency,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [deals, clients]);

  const selectedPolicy = policyOptions.find(p => p.id === dealId);

  // When a policy is selected, default the currency to that policy's currency (if recognized).
  React.useEffect(() => {
    if (selectedPolicy?.currency && CURRENCIES.includes(selectedPolicy.currency as Currency)) {
      setCurrency(selectedPolicy.currency as Currency);
    }
  }, [selectedPolicy?.currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealId) return toast.error('Please select a policy.');
    if (!title.trim()) return toast.error('Claim title is required.');
    if (!description.trim()) return toast.error('Description is required.');
    if (!dateReported) return toast.error('Date Reported is required.');

    const amount = estimatedAmount ? parseFloat(estimatedAmount.replace(/,/g, '')) : undefined;

    addClaim({
      dealId,
      title: title.trim(),
      description: description.trim(),
      status: 'Claim Registered',
      dateReported: new Date(dateReported).toISOString(),
      estimatedAmount: amount,
      currency,
      insuranceCompany: selectedPolicy?.insuranceCompany,
    });
    toast.success('Claim registered successfully');
    onClose();
  };

  const handleAmountChange = (raw: string) => {
    const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
    if (cleaned === '') {
      setEstimatedAmount('');
      return;
    }
    const n = parseFloat(cleaned);
    if (!isNaN(n)) setEstimatedAmount(n.toLocaleString('en-US'));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Register New Claim</h2>
              <p className="text-[12px] font-medium text-slate-500">Select the policy this claim belongs to, then fill in the details.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="new-claim-form" onSubmit={handleSubmit} className="overflow-y-auto bg-slate-50 p-6 space-y-5 flex-1">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Policy *</label>
              <select
                value={dealId}
                onChange={e => setDealId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px] bg-white"
                required
              >
                <option value="">-- Select an active policy --</option>
                {policyOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              {policyOptions.length === 0 && (
                <p className="mt-1 text-[11px] text-red-600">
                  No active policies found. Move a deal to "Bind / Closed Won" or "Policy On Progress" first.
                </p>
              )}
              {selectedPolicy && (
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-slate-600">Insurance Company (auto)</span>
                  <span className="text-slate-800 font-medium">{selectedPolicy.insuranceCompany || 'Not set on this policy'}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Claim Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Fire damage at warehouse"
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Description *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the incident in detail..."
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px] resize-y min-h-[80px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Date Reported *</label>
                <input
                  type="date"
                  value={dateReported}
                  onChange={e => setDateReported(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">When the insured reported the incident.</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Estimated Amount</label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                    className="px-2 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 text-[13px] font-medium"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    value={estimatedAmount}
                    onChange={e => handleAmountChange(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px] font-mono text-right"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Optional. Can be revised later.</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-[12px] text-blue-900 flex gap-2">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              On submission, the claim's status will be set to <span className="font-semibold">Claim Registered</span> and the Date Registered will be set to today. You can move the status forward from the claim's detail view.
            </span>
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-claim-form"
            className="px-5 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Register Claim
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Claim Detail Side Panel --------------------------------------------------

const ClaimDetailPanel: React.FC<{
  claim: Claim;
  onClose: () => void;
  onAdvance: () => void;
  onReject: () => void;
}> = ({ claim, onClose, onAdvance, onReject }) => {
  const { deals, clients } = useData();
  const deal = deals.find(d => d.id === claim.dealId);
  const client = deal ? clients.find(c => c.id === deal.clientId) : undefined;

  const next = nextLinearStage(claim.status);
  const isLocked = TERMINAL_CLAIM_STATUSES.includes(claim.status);

  // Build the linear timeline. Reject is shown as a separate off-ramp note.
  const currentIdx = CLAIM_PROGRESSION.indexOf(claim.status);
  const isRejected = claim.status === 'Reject';

  const formatDate = (iso?: string) => iso ? format(new Date(iso), 'dd MMM yyyy') : '-';
  const formatAmount = (amount?: number, currency?: string) =>
    amount == null ? '-' : `${currency || ''} ${amount.toLocaleString()}`.trim();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/30 z-40" onClick={onClose} />

      {/* Side panel */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 leading-tight">{claim.title}</h2>
              <span className={cn('inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase', statusBadgeColor(claim.status))}>
                {claim.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <section>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</div>
            <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{claim.description}</p>
          </section>

          {/* Key details grid */}
          <section className="grid grid-cols-2 gap-4">
            <DetailItem
              icon={<Building2 className="w-3.5 h-3.5" />}
              label="Client"
              value={client?.companyName || 'Unknown'}
            />
            <DetailItem
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Insurance"
              value={claim.insuranceCompany || deal?.insuranceCompany || '-'}
            />
            <DetailItem
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Date Registered"
              value={formatDate(claim.dateRegistered)}
            />
            <DetailItem
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Date Reported"
              value={formatDate(claim.dateReported)}
            />
            <DetailItem
              icon={<CircleDollarSign className="w-3.5 h-3.5" />}
              label="Estimated Amount"
              value={formatAmount(claim.estimatedAmount, claim.currency)}
              wide
            />
          </section>

          {/* Status workflow timeline */}
          <section>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Status Workflow</div>
            <ol className="space-y-1">
              {CLAIM_PROGRESSION.map((stage, idx) => {
                const isDone = !isRejected && idx < currentIdx;
                const isCurrent = !isRejected && idx === currentIdx;
                const isFuture = isRejected || idx > currentIdx;
                return (
                  <li key={stage} className="flex items-start gap-3 relative">
                    {/* Connector line */}
                    {idx < CLAIM_PROGRESSION.length - 1 && (
                      <div className={cn(
                        'absolute left-[11px] top-6 bottom-0 w-px',
                        isDone ? 'bg-emerald-300' : 'bg-slate-200'
                      )} />
                    )}
                    {/* Node */}
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border-2 z-10',
                      isDone && 'bg-emerald-500 border-emerald-500 text-white',
                      isCurrent && 'bg-blue-500 border-blue-500 text-white shadow-md ring-4 ring-blue-100',
                      isFuture && 'bg-white border-slate-300 text-slate-400'
                    )}>
                      {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                    </div>
                    {/* Label */}
                    <div className="flex-1 py-0.5">
                      <div className={cn(
                        'text-[13px] font-semibold',
                        isCurrent && 'text-blue-700',
                        isDone && 'text-slate-700',
                        isFuture && 'text-slate-400'
                      )}>
                        {stage}
                      </div>
                      {isCurrent && (
                        <div className="text-[11px] text-blue-600 mt-0.5">Current status</div>
                      )}
                    </div>
                  </li>
                );
              })}
              {isRejected && (
                <li className="flex items-start gap-3 mt-2 pt-3 border-t border-slate-100">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-red-500 text-white shadow-md ring-4 ring-red-100">
                    <Ban className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-red-700">Rejected</div>
                    <div className="text-[11px] text-red-500 mt-0.5">This claim has been rejected and locked.</div>
                  </div>
                </li>
              )}
            </ol>
          </section>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          {isLocked ? (
            <div className="flex items-center justify-center gap-2 text-[12px] text-slate-500 py-2">
              <Lock className="w-3.5 h-3.5" />
              <span>This claim is in a terminal state and cannot be changed.</span>
            </div>
          ) : (
            <div className="flex gap-2">
              {next && (
                <button
                  onClick={onAdvance}
                  className="flex-1 px-4 py-2.5 rounded-md font-semibold text-[13px] text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  Move to {next}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onReject}
                className="px-4 py-2.5 rounded-md font-semibold text-[13px] text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

// --- Small bits ---------------------------------------------------------------

const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string; wide?: boolean }> = ({ icon, label, value, wide }) => (
  <div className={cn(wide && 'col-span-2')}>
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
      {icon}
      {label}
    </div>
    <div className="text-[13px] font-medium text-slate-800">{value}</div>
  </div>
);

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