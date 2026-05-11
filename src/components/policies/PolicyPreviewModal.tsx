import React, { useState } from 'react';
import { Deal, Client, Currency, CURRENCIES } from '../../types';
import { X, Download, Upload, ShieldAlert, FileEdit, FileText } from 'lucide-react';
import { useData } from '../../context/DataContext';
import toast from 'react-hot-toast';

interface Props {
  policy: Deal;
  client: Client;
  onClose: () => void;
  onUploadOriginal: () => void;
  onDownloadCoverNote: () => void;
}

export const PolicyPreviewModal = ({ policy, client, onClose, onUploadOriginal, onDownloadCoverNote }: Props) => {
  const { addClaim, addEndorsement } = useData();
  const [activeTab, setActiveTab] = useState<'preview' | 'aftersales'>('preview');

  // Aftersales state
  const [requestType, setRequestType] = useState<'claim' | 'endorsement'>('endorsement');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');

  // Claim-specific fields
  const [claimDateReported, setClaimDateReported] = useState<string>(new Date().toISOString().slice(0, 10));
  const [claimEstimatedAmount, setClaimEstimatedAmount] = useState<string>('');
  const [claimCurrency, setClaimCurrency] = useState<Currency>((policy.currency as Currency) || 'IDR');

  const handleAftersalesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle || !requestDescription) return toast.error('All fields required');

    if (requestType === 'claim') {
      if (!claimDateReported) return toast.error('Date Reported is required for claims');
      const estAmount = claimEstimatedAmount ? parseFloat(claimEstimatedAmount.replace(/,/g, '')) : undefined;
      addClaim({
        dealId: policy.id,
        title: requestTitle,
        description: requestDescription,
        status: 'Claim Registered',
        dateReported: new Date(claimDateReported).toISOString(),
        estimatedAmount: estAmount,
        currency: claimCurrency,
        insuranceCompany: policy.insuranceCompany,
      });
      toast.success('Claim registered successfully');
    } else {
      addEndorsement({ dealId: policy.id, type: requestTitle, description: requestDescription, status: 'Requested' });
      toast.success('Endorsement requested successfully');
    }

    setRequestTitle('');
    setRequestDescription('');
    setClaimEstimatedAmount('');
  };

  const coverNoteNumber = policy.coverNoteNumber || `CN-Draft-${new Date().getFullYear()}`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{client.companyName} — Policy</h2>
              <p className="text-[12px] font-medium text-slate-500">{policy.typeOfInsurance} • {policy.insuranceCompany || 'TBA'} • {coverNoteNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-2 border-b border-slate-100 flex gap-4 shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-3 text-[13px] font-semibold transition-colors ${activeTab === 'preview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Policy Preview
          </button>
          <button
            onClick={() => setActiveTab('aftersales')}
            className={`pb-3 text-[13px] font-semibold transition-colors ${activeTab === 'aftersales' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Aftersales (Claim/Endorsement)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">

          {activeTab === 'preview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Cover Note</div>
                <div className="text-[14px] font-bold text-slate-900 mb-1">{coverNoteNumber}</div>
                <div className="text-[12px] text-slate-500">Generated from deal data</div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                  <button onClick={onDownloadCoverNote} className="px-3 py-2 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download Cover Note
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Original Policy</div>
                {policy.originalPolicyFile ? (
                  <div className="text-[13px] font-medium text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    {policy.originalPolicyFile}
                  </div>
                ) : (
                  <div className="text-[12px] text-slate-500 italic">No file uploaded</div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                  <button onClick={onUploadOriginal} className="px-3 py-2 text-[12px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> {policy.originalPolicyFile ? 'Replace' : 'Upload'} PDF
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Key Details</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
                  <div>
                    <div className="text-slate-500 text-[11px]">Sum Insured</div>
                    <div className="font-semibold text-slate-900">{policy.currency} {policy.sumInsured?.toLocaleString() || '-'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Premium</div>
                    <div className="font-semibold text-slate-900">{policy.currency} {policy.premiumAmount?.toLocaleString() || '-'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Period Start</div>
                    <div className="font-semibold text-slate-900">{policy.periodStart ? new Date(policy.periodStart).toLocaleDateString() : '-'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Period End</div>
                    <div className="font-semibold text-slate-900">{policy.periodEnd ? new Date(policy.periodEnd).toLocaleDateString() : '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'aftersales' && (
            <div className="max-w-2xl mx-auto py-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <form onSubmit={handleAftersalesSubmit}>
                  <div className="flex space-x-6 mb-8 border-b border-slate-100 pb-6">
                    <label className={`flex flex-col items-center justify-center p-4 rounded-lg flex-1 cursor-pointer border-2 transition-all ${requestType === 'endorsement' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                      <input type="radio" className="sr-only" checked={requestType === 'endorsement'} onChange={() => setRequestType('endorsement')} />
                      <FileEdit className={`w-8 h-8 mb-2 ${requestType === 'endorsement' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className={`text-[13px] font-bold ${requestType === 'endorsement' ? 'text-blue-900' : 'text-slate-500'}`}>Request Endorsement</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center p-4 rounded-lg flex-1 cursor-pointer border-2 transition-all ${requestType === 'claim' ? 'border-red-500 bg-red-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                      <input type="radio" className="sr-only" checked={requestType === 'claim'} onChange={() => setRequestType('claim')} />
                      <ShieldAlert className={`w-8 h-8 mb-2 ${requestType === 'claim' ? 'text-red-600' : 'text-slate-400'}`} />
                      <span className={`text-[13px] font-bold ${requestType === 'claim' ? 'text-red-900' : 'text-slate-500'}`}>Report Claim</span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                        {requestType === 'claim' ? 'Claim Title' : 'Endorsement Type / Title'}
                      </label>
                      <input
                        type="text"
                        value={requestTitle}
                        onChange={(e) => setRequestTitle(e.target.value)}
                        placeholder={requestType === 'claim' ? "e.g., Fire Damage at Warehouse" : "e.g., Change of Address"}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Description</label>
                      <textarea
                        value={requestDescription}
                        onChange={(e) => setRequestDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px] min-h-[120px] resize-y"
                        placeholder={requestType === 'claim' ? "Describe the incident..." : "Describe the requested changes..."}
                      />
                    </div>

                    {requestType === 'claim' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 mt-2">
                        <div>
                          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Date Reported *</label>
                          <input
                            type="date"
                            value={claimDateReported}
                            onChange={(e) => setClaimDateReported(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                          />
                          <p className="mt-1 text-[11px] text-slate-500">When the incident was reported by the insured.</p>
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Estimated Amount</label>
                          <div className="flex gap-2">
                            <select
                              value={claimCurrency}
                              onChange={(e) => setClaimCurrency(e.target.value as Currency)}
                              className="px-2 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 text-[13px] font-medium"
                            >
                              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input
                              type="text"
                              value={claimEstimatedAmount}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '');
                                if (raw === '') return setClaimEstimatedAmount('');
                                const n = parseFloat(raw);
                                if (!isNaN(n)) setClaimEstimatedAmount(n.toLocaleString('en-US'));
                              }}
                              placeholder="0"
                              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px] font-mono text-right"
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">Initial estimate; can be revised later.</p>
                        </div>
                        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 flex items-center justify-between text-[12px]">
                          <span className="font-semibold text-slate-600">Insurance Company</span>
                          <span className="text-slate-800 font-medium">{policy.insuranceCompany || 'Not set on this policy'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button type="submit" className={`px-6 py-2.5 rounded-md font-semibold text-[13px] text-white shadow-sm transition-colors ${requestType === 'claim' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                      Submit {requestType === 'claim' ? 'Claim' : 'Endorsement'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};