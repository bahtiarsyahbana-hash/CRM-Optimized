import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealApprovalAction, DealApprovalStatus } from '../../types';
import { Check, X, AlertCircle, ChevronDown, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const STATUS_STYLE: Record<DealApprovalStatus, string> = {
  'Draft':              'bg-slate-100 text-slate-600 border-slate-200',
  'Pending Approval':   'bg-amber-50 text-amber-700 border-amber-200',
  'Approved':           'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected':           'bg-red-50 text-red-700 border-red-200',
  'Needs Adjustment':   'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_ICON: Record<DealApprovalStatus, React.ComponentType<{ className?: string }>> = {
  'Draft':              Shield,
  'Pending Approval':   Shield,
  'Approved':           Check,
  'Rejected':           X,
  'Needs Adjustment':   AlertCircle,
};

interface Props {
  deal: Deal;
}

export const ApprovalStatusBadge: React.FC<{ status?: DealApprovalStatus }> = ({ status }) => {
  const s = status || 'Draft';
  const Icon = STATUS_ICON[s];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
      STATUS_STYLE[s]
    )}>
      <Icon className="w-3 h-3" />
      {s}
    </span>
  );
};

export const ApprovalActionMenu: React.FC<Props> = ({ deal }) => {
  const { recordApproval } = useData();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<DealApprovalAction | null>(null);
  const [note, setNote] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const startAction = (action: DealApprovalAction) => {
    setOpen(false);
    setNote('');
    setModal(action);
  };

  const submit = () => {
    if (!modal) return;
    if (modal === 'Need Adjustment' && !note.trim()) {
      toast.error('A note is required when asking for adjustments.');
      return;
    }
    recordApproval(deal.id, modal, note);
    toast.success(
      modal === 'Approve' ? 'Deal approved' :
      modal === 'Reject'  ? 'Deal rejected' :
                            'Adjustment requested'
    );
    setModal(null);
    setNote('');
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
        title="Approval actions"
      >
        Approval <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 w-48 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => startAction('Approve')}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" /> Approve
          </button>
          <button
            onClick={() => startAction('Need Adjustment')}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors text-left border-t border-slate-100"
          >
            <AlertCircle className="w-3.5 h-3.5 text-orange-600" /> Need Adjustment
          </button>
          <button
            onClick={() => startAction('Reject')}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors text-left border-t border-slate-100"
          >
            <X className="w-3.5 h-3.5 text-red-600" /> Reject
          </button>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  {modal === 'Approve' ? 'Approve deal' : modal === 'Reject' ? 'Reject deal' : 'Request adjustments'}
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  This decision is logged on the deal's approval history.
                </p>
              </div>
              <button
                onClick={() => { setModal(null); setNote(''); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Notes {modal === 'Need Adjustment'
                  ? <span className="text-red-500">*</span>
                  : <span className="text-slate-400 font-normal">(optional)</span>}
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
                autoFocus
                placeholder={
                  modal === 'Approve' ? 'Anything to flag for the team? (optional)' :
                  modal === 'Reject'  ? 'Reason for rejection... (optional)' :
                                        'What needs to be fixed before re-submission?'
                }
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button
                onClick={() => { setModal(null); setNote(''); }}
                className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className={cn(
                  'px-4 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm',
                  modal === 'Approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  modal === 'Reject'  ? 'bg-red-600 hover:bg-red-700' :
                                        'bg-orange-600 hover:bg-orange-700'
                )}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
