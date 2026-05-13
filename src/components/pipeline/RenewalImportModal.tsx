import React, { useState, useRef } from 'react';
import { useData } from '../../context/DataContext';
import {
  downloadRenewalTemplate,
  parseRenewalFile,
  ParseResult,
} from '../../utils/renewalImporter';
import {
  X, Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, ArrowRight,
  Building2, FileText, Users, Pencil,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

type Stage = 'select' | 'preview' | 'importing';

const STAGE_OPTIONS = [
  'Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress', 'Lost',
] as const;

export const RenewalImportModal: React.FC<Props> = ({ onClose }) => {
  const { clients, addClient, addDeal } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('select');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Review controls
  const [skippedGroups, setSkippedGroups] = useState<Set<string>>(new Set());
  const [skippedDeals, setSkippedDeals] = useState<Set<string>>(new Set());
  const [dealEdits, setDealEdits] = useState<Record<string, any>>({});
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});

  const groups = parseResult?.groups ?? [];
  const invalidRows = parseResult?.invalid ?? [];
  const existingClientGroups = groups.filter(g => g.existingClientId !== null);

  // Stable key helpers
  const gk = (name: string) => name.trim().toLowerCase();
  const dk = (groupName: string, idx: number) => `${gk(groupName)}::${idx}`;

  // Live counts reflecting skip choices
  const totalActiveGroups = groups.filter(g => !skippedGroups.has(gk(g.insuredName))).length;
  const totalActiveDeals = groups.reduce((sum, g) => {
    if (skippedGroups.has(gk(g.insuredName))) return sum;
    return sum + g.deals.filter((_, i) => !skippedDeals.has(dk(g.insuredName, i))).length;
  }, 0);

  const toggleGroup = (name: string) => {
    const key = gk(name);
    setSkippedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleDeal = (groupName: string, idx: number) => {
    const key = dk(groupName, idx);
    setSkippedDeals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const startEdit = (groupName: string, idx: number, deal: any) => {
    const key = dk(groupName, idx);
    setEditingDeal(key);
    setDraft({ ...deal, ...(dealEdits[key] || {}) });
  };

  const saveEdit = (key: string) => {
    setDealEdits(prev => ({ ...prev, [key]: { ...draft } }));
    setEditingDeal(null);
  };

  const isoToDateInput = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toISOString().split('T')[0]; } catch { return ''; }
  };
  const dateInputToIso = (v: string) => v ? new Date(v).toISOString() : '';

  const resetReviewState = () => {
    setSkippedGroups(new Set());
    setSkippedDeals(new Set());
    setDealEdits({});
    setEditingDeal(null);
    setDraft({});
    setExpandedGroup(null);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const result = await parseRenewalFile(file, clients);
      setParseResult(result);
      resetReviewState();
      setStage('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not parse the file.';
      setParseError(message);
      toast.error(message);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
  };

  const performImport = async () => {
    if (!parseResult) return;
    setStage('importing');

    let clientsCreated = 0;
    let dealsCreated = 0;

    const importGroups = groups.filter(g => !skippedGroups.has(gk(g.insuredName)));
    const importNewClients = importGroups.filter(g => g.existingClientId === null);
    const importExisting = importGroups.filter(g => g.existingClientId !== null);

    // PHASE 1: Create all new clients first
    for (const group of importNewClients) {
      addClient(group.clientData);
      clientsCreated++;
    }

    // Read latest clients straight from localStorage (bypasses React state lag)
    const latestClients: any[] = JSON.parse(localStorage.getItem('clients') || '[]');
    const byName = new Map<string, string>();
    for (const c of latestClients) byName.set((c.companyName || '').trim().toLowerCase(), c.id);

    // PHASE 2: Create deals for each included group, applying any edits
    for (const group of importGroups) {
      const clientId = group.existingClientId ?? byName.get(gk(group.insuredName));
      if (!clientId) {
        console.error('Could not resolve client id for', group.insuredName);
        continue;
      }
      for (let i = 0; i < group.deals.length; i++) {
        const dealK = dk(group.insuredName, i);
        if (skippedDeals.has(dealK)) continue;
        const deal = { ...group.deals[i], ...(dealEdits[dealK] || {}) };
        addDeal({
          clientId,
          dealType: deal.dealType,
          typeOfInsurance: deal.typeOfInsurance,
          sumInsured: deal.sumInsured,
          currency: deal.currency,
          premiumType: 'Annual',
          premiumAmount: deal.premiumAmount,
          coverNoteNumber: deal.coverNoteNumber,
          insuranceCompany: deal.insuranceCompany,
          riskDetail: deal.riskDetail,
          periodStart: deal.periodStart,
          periodEnd: deal.periodEnd,
          statusStage: deal.statusStage,
          notes: deal.notes,
          qq: deal.qq,
        });
        dealsCreated++;
      }
    }

    toast.success(
      `Imported ${dealsCreated} deal${dealsCreated === 1 ? '' : 's'} ` +
      `across ${importGroups.length} client${importGroups.length === 1 ? '' : 's'} ` +
      `(${clientsCreated} new, ${importExisting.length} existing)` +
      (invalidRows.length > 0 ? `. ${invalidRows.length} row${invalidRows.length === 1 ? '' : 's'} had errors and were skipped.` : '.'),
      { duration: 6000 }
    );
    onClose();
  };

  const formatNumber = (n?: number) => n == null ? '-' : n.toLocaleString();
  const formatDate = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '-'; }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Import Renewal Workbook</h2>
              <p className="text-[12px] font-medium text-slate-500">Bulk-import existing renewals as clients + active policies.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {stage === 'select' && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[14px] shrink-0">1</div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-slate-900 mb-1">Download the template</div>
                    <p className="text-[12px] text-slate-600 mb-3">
                      Contains all the columns IRIS expects — insured name, period, sum insured, premium, policy number, status, and more. Same Insured Name on multiple rows → one Client with multiple Deals.
                    </p>
                    <button
                      onClick={() => { downloadRenewalTemplate(); toast.success('Template downloaded'); }}
                      className="px-4 py-2 text-[13px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[14px] shrink-0">2</div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-slate-900 mb-1">Upload the filled template</div>
                    <p className="text-[12px] text-slate-600 mb-3">
                      Delete the example rows before uploading. The preview will show grouped clients and their deals before any changes are made.
                    </p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Excel File
                    </button>
                    {fileName && <span className="ml-3 text-[12px] text-slate-500">{fileName}</span>}
                  </div>
                </div>
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-[13px] text-red-800">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">Couldn't read that file</div>
                    <div className="text-[12px]">{parseError}</div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-[12px] text-amber-900">
                <div className="font-semibold mb-1">What this import creates</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li><strong>Required columns:</strong> Insured Name, Type of Insurance, Business Occupation, Period Start, Period End, Sum Insured</li>
                  <li><strong>Defaults:</strong> Deal Type = "Renewal", Stage = "Policy On Progress", Currency = "IDR" (if blank)</li>
                  <li><strong>Dedupe:</strong> Same Insured Name in multiple rows → one Client with multiple Deals</li>
                  <li><strong>Dates:</strong> "01/01/2026" or "1 Januari 2026" both work</li>
                </ul>
              </div>
            </div>
          )}

          {stage === 'preview' && parseResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                  count={totalActiveGroups}
                  label="Clients"
                  description={`of ${groups.length} · ${groups.filter(g => g.existingClientId === null && !skippedGroups.has(gk(g.insuredName))).length} new`}
                  tone="green"
                  icon={<Users className="w-4 h-4" />}
                />
                <SummaryCard
                  count={totalActiveDeals}
                  label="Deals"
                  description="To be imported"
                  tone="green"
                  icon={<FileText className="w-4 h-4" />}
                />
                <SummaryCard
                  count={parseResult.totalRowsProcessed - invalidRows.length}
                  label="Rows OK"
                  description={`of ${parseResult.totalRowsProcessed}`}
                  tone="green"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                />
                <SummaryCard
                  count={invalidRows.length}
                  label="Errors"
                  description="Will be skipped"
                  tone="red"
                  icon={<AlertCircle className="w-4 h-4" />}
                />
              </div>

              {groups.length > 0 && (
                <Section
                  title={`Review — ${totalActiveGroups} of ${groups.length} client${groups.length !== 1 ? 's' : ''}, ${totalActiveDeals} deal${totalActiveDeals !== 1 ? 's' : ''} selected`}
                  tone="green"
                >
                  <div className="px-3 py-2 bg-blue-50/60 border-b border-blue-100 text-[11px] text-blue-800">
                    Click <strong>Skip / Include</strong> per client or per deal · Click <Pencil className="w-3 h-3 inline mx-0.5" /> to edit a deal's values before import
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-emerald-100">
                    {groups.map(g => {
                      const isExpanded = expandedGroup === g.insuredName;
                      const isExisting = g.existingClientId !== null;
                      const isGroupSkipped = skippedGroups.has(gk(g.insuredName));

                      return (
                        <div key={g.insuredName} className={cn('transition-opacity', isGroupSkipped && 'opacity-50')}>
                          {/* Group header */}
                          <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50/30">
                            <button
                              type="button"
                              onClick={() => setExpandedGroup(isExpanded ? null : g.insuredName)}
                              className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                              <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className={cn('text-[13px] font-semibold text-slate-900 truncate', isGroupSkipped && 'line-through text-slate-400')}>
                                    {g.insuredName}
                                  </div>
                                  {isExisting
                                    ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase shrink-0">existing</span>
                                    : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase shrink-0">new</span>
                                  }
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {g.deals.length} deal{g.deals.length !== 1 ? 's' : ''} · rows {g.sourceRowNumbers.join(', ')}
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleGroup(g.insuredName)}
                              className={cn(
                                'shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors',
                                isGroupSkipped
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
                              )}
                            >
                              {isGroupSkipped ? 'Include' : 'Skip'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedGroup(isExpanded ? null : g.insuredName)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <ArrowRight className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
                            </button>
                          </div>

                          {/* Deal table */}
                          {isExpanded && (
                            <div className="bg-emerald-50/20 px-3 pb-3 pl-10">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-left py-1.5 font-semibold">Type of Insurance</th>
                                    <th className="text-right py-1.5 font-semibold">Sum Insured</th>
                                    <th className="text-right py-1.5 font-semibold">Premium</th>
                                    <th className="text-left py-1.5 font-semibold pl-2">Period</th>
                                    <th className="text-left py-1.5 font-semibold pl-2">Insurance Co.</th>
                                    <th className="text-left py-1.5 font-semibold pl-2">Stage</th>
                                    <th className="py-1.5 w-16"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.deals.map((d, i) => {
                                    const dealK = dk(g.insuredName, i);
                                    const isDealSkipped = skippedDeals.has(dealK) || isGroupSkipped;
                                    const isEditing = editingDeal === dealK;
                                    const effective = { ...d, ...(dealEdits[dealK] || {}) };
                                    const isEdited = !!dealEdits[dealK];

                                    if (isEditing) {
                                      return (
                                        <tr key={i} className="border-t border-blue-100">
                                          <td colSpan={7} className="p-0">
                                            <div className="bg-blue-50 border border-blue-200 rounded-md m-1 p-3 space-y-3">
                                              <div className="text-[11px] font-bold text-blue-700">Editing deal {i + 1} of {g.deals.length}</div>
                                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                <div>
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Type of Insurance</label>
                                                  <input
                                                    type="text"
                                                    value={draft.typeOfInsurance || ''}
                                                    onChange={e => setDraft((p: any) => ({ ...p, typeOfInsurance: e.target.value }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Premium</label>
                                                  <input
                                                    type="number"
                                                    value={draft.premiumAmount ?? ''}
                                                    onChange={e => setDraft((p: any) => ({ ...p, premiumAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Insurance Company</label>
                                                  <input
                                                    type="text"
                                                    value={draft.insuranceCompany || ''}
                                                    onChange={e => setDraft((p: any) => ({ ...p, insuranceCompany: e.target.value || undefined }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Period Start</label>
                                                  <input
                                                    type="date"
                                                    value={isoToDateInput(draft.periodStart)}
                                                    onChange={e => setDraft((p: any) => ({ ...p, periodStart: dateInputToIso(e.target.value) }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Period End</label>
                                                  <input
                                                    type="date"
                                                    value={isoToDateInput(draft.periodEnd)}
                                                    onChange={e => setDraft((p: any) => ({ ...p, periodEnd: dateInputToIso(e.target.value) }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Stage</label>
                                                  <select
                                                    value={draft.statusStage || 'Policy On Progress'}
                                                    onChange={e => setDraft((p: any) => ({ ...p, statusStage: e.target.value }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  >
                                                    {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                  </select>
                                                </div>
                                                <div className="col-span-2 md:col-span-3">
                                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Notes</label>
                                                  <input
                                                    type="text"
                                                    value={draft.notes || ''}
                                                    onChange={e => setDraft((p: any) => ({ ...p, notes: e.target.value || undefined }))}
                                                    className="w-full px-2 py-1 text-[12px] border border-slate-200 rounded bg-white focus:outline-none focus:border-blue-500"
                                                  />
                                                </div>
                                              </div>
                                              <div className="flex gap-2 justify-end pt-1 border-t border-blue-100">
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingDeal(null)}
                                                  className="px-3 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => saveEdit(dealK)}
                                                  className="px-3 py-1 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                                >
                                                  Save changes
                                                </button>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }

                                    return (
                                      <tr
                                        key={i}
                                        className={cn(
                                          'border-t border-emerald-100/60',
                                          isDealSkipped && 'opacity-40',
                                          isEdited && !isDealSkipped && 'bg-blue-50/40',
                                        )}
                                      >
                                        <td className={cn('py-1 text-slate-800', isDealSkipped && 'line-through')}>{effective.typeOfInsurance}</td>
                                        <td className="py-1 text-right font-mono text-slate-800 whitespace-nowrap">{effective.currency} {formatNumber(effective.sumInsured)}</td>
                                        <td className="py-1 text-right font-mono text-slate-700">{formatNumber(effective.premiumAmount)}</td>
                                        <td className="py-1 text-slate-600 pl-2 whitespace-nowrap">{formatDate(effective.periodStart)} → {formatDate(effective.periodEnd)}</td>
                                        <td className="py-1 text-slate-700 pl-2">{effective.insuranceCompany || '-'}</td>
                                        <td className="py-1 text-slate-700 pl-2">{effective.statusStage}</td>
                                        <td className="py-1 pl-2 text-right whitespace-nowrap">
                                          {!isGroupSkipped && (
                                            <span className="inline-flex items-center gap-1">
                                              <button
                                                type="button"
                                                title="Edit deal"
                                                onClick={() => startEdit(g.insuredName, i, d)}
                                                disabled={skippedDeals.has(dealK)}
                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                title={skippedDeals.has(dealK) ? 'Include this deal' : 'Skip this deal'}
                                                onClick={() => toggleDeal(g.insuredName, i)}
                                                className={cn(
                                                  'px-1.5 py-0.5 text-[11px] font-bold rounded border transition-colors',
                                                  skippedDeals.has(dealK)
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                    : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100',
                                                )}
                                              >
                                                {skippedDeals.has(dealK) ? '+' : '−'}
                                              </button>
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {g.deals.some((_, i) => dealEdits[dk(g.insuredName, i)]) && (
                                <div className="mt-1 text-[10px] text-blue-600">
                                  {g.deals.filter((_, i) => dealEdits[dk(g.insuredName, i)]).length} deal{g.deals.filter((_, i) => dealEdits[dk(g.insuredName, i)]).length !== 1 ? 's' : ''} edited
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-emerald-50/40 text-[11px] text-emerald-900 border-t border-emerald-100">
                    For <strong>existing</strong> clients, deals attach to the current record. For <strong>new</strong> clients, the client record is created using fields from the first matching row.
                  </div>
                </Section>
              )}

              {invalidRows.length > 0 && (
                <Section title={`Rows with errors — will be skipped (${invalidRows.length})`} tone="red">
                  <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                    {invalidRows.map(r => (
                      <div key={r.rowNumber} className="px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-mono text-slate-500">#{r.rowNumber}</span>
                          <span className="text-[13px] font-semibold text-slate-800">{r.rawInsuredName || '(no insured name)'}</span>
                        </div>
                        <ul className="mt-0.5 text-[11px] text-red-700 list-disc list-inside pl-2">
                          {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-red-50/40 text-[11px] text-red-900 border-t border-red-100">
                    Fix these rows and re-upload to import them. They won't be lost — they're just not imported now.
                  </div>
                </Section>
              )}

              {groups.length === 0 && invalidRows.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <div className="text-[14px] font-semibold text-slate-700">No data rows found</div>
                  <div className="text-[12px] text-slate-500 mt-1">The file was parsed but contained no policy rows. Did you delete the example rows by mistake?</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-between gap-3 shrink-0">
          {stage === 'preview' && (
            <button
              onClick={() => { setStage('select'); setParseResult(null); setFileName(''); resetReviewState(); }}
              className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors">
              Cancel
            </button>
            {stage === 'preview' && parseResult && totalActiveDeals > 0 && (
              <button
                onClick={performImport}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm inline-flex items-center gap-2"
              >
                Import {totalActiveDeals} deal{totalActiveDeals !== 1 ? 's' : ''} across {totalActiveGroups} client{totalActiveGroups !== 1 ? 's' : ''}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{
  count: number;
  label: string;
  description: string;
  tone: 'green' | 'amber' | 'red';
  icon: React.ReactNode;
}> = ({ count, label, description, tone, icon }) => {
  const toneClasses = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }[tone];
  return (
    <div className={cn('border rounded-lg p-3', toneClasses)}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{count}</div>
      <div className="text-[11px] opacity-80">{description}</div>
    </div>
  );
};

const Section: React.FC<{ title: string; tone: 'green' | 'amber' | 'red'; children: React.ReactNode }> = ({ title, tone, children }) => {
  const borderClass = { green: 'border-emerald-200', amber: 'border-amber-200', red: 'border-red-200' }[tone];
  const headerClass = { green: 'bg-emerald-50 text-emerald-900', amber: 'bg-amber-50 text-amber-900', red: 'bg-red-50 text-red-900' }[tone];
  return (
    <div className={cn('bg-white border rounded-lg overflow-hidden', borderClass)}>
      <div className={cn('px-3 py-2 border-b text-[12px] font-bold', borderClass, headerClass)}>{title}</div>
      {children}
    </div>
  );
};
