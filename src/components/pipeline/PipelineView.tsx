import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealType } from '../../types';
import { Plus, Search, Building2, Edit2, Upload, GitBranch, Trash2, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { DealDetailForm } from '../clients/DealDetailForm';
import { SOCManagerModal } from './SOCManagerModal';
import { RenewalImportModal } from './RenewalImportModal';
import { DealJourneyView } from './DealJourneyView';
import { ApprovalActionMenu, ApprovalStatusBadge } from './ApprovalActionMenu';

export const PipelineView = () => {
  const { deals, clients, deleteDeal, bindDeal } = useData();
  const [activeTab, setActiveTab] = useState<DealType>('New Business');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [socDeal, setSocDeal] = useState<Deal | null>(null);
  const [journeyDeal, setJourneyDeal] = useState<Deal | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Deal | null>(null);
  const [bindCandidate, setBindCandidate] = useState<Deal | null>(null);

  const confirmBind = () => {
    if (!bindCandidate) return;
    if (!bindCandidate.insuranceCompany) {
      toast.error('Insurance Company is required before binding. Edit the deal first.');
      setEditDeal(bindCandidate);
      setBindCandidate(null);
      return;
    }
    const ok = bindDeal(bindCandidate.id);
    if (!ok) {
      toast.error('Could not bind this deal.');
      return;
    }
    const name = clients.find(c => c.id === bindCandidate.clientId)?.companyName || 'Deal';
    toast.success(`${name} bound and added to Policies.`);
    setBindCandidate(null);
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    deleteDeal(deleteCandidate.id);
    const name = clients.find(c => c.id === deleteCandidate.clientId)?.companyName || 'Deal';
    toast.success(`${name} — ${deleteCandidate.typeOfInsurance || 'deal'} removed.`);
    setDeleteCandidate(null);
  };

  // If we have a journey deal selected, render the dedicated journey page.
  if (journeyDeal) {
    const freshDeal = deals.find(d => d.id === journeyDeal.id) || journeyDeal;
    return <DealJourneyView deal={freshDeal} onBack={() => setJourneyDeal(null)} />;
  }

  const filteredDeals = deals.filter(d => {
    // Determine which tab the deal belongs to
    const isRenewalTab = ['Renewal', 'Existing Client Update'].includes(d.dealType);
    const isNewBusinessTab = !isRenewalTab; // 'New Business', 'Cross Sell', 'Upsell'

    if (activeTab === 'New Business' && !isNewBusinessTab) return false;
    if (activeTab === 'Renewal' && !isRenewalTab) return false;

    if (filterType !== 'All' && d.dealType !== filterType) return false;
    
    if (search) {
      const q = search.toLowerCase();
      const client = clients.find(c => c.id === d.clientId);
      const companyMatch = client && (client.companyName || '').toLowerCase().includes(q);
      const lobMatch = client && (client.lineOfBusiness || '').toLowerCase().includes(q);
      const stageMatch = (d.statusStage || '').toLowerCase().includes(q);
      const typeMatch = (d.typeOfInsurance || '').toLowerCase().includes(q);
      
      return companyMatch || lobMatch || stageMatch || typeMatch;
    }
    return true;
  }).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleGenerateSOC = (e: React.MouseEvent, deal: Deal) => {
    e.stopPropagation();
    setSocDeal(deal);
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Leads': 'bg-slate-100 text-slate-700',
      'Data Collection': 'bg-blue-100 text-blue-700',
      'Quote': 'bg-purple-100 text-purple-700',
      'Nego': 'bg-amber-100 text-amber-700',
      'Bind / Closed Won': 'bg-emerald-100 text-emerald-700',
      'Policy On Progress': 'bg-teal-100 text-teal-700',
      'Lost': 'bg-red-100 text-red-700',
    };
    return colors[stage] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="h-full flex flex-col p-8 relative bg-slate-50">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Pipeline & Opportunities</h1>
          <p className="text-[13px] text-slate-500">Monitor and track deal opportunities connected to your clients.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors border border-slate-200 shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import Renewals
          </button>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Deal
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-px shrink-0">
        <button 
          onClick={() => { setActiveTab('New Business'); setFilterType('All'); }}
          className={cn(
            "pb-2 text-[13px] font-semibold transition-colors relative",
            activeTab === 'New Business' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"
          )}
        >
          New Business Clients
        </button>
        <button 
          onClick={() => { setActiveTab('Renewal'); setFilterType('All'); }}
          className={cn(
            "pb-2 text-[13px] font-semibold transition-colors relative",
            activeTab === 'Renewal' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"
          )}
        >
          Renewal Clients
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by company, insurance type, or stage..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="All">All Deals in Tab</option>
              {activeTab === 'New Business' && (
                <>
                  <option value="New Business">New Business</option>
                  <option value="Cross Sell">Cross Sell</option>
                  <option value="Upsell">Upsell</option>
                </>
              )}
              {activeTab === 'Renewal' && (
                <>
                  <option value="Renewal">Renewal</option>
                  <option value="Existing Client Update">Existing Client Update</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Company Name</th>
                <th className="px-6 py-3 font-semibold text-slate-600">LOB / Insurance Type</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Deal Info</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Sum Insured</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Premium</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Stage</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Approval</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Last Updated</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeals.map(deal => {
                const client = clients.find(c => c.id === deal.clientId);
                return (
                  <tr key={deal.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {client ? client.companyName : 'Unknown Client'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800">{client ? client.lineOfBusiness : '-'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {deal.typeOfInsurance && <span className="text-[11px] text-slate-500">{deal.typeOfInsurance}</span>}
                        {(deal.periodStart || deal.periodEnd) && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {deal.periodStart ? new Date(deal.periodStart).toLocaleDateString() : 'N/A'} - {deal.periodEnd ? new Date(deal.periodEnd).toLocaleDateString() : 'N/A'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                        deal.dealType === 'New Business' ? "bg-blue-50 text-blue-700 border-blue-200" 
                        : deal.dealType === 'Renewal' ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                      )}>
                        {deal.dealType}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-mono text-slate-600 font-semibold">{deal.currency} {deal.sumInsured?.toLocaleString() || '0'}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-mono text-slate-600 font-semibold">{deal.premiumAmount ? `${deal.currency} ${deal.premiumAmount.toLocaleString()}` : '-'}</div>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setJourneyDeal(deal); }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide hover:ring-2 hover:ring-blue-300 transition-shadow cursor-pointer",
                          getStageColor(deal.statusStage)
                        )}
                        title="Open journey & log a transition"
                      >
                        {deal.statusStage}
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <ApprovalStatusBadge status={deal.approvalStatus} />
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs text-mono">
                      {new Date(deal.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {deal.statusStage !== 'Policy On Progress' && deal.statusStage !== 'Lost' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setBindCandidate(deal); }}
                            className="text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded transition-colors flex items-center gap-1 shadow-sm"
                            title="Bind — move to Policy On Progress and add to Policies"
                          >
                            <ShieldCheck className="w-3 h-3" /> Bind
                          </button>
                        )}
                        <ApprovalActionMenu deal={deal} />
                        <button
                          onClick={(e) => handleGenerateSOC(e, deal)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                        >
                          Generate SOC
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDeal(deal);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Deal"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setJourneyDeal(deal); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Open Journey"
                        >
                          <GitBranch className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteCandidate(deal); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Deal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {filteredDeals.length === 0 && (
             <div className="p-12 text-center text-slate-500 flex flex-col justify-center items-center">
               <Building2 className="w-10 h-10 text-slate-300 mb-3" />
               <p className="font-medium text-slate-900 mb-1">No deals found</p>
               <p className="text-[13px] text-slate-500">Create a deal linked to a client.</p>
             </div>
          )}
        </div>
      </div>

      {isAddOpen && (
        <DealDetailForm onClose={() => setIsAddOpen(false)} />
      )}
      {isImportOpen && (
        <RenewalImportModal onClose={() => setIsImportOpen(false)} />
      )}
      {editDeal && (
        <DealDetailForm deal={editDeal} onClose={() => setEditDeal(null)} />
      )}
      {socDeal && (
        <SOCManagerModal
          deal={socDeal}
          client={clients.find(c => c.id === socDeal.clientId)!}
          onClose={() => setSocDeal(null)}
        />
      )}

      {bindCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Bind this deal?</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">Move to <span className="font-semibold">Policy On Progress</span> and list under Policies.</p>
                </div>
              </div>
              <button
                onClick={() => setBindCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[13px] text-slate-700">
              <p>
                <span className="font-semibold">
                  {clients.find(c => c.id === bindCandidate.clientId)?.companyName || 'Unknown Client'}
                </span>{' '}
                <span className="text-slate-500">— {bindCandidate.typeOfInsurance || 'no insurance type'} • {bindCandidate.insuranceCompany || 'No insurer set'}</span>
              </p>
              <ul className="text-[12px] text-slate-500 space-y-1 pl-4 list-disc">
                <li>Bind date is stamped to today, anchoring invoice aging (30 / 90 / 120 day reminders).</li>
                <li>The deal becomes visible on the Policies list.</li>
                <li>Any New Business deal is also auto-rolled to the Renewal track for next cycle.</li>
              </ul>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button
                onClick={() => setBindCandidate(null)}
                className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmBind}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> Bind &amp; Add to Policies
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Delete pipeline deal?</h3>
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
                You're about to remove the deal for{' '}
                <span className="font-semibold">
                  {clients.find(c => c.id === deleteCandidate.clientId)?.companyName || 'Unknown Client'}
                </span>{' '}
                <span className="text-slate-500">({deleteCandidate.typeOfInsurance || 'no insurance type'})</span>.
              </p>
              <p className="text-[12px] text-slate-500">
                Its stage history, approval log, commission and document references will be deleted with it.
                Related claims and endorsements will remain but lose their link.
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
                <Trash2 className="w-4 h-4" /> Delete deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
