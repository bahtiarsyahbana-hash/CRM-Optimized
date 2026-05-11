import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { ShieldAlert, FileEdit, Plus, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export const AftersalesView = () => {
  const { deals, claims, endorsements, addClaim, updateClaimStatus, addEndorsement, updateEndorsementStatus } = useData();
  const [activeTab, setActiveTab] = useState<'claims' | 'endorsements'>('claims');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [dealId, setDealId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Only show deals that are "Policy Active" or logically active
  const activeDeals = deals.filter(d => d.statusStage === 'Policy On Progress' || d.statusStage === 'Bind / Closed Won');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealId || !title || !description) {
      return toast.error('All fields required');
    }

    if (activeTab === 'claims') {
      addClaim({ dealId, title, description, status: 'Claim Registered' });
      toast.success('Claim filed successfully');
    } else {
      addEndorsement({ dealId, type: title, description, status: 'Requested' });
      toast.success('Endorsement requested successfully');
    }

    setIsAddOpen(false);
    setDealId(''); setTitle(''); setDescription('');
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Claim Registered': case 'Requested': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pending': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Under Assessment': case 'Underwriting': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Approved': case 'Re-bound': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Settled': return 'bg-emerald-200 text-emerald-800 border-emerald-300';
      case 'Reject': case 'Declined': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-full flex flex-col -m-8">
      {/* Sub Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Aftersales Service</h1>
          <p className="text-[13px] text-slate-500">Manage active policy claims and endorsements</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'claims' ? 'File Claim' : 'Request Endorsement'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex gap-4 shrink-0">
        <button
          onClick={() => setActiveTab('claims')}
          className={cn(
            "pb-2 text-[13px] font-semibold transition-colors relative",
            activeTab === 'claims' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Claims Management
          </div>
        </button>
        <button
          onClick={() => setActiveTab('endorsements')}
          className={cn(
            "pb-2 text-[13px] font-semibold transition-colors relative",
            activeTab === 'endorsements' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4" /> Policy Endorsements
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50 max-w-4xl mx-auto w-full">
        {activeTab === 'claims' && (
          <div className="space-y-4">
            {claims.map(claim => {
              const deal = deals.find(d => d.id === claim.dealId);
              return (
                <div key={claim.id} className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm flex items-start gap-5">
                  <div className="p-2.5 bg-red-50 text-red-600 rounded-md shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-[14px]">{claim.title}</h4>
                        <div className="text-[13px] text-slate-500 flex gap-2 items-center">
                          <span>{new Date(claim.dateRegistered || claim.dateFiled || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase", getStatusColor(claim.status))}>
                        {claim.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[13px] mt-2">{claim.description}</p>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                      <select
                        value={claim.status}
                        onChange={(e) => updateClaimStatus(claim.id, e.target.value as any)}
                        className="text-[12px] bg-white border border-slate-200 rounded text-slate-700 px-2 py-1 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Claim Registered">Claim Registered</option>
                        <option value="Pending">Pending</option>
                        <option value="Under Assessment">Under Assessment</option>
                        <option value="Approved">Approved</option>
                        <option value="Settled">Settled</option>
                        <option value="Reject">Reject</option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
            {claims.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 text-[13px]">
                No claims filed yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'endorsements' && (
          <div className="space-y-4">
            {endorsements.map(endors => {
              const deal = deals.find(d => d.id === endors.dealId);
              return (
                <div key={endors.id} className="bg-white border border-slate-200 p-5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-start gap-5">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-md shrink-0">
                    <FileEdit className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="font-semibold text-[14px] text-slate-900">{endors.type}</h4>
                        <div className="text-[13px] text-slate-500 flex gap-2 items-center">
                          <span>{new Date(endors.dateRequested).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase font-semibold border", getStatusColor(endors.status))}>
                        {endors.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[13px] mt-2">{endors.description}</p>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                      <select
                        value={endors.status}
                        onChange={(e) => updateEndorsementStatus(endors.id, e.target.value as any)}
                        className="text-[12px] bg-white border border-slate-200 rounded text-slate-700 px-2 py-1 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Requested">Requested</option>
                        <option value="Underwriting">Underwriting</option>
                        <option value="Re-bound">Re-bound</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
            {endorsements.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 text-[13px]">
                No endorsements requested yet.
              </div>
            )}
          </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-serif font-semibold mb-6">
              New {activeTab === 'claims' ? 'Claim' : 'Endorsement'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Select Policy</label>
                <select value={dealId} onChange={e => setDealId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors">
                  <option value="">-- Select Active Policy --</option>
                  {activeDeals.map(d => {
                    return <option key={d.id} value={d.id}>{d.typeOfInsurance}</option>
                  })}
                </select>
                {activeDeals.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No active policies found. Move a deal to 'Policy On Progress' or 'Bind / Closed Won' first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  {activeTab === 'claims' ? 'Incident Title' : 'Endorsement Type'}
                </label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Brief title..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Description / Details</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Provide full details..."></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={!dealId} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};