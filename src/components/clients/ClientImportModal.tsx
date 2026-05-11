import React, { useState, useRef } from 'react';
import { useData } from '../../context/DataContext';
import {
  downloadImportTemplate,
  parseImportFile,
  ParseResult,
} from '../../utils/clientImporter';
import { X, Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

type Stage = 'select' | 'preview' | 'importing';

export const ClientImportModal: React.FC<Props> = ({ onClose }) => {
  const { clients, addClient, updateClient } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('select');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  /** For each valid row that matched a duplicate, true = overwrite, false = skip. Keyed by rowNumber. */
  const [duplicateActions, setDuplicateActions] = useState<Record<number, 'overwrite' | 'skip'>>({});
  const [parseError, setParseError] = useState<string | null>(null);

  const newRows = parseResult?.valid.filter(r => r.existingClientId === null) ?? [];
  const duplicateRows = parseResult?.valid.filter(r => r.existingClientId !== null) ?? [];
  const invalidRows = parseResult?.invalid ?? [];

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const result = await parseImportFile(file, clients);
      setParseResult(result);
      // Default all duplicates to "skip" — safer than auto-overwrite
      const defaults: Record<number, 'overwrite' | 'skip'> = {};
      result.valid.forEach(r => {
        if (r.existingClientId !== null) defaults[r.rowNumber] = 'skip';
      });
      setDuplicateActions(defaults);
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

  const setAllDuplicates = (action: 'overwrite' | 'skip') => {
    const next: Record<number, 'overwrite' | 'skip'> = {};
    duplicateRows.forEach(r => { next[r.rowNumber] = action; });
    setDuplicateActions(next);
  };

  const performImport = () => {
    if (!parseResult) return;
    setStage('importing');

    let newCount = 0;
    let overwriteCount = 0;
    let skippedDup = 0;

    // 1. New rows — straight insert
    for (const row of newRows) {
      addClient(row.client);
      newCount++;
    }

    // 2. Duplicate rows — based on per-row action
    for (const row of duplicateRows) {
      const action = duplicateActions[row.rowNumber] ?? 'skip';
      if (action === 'overwrite' && row.existingClientId) {
        // Only overwrite fields the user actually filled in (preserves existing data).
        const updates: Record<string, any> = {};
        for (const [key, value] of Object.entries(row.client)) {
          if (value !== undefined && value !== '' && value !== null) {
            updates[key] = value;
          }
        }
        updateClient(row.existingClientId, updates);
        overwriteCount++;
      } else {
        skippedDup++;
      }
    }

    toast.success(
      `Imported ${newCount} new client${newCount === 1 ? '' : 's'}` +
      (overwriteCount > 0 ? `, overwrote ${overwriteCount}` : '') +
      (skippedDup > 0 ? `, skipped ${skippedDup} duplicate${skippedDup === 1 ? '' : 's'}` : '') +
      (invalidRows.length > 0 ? `, ${invalidRows.length} row${invalidRows.length === 1 ? '' : 's'} had errors` : ''),
      { duration: 5000 }
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Import Clients from Excel</h2>
              <p className="text-[12px] font-medium text-slate-500">Download the template, fill it in, and upload to bulk-add clients.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">

          {stage === 'select' && (
            <div className="space-y-5 max-w-xl mx-auto">
              {/* Step 1: download template */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[14px] shrink-0">1</div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-slate-900 mb-1">Download the template</div>
                    <p className="text-[12px] text-slate-600 mb-3">
                      An .xlsx file with the correct columns and a couple of example rows so you know what valid data looks like.
                    </p>
                    <button
                      onClick={() => {
                        downloadImportTemplate();
                        toast.success('Template downloaded');
                      }}
                      className="px-4 py-2 text-[13px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: upload */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[14px] shrink-0">2</div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-slate-900 mb-1">Upload the filled template</div>
                    <p className="text-[12px] text-slate-600 mb-3">
                      Make sure to delete the example rows before uploading. We'll preview what's about to be imported before any changes are made.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={onFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Excel File
                    </button>
                    {fileName && (
                      <span className="ml-3 text-[12px] text-slate-500">{fileName}</span>
                    )}
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

              {/* Tip box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-[12px] text-amber-900">
                <div className="font-semibold mb-1">Tips for clean imports</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li><strong>Required columns:</strong> Company Name, Line of Business, Business Occupation</li>
                  <li><strong>Line of Business</strong> must be one of: Manufacture, Trading, Financial Institution, Property, Others</li>
                  <li>Asset value can be plain numbers (e.g. 100000000) or shorthand like "100M"</li>
                  <li>Rows with errors will be skipped — you can fix them and re-import later</li>
                </ul>
              </div>
            </div>
          )}

          {stage === 'preview' && parseResult && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SummaryCard
                  count={newRows.length}
                  label="New clients"
                  description="Will be created"
                  tone="green"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                />
                <SummaryCard
                  count={duplicateRows.length}
                  label="Duplicates"
                  description="Match an existing client"
                  tone="amber"
                  icon={<AlertCircle className="w-4 h-4" />}
                />
                <SummaryCard
                  count={invalidRows.length}
                  label="Rows with errors"
                  description="Will be skipped"
                  tone="red"
                  icon={<AlertCircle className="w-4 h-4" />}
                />
              </div>

              {/* New clients list */}
              {newRows.length > 0 && (
                <Section title={`New clients to create (${newRows.length})`} tone="green">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead className="bg-emerald-50/50">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-semibold text-emerald-800 w-12">Row</th>
                          <th className="px-3 py-1.5 text-left font-semibold text-emerald-800">Company Name</th>
                          <th className="px-3 py-1.5 text-left font-semibold text-emerald-800">Line of Business</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newRows.map(r => (
                          <tr key={r.rowNumber} className="border-t border-emerald-100">
                            <td className="px-3 py-1.5 text-slate-500 font-mono">{r.rowNumber}</td>
                            <td className="px-3 py-1.5 text-slate-800">{r.client.companyName}</td>
                            <td className="px-3 py-1.5 text-slate-600">{r.client.lineOfBusiness}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* Duplicate decision list */}
              {duplicateRows.length > 0 && (
                <Section
                  title={`Duplicates — decide per row (${duplicateRows.length})`}
                  tone="amber"
                  rightContent={
                    <div className="flex gap-1 text-[11px]">
                      <button onClick={() => setAllDuplicates('overwrite')} className="px-2 py-1 rounded text-amber-700 hover:bg-amber-100 font-semibold">All Overwrite</button>
                      <span className="text-amber-300">·</span>
                      <button onClick={() => setAllDuplicates('skip')} className="px-2 py-1 rounded text-amber-700 hover:bg-amber-100 font-semibold">All Skip</button>
                    </div>
                  }
                >
                  <div className="max-h-64 overflow-y-auto divide-y divide-amber-100">
                    {duplicateRows.map(r => {
                      const action = duplicateActions[r.rowNumber] ?? 'skip';
                      return (
                        <div key={r.rowNumber} className="px-3 py-2 flex items-center gap-3">
                          <span className="text-[11px] font-mono text-slate-500 w-10 shrink-0">#{r.rowNumber}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-slate-800 truncate">{r.client.companyName}</div>
                            <div className="text-[11px] text-slate-500">{r.client.lineOfBusiness} · already exists in database</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <DupActionButton
                              label="Overwrite"
                              active={action === 'overwrite'}
                              onClick={() => setDuplicateActions(prev => ({ ...prev, [r.rowNumber]: 'overwrite' }))}
                              tone="overwrite"
                            />
                            <DupActionButton
                              label="Skip"
                              active={action === 'skip'}
                              onClick={() => setDuplicateActions(prev => ({ ...prev, [r.rowNumber]: 'skip' }))}
                              tone="skip"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-amber-50/40 text-[11px] text-amber-900 border-t border-amber-100">
                    <strong>Overwrite</strong> replaces fields you filled in; fields you left blank keep their existing values, so partial updates won't wipe data.
                  </div>
                </Section>
              )}

              {/* Invalid rows */}
              {invalidRows.length > 0 && (
                <Section title={`Rows with errors — will be skipped (${invalidRows.length})`} tone="red">
                  <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                    {invalidRows.map(r => (
                      <div key={r.rowNumber} className="px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[11px] font-mono text-slate-500">#{r.rowNumber}</span>
                          <span className="text-[13px] font-semibold text-slate-800">{r.rawCompanyName || '(no company name)'}</span>
                        </div>
                        <ul className="mt-0.5 text-[11px] text-red-700 list-disc list-inside pl-2">
                          {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-red-50/40 text-[11px] text-red-900 border-t border-red-100">
                    Fix these rows in your spreadsheet and re-upload to import them. They won't be lost — they're just not imported now.
                  </div>
                </Section>
              )}

              {newRows.length === 0 && duplicateRows.length === 0 && invalidRows.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <div className="text-[14px] font-semibold text-slate-700">No data rows found</div>
                  <div className="text-[12px] text-slate-500 mt-1">The file was parsed but contained no client rows. Did you delete the example rows by mistake?</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-between gap-3 shrink-0">
          {stage === 'preview' && (
            <button
              onClick={() => {
                setStage('select');
                setParseResult(null);
                setFileName('');
              }}
              className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            {stage === 'preview' && parseResult && (
              <button
                onClick={performImport}
                disabled={newRows.length === 0 && Object.values(duplicateActions).every(a => a === 'skip')}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors shadow-sm inline-flex items-center gap-2"
              >
                Import {newRows.length + Object.values(duplicateActions).filter(a => a === 'overwrite').length} client(s)
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Small bits ---------------------------------------------------------------

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
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">
        {icon}{label}
      </div>
      <div className="text-2xl font-bold mt-1">{count}</div>
      <div className="text-[11px] opacity-80">{description}</div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  tone: 'green' | 'amber' | 'red';
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, tone, rightContent, children }) => {
  const borderClass = { green: 'border-emerald-200', amber: 'border-amber-200', red: 'border-red-200' }[tone];
  const headerClass = { green: 'bg-emerald-50 text-emerald-900', amber: 'bg-amber-50 text-amber-900', red: 'bg-red-50 text-red-900' }[tone];
  return (
    <div className={cn('bg-white border rounded-lg overflow-hidden', borderClass)}>
      <div className={cn('px-3 py-2 flex items-center justify-between border-b text-[12px] font-bold', borderClass, headerClass)}>
        <span>{title}</span>
        {rightContent}
      </div>
      {children}
    </div>
  );
};

const DupActionButton: React.FC<{ label: string; active: boolean; onClick: () => void; tone: 'overwrite' | 'skip' }> = ({ label, active, onClick, tone }) => {
  const activeClass = tone === 'overwrite'
    ? 'bg-amber-600 text-white border-amber-600'
    : 'bg-slate-900 text-white border-slate-900';
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-[11px] font-semibold rounded border transition-colors',
        active ? activeClass : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      )}
    >
      {label}
    </button>
  );
};