import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { FileText, ExternalLink, X, Search, Receipt, ChevronRight, ChevronDown, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Deal } from '../../types';
import toast from 'react-hot-toast';
import { generateCoverNote } from '../../utils/coverNoteGenerator';
import { PolicyPreviewModal } from './PolicyPreviewModal';
import { InvoiceModal } from './InvoiceModal';
import { getInvoiceAging } from '../../utils/invoiceAging';

export const PoliciesView: React.FC<{
  /** Seeded by dashboard drill-through (Insurer Panel lands on one insurer). */
  initialSearch?: string;
}> = ({ initialSearch = '' }) => {
  const { deals, clients, updateDeal } = useData();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  // Single-month filter against periodStart — "show policies whose period starts in this month"
  const [periodStartMonth, setPeriodStartMonth] = useState(''); // format: YYYY-MM

  // Show policies that are in progress or already completed/bound
  const policies = deals.filter(d => {
    const matchesStatus =
      d.statusStage === 'Policy On Progress' ||
      d.statusStage === 'Bind / Closed Won' ||
      d.dealType === 'Renewal';
    if (!matchesStatus) return false;

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      d.typeOfInsurance.toLowerCase().includes(q) ||
      (d.insuranceCompany || '').toLowerCase().includes(q) ||
      clients.find(c => c.id === d.clientId)?.companyName.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (periodStartMonth) {
      if (!d.periodStart) return false;
      const [yStr, mStr] = periodStartMonth.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1; // JS month index
      const monthStart = new Date(y, m, 1).getTime();
      const monthEnd = new Date(y, m + 1, 1).getTime(); // exclusive
      const startTime = new Date(d.periodStart).getTime();
      if (startTime < monthStart || startTime >= monthEnd) return false;
    }

    return true;
  });

  const clearPeriodFilters = () => setPeriodStartMonth('');

  const [selectedPolicy, setSelectedPolicy] = useState<Deal | null>(null);
  const [invoicePolicy, setInvoicePolicy] = useState<Deal | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Upload a file and persist it as the originalPolicyFile of a specific line. */
  const handleUploadLine = (dealId: string, lineId: string) => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'application/pdf';
    picker.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const deal = deals.find(d => d.id === dealId);
      if (!deal || !deal.lines) return;
      const lines = deal.lines.map(l => l.id === lineId ? { ...l, originalPolicyFile: file.name } : l);
      updateDeal(dealId, { lines });
      toast.success(`${file.name} uploaded.`);
    };
    picker.click();
  };

  /** Patch a line's cover note number. */
  const handleLineCoverNote = (dealId: string, lineId: string, value: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal || !deal.lines) return;
    const lines = deal.lines.map(l => l.id === lineId ? { ...l, coverNoteNumber: value || undefined } : l);
    updateDeal(dealId, { lines });
  };

  const handleUploadOriginal = (dealId: string) => {
    // Simulate upload process
    const filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.accept = 'application/pdf';
    filePicker.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const deal = deals.find(d => d.id === dealId);
        if (deal) {
          updateDeal(dealId, { ...deal, originalPolicyFile: file.name });
          toast.success(`Policy ${file.name} uploaded successfully.`);
        }
      }
    };
    filePicker.click();
  };

  const handleDownloadCoverNote = (deal: Deal) => {
    const client = clients.find(c => c.id === deal.clientId);
    if (!client) return toast.error('Client data missing');
    generateCoverNote(deal, client);
    toast.success('Cover note downloaded');
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 relative">
      <div className="mb-6 flex items-start justify-between shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Active Policies</h1>
          <p className="text-[13px] text-slate-500">
            Manage issued policies, cover notes, and request aftersales services.
            {periodStartMonth && (
              <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                {policies.length} {policies.length === 1 ? 'policy' : 'policies'} starting in{' '}
                {new Date(periodStartMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md shadow-sm px-3 py-2">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold whitespace-nowrap">
              Period Start (Month)
            </label>
            <input
              type="month"
              value={periodStartMonth}
              onChange={(e) => setPeriodStartMonth(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {periodStartMonth && (
              <button
                onClick={clearPeriodFilters}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-1 rounded hover:bg-slate-100 transition-colors"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search policies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold sticky top-0 z-10">
              <th className="px-6 py-3">Client & Insurance</th>
              <th className="px-6 py-3">Period</th>
              <th className="px-6 py-3">Sum Insured</th>
              <th className="px-6 py-3">Premium</th>
              <th className="px-6 py-3">Invoice</th>
              <th className="px-6 py-3">Original Policy</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {policies.map(policy => {
              const client = clients.find(c => c.id === policy.clientId);
              const isMulti = !!policy.lines && policy.lines.length > 1;
              const isExpanded = expandedIds.has(policy.id);
              return (
              <React.Fragment key={policy.id}>
                <tr className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isMulti && (
                        <button
                          onClick={() => toggleExpanded(policy.id)}
                          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={isExpanded ? 'Hide products' : 'Show products'}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">{client?.companyName || 'Unknown Client'}</div>
                        <div className="text-[12px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          {policy.typeOfInsurance} <span className="text-slate-300">•</span> {policy.insuranceCompany || 'TBA'}
                          {isMulti && (
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                              {policy.lines!.length} products
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-[12px] font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                       {policy.periodStart ? new Date(policy.periodStart).toLocaleDateString() : 'TBA'} 
                       {" -> "} 
                       {policy.periodEnd ? new Date(policy.periodEnd).toLocaleDateString() : 'TBA'}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="text-[13px] font-medium text-slate-800">
                        {policy.currency} {policy.sumInsured?.toLocaleString() || '-'}
                     </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="text-[13px] font-medium text-slate-800">
                        {policy.currency} {policy.premiumAmount?.toLocaleString() || '-'}
                     </div>
                     {policy.premiumRate && (
                       <div className="text-[11px] text-slate-500 mt-0.5">Rate: {policy.premiumRate}</div>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const aging = getInvoiceAging(policy);
                      return (
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border w-fit',
                            aging.className
                          )}>
                            {policy.paymentStatus === 'Paid' ? 'Paid' : aging.label}
                          </span>
                          {policy.paymentStatus !== 'Paid' && policy.invoiceDate && (
                            <span className="text-[10px] text-slate-400">
                              Inv: {new Date(policy.invoiceDate).toLocaleDateString()}
                            </span>
                          )}
                          {!policy.invoiceDate && policy.paymentStatus !== 'Paid' && (
                            <span className="text-[10px] text-slate-400 italic">no invoice yet</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    {isMulti ? (() => {
                      const uploaded = policy.lines!.filter(l => l.originalPolicyFile).length;
                      const total = policy.lines!.length;
                      return (
                        <button
                          onClick={() => toggleExpanded(policy.id)}
                          className={cn(
                            'text-[12px] font-semibold px-2.5 py-1 rounded border transition-colors',
                            uploaded === total
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : uploaded === 0
                                ? 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          )}
                          title="Click to manage per-product files"
                        >
                          {uploaded}/{total} uploaded
                        </button>
                      );
                    })() : policy.originalPolicyFile ? (
                      <div className="flex items-center gap-2 text-[12px] font-medium text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded w-fit">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{policy.originalPolicyFile}</span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-400 italic">Not uploaded</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setInvoicePolicy(policy)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                        title="Manage Invoice"
                      >
                        <Receipt className="w-3.5 h-3.5" /> Invoice
                      </button>
                      <button
                         onClick={() => setSelectedPolicy(policy)}
                         className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                         title="Manage Policy"
                      >
                         <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {isMulti && isExpanded && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={7} className="px-6 py-3">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Products on this policy ({policy.lines!.length})
                      </div>
                      <div className="space-y-2">
                        {policy.lines!.map((line, i) => (
                          <div
                            key={line.id}
                            className="flex items-center gap-3 bg-white border border-slate-200 rounded-md px-3 py-2.5"
                          >
                            <span className="text-[11px] font-bold text-slate-400 w-6 shrink-0">P{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-slate-800 truncate">
                                {line.productName || '—'}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                SI {policy.currency} {line.sumInsured?.toLocaleString() || '-'}
                                <span className="mx-1 text-slate-300">•</span>
                                Prem {policy.currency} {line.premiumAmount?.toLocaleString() || '-'}
                              </div>
                            </div>
                            <div className="shrink-0">
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-semibold uppercase tracking-wider">Cover Note</label>
                              <input
                                type="text"
                                defaultValue={line.coverNoteNumber || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (line.coverNoteNumber || '')) {
                                    handleLineCoverNote(policy.id, line.id, e.target.value);
                                  }
                                }}
                                placeholder="CN/2026/…"
                                className="w-40 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {line.originalPolicyFile ? (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded max-w-[160px]">
                                  <FileText className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{line.originalPolicyFile}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">no file</span>
                              )}
                              <button
                                onClick={() => handleUploadLine(policy.id, line.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                              >
                                <Upload className="w-3 h-3" />
                                {line.originalPolicyFile ? 'Replace' : 'Upload'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              )
            })}
            
            {policies.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-[13px]">
                  No policies found. Bind a deal from the Pipeline to add it here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPolicy && (
        <PolicyPreviewModal
           policy={selectedPolicy}
           client={clients.find(c => c.id === selectedPolicy.clientId)!}
           onClose={() => setSelectedPolicy(null)}
           onUploadOriginal={() => handleUploadOriginal(selectedPolicy.id)}
           onDownloadCoverNote={() => handleDownloadCoverNote(selectedPolicy)}
        />
      )}

      {invoicePolicy && (
        <InvoiceModal
          policy={deals.find(d => d.id === invoicePolicy.id) || invoicePolicy}
          clientName={clients.find(c => c.id === invoicePolicy.clientId)?.companyName || 'Unknown Client'}
          onClose={() => setInvoicePolicy(null)}
        />
      )}
    </div>
  );
};
