import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealStage, DealStageLogEntry } from '../../types';
import { ArrowLeft, Building2, CheckCircle2, Circle, Clock, MessageSquareText, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  deal: Deal;
  onBack: () => void;
}

const STAGES_NEW: DealStage[] = ['Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress', 'Lost'];
const STAGES_RENEWAL: DealStage[] = ['Policy On Progress', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Lost'];

const STAGE_COLOR: Record<DealStage, { dot: string; text: string; bg: string; border: string }> = {
  'Leads':              { dot: 'bg-slate-400',  text: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  'Data Collection':    { dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  'Quote':              { dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  'Nego':               { dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  'Bind / Closed Won':  { dot: 'bg-emerald-500',text: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  'Policy On Progress': { dot: 'bg-teal-500',   text: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  'Lost':               { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

export const DealJourneyView: React.FC<Props> = ({ deal: initialDeal, onBack }) => {
  const { deals, clients, updateDealStage } = useData();
  // Always pull the freshest version from context so transitions reflect immediately.
  const deal = deals.find(d => d.id === initialDeal.id) || initialDeal;
  const client = clients.find(c => c.id === deal.clientId);

  const isRenewalTrack = ['Renewal', 'Existing Client Update'].includes(deal.dealType);
  const stages = isRenewalTrack ? STAGES_RENEWAL : STAGES_NEW;

  const currentIdx = stages.indexOf(deal.statusStage);
  const sortedLog: DealStageLogEntry[] = useMemo(
    () => [...(deal.stageLog || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [deal.stageLog]
  );

  const [pendingStage, setPendingStage] = useState<DealStage | null>(null);
  const [logNote, setLogNote] = useState('');

  const confirmStageChange = () => {
    if (!pendingStage) return;
    if (pendingStage === 'Policy On Progress' && !deal.insuranceCompany) {
      toast.error('Insurance Company is required before moving to Policy On Progress.');
      return;
    }
    updateDealStage(deal.id, pendingStage, logNote);
    toast.success(`Stage moved to ${pendingStage}`);
    setPendingStage(null);
    setLogNote('');
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            title="Back to pipeline"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Deal Journey</h1>
            <p className="text-[13px] text-slate-500">Move the deal forward, leave a note at every transition.</p>
          </div>
        </div>
        <CurrentBadge stage={deal.statusStage} />
      </div>

      {/* Client + deal summary card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-5 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 truncate">{client?.companyName || 'Unknown Client'}</div>
          <div className="text-[12px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{deal.dealType}</span>
            <span className="text-slate-300">•</span>
            <span>{deal.typeOfInsurance || 'No insurance type'}</span>
            {deal.insuranceCompany && <><span className="text-slate-300">•</span><span>{deal.insuranceCompany}</span></>}
            {deal.premiumAmount && (
              <>
                <span className="text-slate-300">•</span>
                <span>{deal.currency} {deal.premiumAmount.toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Journey stepper */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6 mb-6">
        <h2 className="text-[13px] font-bold text-slate-800 mb-1">Journey</h2>
        <p className="text-[12px] text-slate-500 mb-5">Click a stage to move the deal there and leave a note for the team.</p>

        <ol className="relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />
          {stages.map((stage, idx) => {
            const isActive = idx === currentIdx;
            const isPast = currentIdx > -1 && idx < currentIdx;
            const isLost = stage === 'Lost';
            const color = STAGE_COLOR[stage];

            return (
              <li key={stage} className="relative pl-12 pb-4 last:pb-0">
                <span
                  className={cn(
                    'absolute left-0 top-1 w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center',
                    isActive && 'border-blue-500',
                    isPast && 'border-emerald-500',
                    !isActive && !isPast && 'border-slate-200'
                  )}
                >
                  {isPast ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : isActive ? (
                    <span className={cn('w-2.5 h-2.5 rounded-full', color.dot)} />
                  ) : (
                    <Circle className="w-3 h-3 text-slate-300" />
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => setPendingStage(stage)}
                  disabled={isActive}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2.5 transition-colors',
                    isActive
                      ? cn(color.bg, color.border, 'cursor-default')
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40',
                    isLost && !isActive && 'hover:border-red-300 hover:bg-red-50/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={cn('text-[13px] font-semibold', isActive ? color.text : 'text-slate-800')}>
                        {stage}
                      </div>
                      {isActive && <div className="text-[11px] font-medium text-blue-600 mt-0.5">Current stage</div>}
                    </div>
                    {!isActive && (
                      <span className="text-[11px] font-semibold text-blue-600 group-hover:underline">Move here</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* History log */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6">
        <h2 className="text-[13px] font-bold text-slate-800 mb-1">Stage History</h2>
        <p className="text-[12px] text-slate-500 mb-4">Every transition logged with its note, newest first.</p>

        {sortedLog.length === 0 ? (
          <div className="text-[12px] text-slate-400 italic border border-dashed border-slate-200 rounded-md py-6 text-center">
            No stage transitions yet. Move the deal to a new stage to start logging.
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedLog.map((entry, i) => (
              <li key={i} className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px]', STAGE_COLOR[entry.fromStage].bg, STAGE_COLOR[entry.fromStage].text)}>
                      {entry.fromStage}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px]', STAGE_COLOR[entry.toStage].bg, STAGE_COLOR[entry.toStage].text)}>
                      {entry.toStage}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.at).toLocaleString()}
                  </div>
                </div>
                {entry.notes && (
                  <div className="mt-2 text-[12px] text-slate-700 flex gap-2">
                    <MessageSquareText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="whitespace-pre-wrap">{entry.notes}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stage transition modal */}
      {pendingStage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Move stage</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  <span className="font-semibold">{deal.statusStage}</span>
                  <span className="text-slate-400 mx-1.5">→</span>
                  <span className="font-semibold">{pendingStage}</span>
                </p>
              </div>
              <button
                onClick={() => { setPendingStage(null); setLogNote(''); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Transition note <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                rows={4}
                autoFocus
                placeholder="What happened in this stage? Why are we moving forward?"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button
                onClick={() => { setPendingStage(null); setLogNote(''); }}
                className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmStageChange}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
              >
                Move &amp; Save Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CurrentBadge: React.FC<{ stage: DealStage }> = ({ stage }) => {
  const c = STAGE_COLOR[stage];
  return (
    <div className={cn('px-3 py-1.5 rounded-full text-[12px] font-semibold border', c.bg, c.text, c.border)}>
      {stage}
    </div>
  );
};
