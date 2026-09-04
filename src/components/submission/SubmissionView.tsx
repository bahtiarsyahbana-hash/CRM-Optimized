import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealApprovalStatus } from '../../types';
import { Plus, Search, Building2, Edit2, Trash2, AlertTriangle, X, Inbox, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { DealDetailForm } from '../clients/DealDetailForm';
import { ApprovalActionMenu, ApprovalStatusBadge } from '../pipeline/ApprovalActionMenu';
import { DealTrack, trackOf } from '../../utils/dealTrack';

/**
 * Submissions are deals that have not yet been approved. Approving one moves
 * it out of this view and into the Pipeline automatically — the two views are
 * a single `deals` collection split on `approvalStatus`.
 */
type StatusFilter = 'All' | DealApprovalStatus;

/** New business and renewals both enter here; the tab strip splits them. */
type TrackFilter = 'All' | DealTrack;
const TRACK_TABS: TrackFilter[] = ['All', 'New Business', 'Renewal'];
const TRACK_LABEL: Record<TrackFilter, string> = {
  'All': 'All',
  'New Business': 'New Business',
  'Renewal': 'Renewals',
};

/** Statuses that belong to the submission stage (i.e. everything pre-approval). */
const SUBMISSION_STATUSES: DealApprovalStatus[] = [
  'Draft',
  'Pending Approval',
  'Needs Adjustment',
  'Rejected',
];

/** A deal with no explicit status is treated as an untouched Draft. */
const statusOf = (deal: Deal): DealApprovalStatus => deal.approvalStatus || 'Draft';

export const SubmissionView: React.FC<{
  /** Seeded by dashboard drill-through (Retention lands on Renewals). */
  initialTrack?: TrackFilter;
}> = ({ initialTrack = 'All' }) => {
  const { deals, clients, deleteDeal } = useData();
  const [search, setSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(initialTrack);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Deal | null>(null);

  // Everything that is not yet Approved lives here.
  const submissions = useMemo(
    () => deals.filter(d => d.approvalStatus !== 'Approved'),
    [deals]
  );

  // Tab counts span every submission, so the strip shows the overall split
  // regardless of which status or search is currently applied.
  const trackCounts = useMemo(() => {
    const base: Record<TrackFilter, number> = { 'All': submissions.length, 'New Business': 0, 'Renewal': 0 };
    submissions.forEach(d => { base[trackOf(d.dealType)] += 1; });
    return base;
  }, [submissions]);

  // Within the selected tab.
  const inTrack = useMemo(
    () => trackFilter === 'All' ? submissions : submissions.filter(d => trackOf(d.dealType) === trackFilter),
    [submissions, trackFilter]
  );

  // Status pill counts follow the tab, so they describe what's actually in view.
  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      'All': inTrack.length,
      'Draft': 0,
      'Pending Approval': 0,
      'Approved': 0,
      'Rejected': 0,
      'Needs Adjustment': 0,
    };
    inTrack.forEach(d => { base[statusOf(d)] += 1; });
    return base;
  }, [inTrack]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return inTrack
      .filter(d => {
        if (statusFilter !== 'All' && statusOf(d) !== statusFilter) return false;
        if (!q) return true;
        const client = clients.find(c => c.id === d.clientId);
        return (
          (client?.companyName || '').toLowerCase().includes(q) ||
          (client?.lineOfBusiness || '').toLowerCase().includes(q) ||
          (d.typeOfInsurance || '').toLowerCase().includes(q) ||
          (d.insuranceCompany || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [inTrack, statusFilter, search, clients]);

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    deleteDeal(deleteCandidate.id);
    const name = clients.find(c => c.id === deleteCandidate.clientId)?.companyName || 'Submission';
    toast.success(`${name} — ${deleteCandidate.typeOfInsurance || 'submission'} removed.`);
    setDeleteCandidate(null);
  };

  return (
    <div className="h-full flex flex-col p-8 relative bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Submissions</h1>
          <p className="text-[13px] text-slate-500">
            Create and review new business or renewal submissions. Approved submissions move to the Pipeline automatically.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Submission
        </button>
      </div>

      {/* Track tabs — new business and renewals both enter through Submissions. */}
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-px shrink-0">
        {TRACK_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setTrackFilter(tab); setStatusFilter('All'); }}
            className={cn(
              'pb-2 text-[13px] font-semibold transition-colors relative flex items-center gap-1.5',
              trackFilter === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {TRACK_LABEL[tab]}
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                trackFilter === tab ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              {trackCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
        {/* Search + status filter pills */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by company, insurance type, or insurer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterPill
              label={`All (${counts.All})`}
              active={statusFilter === 'All'}
              onClick={() => setStatusFilter('All')}
            />
            {SUBMISSION_STATUSES.map(s => (
              <FilterPill
                key={s}
                label={`${s} (${counts[s]})`}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Company Name</th>
                <th className="px-6 py-3 font-semibold text-slate-600">LOB / Insurance Type</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Deal Type</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Sum Insured</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Premium</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Approval</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Last Updated</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(deal => {
                const client = clients.find(c => c.id === deal.clientId);
                const status = statusOf(deal);
                const lastNote = deal.approvalLog && deal.approvalLog.length > 0
                  ? deal.approvalLog[deal.approvalLog.length - 1]
                  : null;
                return (
                  <tr key={deal.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="font-semibold text-slate-900">
                          {client ? client.companyName : 'Unknown Client'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800">{client ? client.lineOfBusiness : '-'}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {deal.typeOfInsurance && (
                          <span className="text-[11px] text-slate-500">{deal.typeOfInsurance}</span>
                        )}
                        {deal.lines && deal.lines.length > 1 && (
                          <span
                            className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded"
                            title={deal.lines.map(l => l.productName).join(' + ')}
                          >
                            {deal.lines.length} products
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-semibold border',
                        deal.dealType === 'New Business' ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : deal.dealType === 'Renewal' ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                      )}>
                        {deal.dealType}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-mono text-slate-600 font-semibold">
                        {deal.currency} {deal.sumInsured?.toLocaleString() || '0'}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-mono text-slate-600 font-semibold">
                        {deal.premiumAmount ? `${deal.currency} ${deal.premiumAmount.toLocaleString()}` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <ApprovalStatusBadge status={status} />
                      {lastNote?.notes && (status === 'Needs Adjustment' || status === 'Rejected') && (
                        <div
                          className="text-[10px] text-slate-500 mt-1 max-w-[200px] truncate"
                          title={lastNote.notes}
                        >
                          {lastNote.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(deal.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ApprovalActionMenu deal={deal} />
                        <button
                          onClick={() => setEditDeal(deal)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Submission"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(deal)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Submission"
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
              <Inbox className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-medium text-slate-900 mb-1">
                {submissions.length === 0
                  ? 'No submissions yet'
                  : inTrack.length === 0
                    ? `No ${TRACK_LABEL[trackFilter].toLowerCase()} submissions`
                    : 'No submissions match this filter'}
              </p>
              <p className="text-[13px] text-slate-500 mb-4">
                {submissions.length === 0
                  ? 'Create a submission to start a new business or renewal deal.'
                  : inTrack.length === 0
                    ? 'Nothing on this track yet — try another tab.'
                    : 'Try a different status filter or clear your search.'}
              </p>
              {submissions.length === 0 && (
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="text-blue-600 text-[13px] font-bold hover:underline"
                >
                  Create a Submission
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 flex items-center gap-1.5">
          <ArrowRight className="w-3 h-3" />
          Approving a submission moves it to the Pipeline under its New Business or Renewal tab.
        </div>
      </div>

      {isAddOpen && <DealDetailForm onClose={() => setIsAddOpen(false)} />}
      {editDeal && <DealDetailForm deal={editDeal} onClose={() => setEditDeal(null)} />}

      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Delete submission?</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[13px] text-slate-700">
              <p>
                You're about to remove the submission for{' '}
                <span className="font-semibold">
                  {clients.find(c => c.id === deleteCandidate.clientId)?.companyName || 'Unknown Client'}
                </span>{' '}
                <span className="text-slate-500">({deleteCandidate.typeOfInsurance || 'no insurance type'})</span>.
              </p>
              <p className="text-[12px] text-slate-500">
                Its premium calculation, documents, commission and approval history will be deleted with it.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Delete submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterPill: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
      active
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    )}
  >
    {label}
  </button>
);
