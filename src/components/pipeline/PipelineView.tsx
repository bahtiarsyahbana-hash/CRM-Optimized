import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealStage, DealType } from '../../types';
import { Plus, Search, Building2, MoreHorizontal, CheckCircle2, Edit2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { generateSOC } from '../../utils/socGenerator';
import toast from 'react-hot-toast';
import { DealDetailForm } from '../clients/DealDetailForm';
import { SOCManagerModal } from './SOCManagerModal';import { RenewalImportModal } from './RenewalImportModal';

export const PipelineView = () => {
  const { deals, clients, updateDealStage } = useData();
  const [activeTab, setActiveTab] = useState<DealType>('New Business');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [socDeal, setSocDeal] = useState<Deal | null>(null);
  const [activeDealForStage, setActiveDealForStage] = useState<Deal | null>(null);

  const STAGES = activeTab === 'New Business' 
    ? ['Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress', 'Lost'] as DealStage[]
    : ['Policy On Progress', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Lost'] as DealStage[];

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

  const openStageManager = (e: React.MouseEvent, deal: Deal) => {
    e.stopPropagation();
    setActiveDealForStage(deal);
  };

  const handleStageChange = (newStage: DealStage) => {
    if (activeDealForStage) {
      if (newStage === 'Policy On Progress' && !activeDealForStage.insuranceCompany) {
        toast.error('Insurance Company is required before moving to Policy On Progress.');
        setEditDeal(activeDealForStage);
        setActiveDealForStage(null);
        return;
      }

      updateDealStage(activeDealForStage.id, newStage);
      setActiveDealForStage(d => d ? { ...d, statusStage: newStage } : null);
      toast.success('Stage updated!');
    }
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
                      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide", getStageColor(deal.statusStage))}>
                        {deal.statusStage}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs text-mono">
                      {new Date(deal.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          onClick={(e) => openStageManager(e, deal)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Update Stage"
                        >
                          <MoreHorizontal className="w-5 h-5" />
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

      {activeDealForStage && (
        <div className="absolute top-0 right-0 bottom-0 w-[400px] bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Manage Workflow Stage</h3>
              <p className="text-[13px] text-slate-500 mt-1">Update pipeline phase.</p>
            </div>
            <button onClick={() => setActiveDealForStage(null)} className="text-slate-400 hover:text-slate-600 p-1">
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Click to move to new stage</h4>
            <div className="flex flex-col gap-2 relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200 z-0"></div>
              
              {STAGES.map((stage, idx) => {
                const isActive = activeDealForStage.statusStage === stage;
                const isPast = STAGES.indexOf(activeDealForStage.statusStage) > idx;

                return (
                  <button
                    key={stage}
                    onClick={() => handleStageChange(stage)}
                    className={cn(
                      "relative z-10 flex items-center gap-4 p-3 rounded-lg border text-left transition-all",
                      isActive 
                        ? "bg-blue-50 border-blue-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" 
                        : isPast 
                          ? "bg-white border-slate-200 hover:border-slate-300 opacity-70" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-white",
                      isActive ? "border-blue-500 text-blue-600" : isPast ? "border-emerald-500 text-emerald-500" : "border-slate-200 text-slate-300"
                    )}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-blue-600" : "bg-slate-300")}></div>}
                    </div>
                    <div>
                      <div className={cn("font-semibold text-[13px]", isActive ? "text-blue-900" : "text-slate-700")}>{stage}</div>
                      {isActive && <div className="text-[11px] text-blue-600 font-medium">Current Stage</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={() => setActiveDealForStage(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] py-2.5 rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
};
