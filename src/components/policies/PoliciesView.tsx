import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { FileText, Download, Upload, ShieldAlert, FileEdit, ExternalLink, X, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Deal, Client } from '../../types';
import toast from 'react-hot-toast';
import { generateCoverNote } from '../../utils/coverNoteGenerator';
import { PolicyPreviewModal } from './PolicyPreviewModal';

export const PoliciesView = () => {
  const { deals, clients, updateDeal, addClaim, addEndorsement } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [periodStartFrom, setPeriodStartFrom] = useState('');
  const [periodStartTo, setPeriodStartTo] = useState('');
  const [periodEndFrom, setPeriodEndFrom] = useState('');
  const [periodEndTo, setPeriodEndTo] = useState('');

  // Show policies that are in progress or already completed/bound
  const policies = deals.filter(d => {
    const matchesStatus =
      d.statusStage === 'Policy On Progress' ||
      d.statusStage === 'Bind / Closed Won' ||
      d.dealType === 'Renewal';
    if (!matchesStatus) return false;

    const matchesSearch =
      d.typeOfInsurance.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clients.find(c => c.id === d.clientId)?.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const startTime = d.periodStart ? new Date(d.periodStart).getTime() : null;
    const endTime = d.periodEnd ? new Date(d.periodEnd).getTime() : null;

    if (periodStartFrom) {
      if (startTime === null || startTime < new Date(periodStartFrom).getTime()) return false;
    }
    if (periodStartTo) {
      if (startTime === null || startTime > new Date(periodStartTo).getTime()) return false;
    }
    if (periodEndFrom) {
      if (endTime === null || endTime < new Date(periodEndFrom).getTime()) return false;
    }
    if (periodEndTo) {
      if (endTime === null || endTime > new Date(periodEndTo).getTime()) return false;
    }

    return true;
  });

  const hasPeriodFilter = periodStartFrom || periodStartTo || periodEndFrom || periodEndTo;
  const clearPeriodFilters = () => {
    setPeriodStartFrom('');
    setPeriodStartTo('');
    setPeriodEndFrom('');
    setPeriodEndTo('');
  };

  const [selectedPolicy, setSelectedPolicy] = useState<Deal | null>(null);

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
          <p className="text-[13px] text-slate-500">Manage issued policies, cover notes, and request aftersales services.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
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
          <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-md shadow-sm px-3 py-2">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Period Start</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={periodStartFrom}
                  onChange={(e) => setPeriodStartFrom(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400">to</span>
                <input
                  type="date"
                  value={periodStartTo}
                  onChange={(e) => setPeriodStartTo(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Period End</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={periodEndFrom}
                  onChange={(e) => setPeriodEndFrom(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400">to</span>
                <input
                  type="date"
                  value={periodEndTo}
                  onChange={(e) => setPeriodEndTo(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {hasPeriodFilter && (
              <button
                onClick={clearPeriodFilters}
                className="self-end flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                title="Clear period filters"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
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
              <th className="px-6 py-3">Original Policy</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {policies.map(policy => {
              const client = clients.find(c => c.id === policy.clientId);
              return (
                <tr key={policy.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{client?.companyName || 'Unknown Client'}</div>
                    <div className="text-[12px] text-slate-500 mt-1 flex items-center gap-2">
                       {policy.typeOfInsurance} <span className="text-slate-300">•</span> {policy.insuranceCompany || 'TBA'}
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
                    {policy.originalPolicyFile ? (
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
                         onClick={() => setSelectedPolicy(policy)}
                         className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                         title="Manage Policy"
                      >
                         <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            
            {policies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-[13px]">
                  No policies found. Move deals to "Policy On Progress" to manage them here.
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
    </div>
  );
};
