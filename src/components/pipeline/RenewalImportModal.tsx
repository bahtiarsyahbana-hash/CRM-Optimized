import React, { useState, useRef } from 'react';
import { useData } from '../../context/DataContext';
import {
  downloadRenewalTemplate,
  parseRenewalFile,
  ParseResult,
} from '../../utils/renewalImporter';
import {
  X, Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, ArrowRight,
  Building2, FileText, Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

type Stage = 'select' | 'preview' | 'importing';

export const RenewalImportModal: React.FC<Props> = ({ onClose }) => {
  const { clients, addClient, addDeal } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('select');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const groups = parseResult?.groups ?? [];
  const invalidRows = parseResult?.invalid ?? [];

  const newClientGroups = groups.filter(g => g.existingClientId === null);
  const existingClientGroups = groups.filter(g => g.existingClientId !== null);
  const totalDeals = groups.reduce((sum, g) => sum + g.deals.length, 0);

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const result = await parseRenewalFile(file, clients);
      setParseResult(result);
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

    // PHASE 1: Create all new clients first
    for (const group of newClientGroups) {
      addClient(group.clientData);
      clientsCreated++;
    }

    // Read latest clients straight from localStorage (bypasses React state lag)
    const latestClients: any[] = JSON.parse(localStorage.getItem('clients') || '[]');
    const byName = new Map<string, string>();
    for (const c of latestClients) byName.set((c.companyName || '').trim().toLowerCase(), c.id);

    // PHASE 2: Create deals for each group, pointing at the correct client id
    for (const group of groups) {
      const clientId = group.existingClientId ?? byName.get(group.insuredName.trim().toLowerCase());
      if (!clientId) {
        console.error('Could not resolve client id for', group.insuredName);
        continue;
      }
      for (const deal of group.deals) {
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
        });
        dealsCreated++;
      }
    }

    toast.success(
      `Imported ${dealsCreated} deal${dealsCreated === 1 ? '' : 's'} ` +
      `across ${groups.length} client${groups.length === 1 ? '' : 's'} ` +
      `(${clientsCreated} new, ${existingClientGroups.length} existing)` +
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
                <SummaryCard count={groups.length} label="Clients" description={`${newClientGroups.length} new · ${existingClientGroups.length} existing`} tone="green" icon={<Users className="w-4 h-4" />} />
                <SummaryCard count={totalDeals} label="Deals" description="To be created" tone="green" icon={<FileText className="w-4 h-4" />} />
                <SummaryCard count={parseResult.totalRowsProcessed - invalidRows.length} label="Rows OK" description={`of ${parseResult.totalRowsProcessed}`} tone="green" icon={<CheckCircle2 className="w-4 h-4" />} />
                <SummaryCard count={invalidRows.length} label="Errors" description="Will be skipped" tone="red" icon={<AlertCircle className="w-4 h-4" />} />
              </div>

              {groups.length > 0 && (
                <Section title={`Clients & their deals (${groups.length} clients, ${totalDeals} deals)`} tone="green">
                  <div className="max-h-[400px] overflow-y-auto divide-y divide-emerald-100">
                    {groups.map(g => {
                      const isExpanded = expandedGroup === g.insuredName;
                      const isExisting = g.existingClientId !== null;
                      return (
                        <div key={g.insuredName}>
                          <button
                            type="button"
                            onClick={() => setExpandedGroup(isExpanded ? null : g.insuredName)}
                            className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-emerald-50/50 text-left transition-colors"
                          >
                            <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-[13px] font-semibold text-slate-900 truncate">{g.insuredName}</div>
                                {isExisting ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">existing</span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">new</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {g.deals.length} deal{g.deals.length === 1 ? '' : 's'} · rows {g.sourceRowNumbers.join(', ')}
                              </div>
                            </div>
                            <ArrowRight className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                          </button>
                          {isExpanded && (
                            <div className="bg-emerald-50/30 px-3 pb-3 pl-10">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-slate-600">
                                    <th className="text-left py-1.5 font-semibold">Type of Insurance</th>
                                    <th className="text-right py-1.5 font-semibold">Sum Insured</th>
                                    <th className="text-right py-1.5 font-semibold">Premium</th>
                                    <th className="text-left py-1.5 font-semibold pl-2">Period</th>
                                    <th className="text-left py-1.5 font-semibold pl-2">Insurance Co.</th>
                                    <th className="text-left py-1.5 font-semibold pl-2">Stage</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.deals.map((d, i) => (
                                    <tr key={i} className="border-t border-emerald-100/60">
                                      <td className="py-1 text-slate-800">{d.typeOfInsurance}</td>
                                      <td className="py-1 text-right font-mono text-slate-800">{d.currency} {formatNumber(d.sumInsured)}</td>
                                      <td className="py-1 text-right font-mono text-slate-700">{formatNumber(d.premiumAmount)}</td>
                                      <td className="py-1 text-slate-600 pl-2 whitespace-nowrap">{formatDate(d.periodStart)} → {formatDate(d.periodEnd)}</td>
                                      <td className="py-1 text-slate-700 pl-2">{d.insuranceCompany || '-'}</td>
                                      <td className="py-1 text-slate-700 pl-2">{d.statusStage}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
              onClick={() => { setStage('select'); setParseResult(null); setFileName(''); setExpandedGroup(null); }}
              className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors">Cancel</button>
            {stage === 'preview' && parseResult && groups.length > 0 && (
              <button
                onClick={performImport}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm inline-flex items-center gap-2"
              >
                Import {totalDeals} deal(s) across {groups.length} client(s)
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ count: number; label: string; description: string; tone: 'green' | 'amber' | 'red'; icon: React.ReactNode }> = ({ count, label, description, tone, icon }) => {
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