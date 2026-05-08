import React, { useState } from 'react';
import { Deal, Client } from '../../types';
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

  const handleAftersalesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle || !requestDescription) return toast.error('All fields required');

    if (requestType === 'claim') {
      addClaim({ dealId: policy.id, title: requestTitle, description: requestDescription, status: 'Reported' });
      toast.success('Claim reported successfully');
    } else {
      addEndorsement({ dealId: policy.id, type: requestTitle, description: requestDescription, status: 'Requested' });
      toast.success('Endorsement requested successfully');
    }

    setRequestTitle('');
    setRequestDescription('');
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
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Policy Management</h2>
              <p className="text-[12px] font-medium text-slate-500">{client.companyName} • {policy.typeOfInsurance}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'preview' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:text-slate-800 bg-slate-50'}`}
          >
            Cover Note / Original Policy
          </button>
          <button
            onClick={() => setActiveTab('aftersales')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'aftersales' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-500 hover:text-slate-800 bg-slate-50'}`}
          >
            Aftersales (Claim/Endorsement)
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          {activeTab === 'preview' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Document actions */}
              <div className="flex gap-4">
                <button
                  onClick={onDownloadCoverNote}
                  className="flex-1 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 px-4 py-3 rounded-lg text-[13px] font-semibold text-slate-700 hover:text-blue-700 transition-all shadow-sm flex flex-col items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5 text-blue-500" />
                  Download Cover Note PDF
                </button>
                <button
                  onClick={onUploadOriginal}
                  className="flex-1 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-4 py-3 rounded-lg text-[13px] font-semibold text-slate-700 transition-all shadow-sm flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5 text-slate-500" />
                  {policy.originalPolicyFile ? 'Replace Original Policy' : 'Upload Original Policy'}
                </button>
              </div>

              {policy.originalPolicyFile && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <FileText className="w-5 h-5 text-emerald-600" />
                     <div>
                       <div className="text-[13px] font-semibold text-emerald-900">Original Policy Uploaded</div>
                       <div className="text-[12px] text-emerald-700">{policy.originalPolicyFile}</div>
                     </div>
                   </div>
                </div>
              )}

              {/* Cover Note Preview */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-4 py-2 flex items-center justify-between">
                  <div className="text-slate-300 text-[12px] font-mono">Generated Cover Note Preview</div>
                </div>
                <div className="p-8 font-sans text-slate-800">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">COVER NOTE</h3>
                  </div>

                  <div className="flex justify-between text-[12px] mb-8 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-slate-500">Cover Note No:</span> <span className="font-semibold">{coverNoteNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Date of Issue:</span> <span className="font-semibold">{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="space-y-4 text-[13px]">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Name of Insured</div>
                      <div className="col-span-2 font-medium">{client.companyName}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Correspondence Address</div>
                      <div className="col-span-2 font-medium">{client.companyAddress || '-'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Period of Insurance</div>
                      <div className="col-span-2 font-medium">
                        {policy.periodStart ? new Date(policy.periodStart).toLocaleDateString() : 'TBA'} to {policy.periodEnd ? new Date(policy.periodEnd).toLocaleDateString() : 'TBA'}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Risk Occupation</div>
                      <div className="col-span-2 font-medium">{client.businessOccupation || '-'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Risk Location</div>
                      <div className="col-span-2 font-medium">{policy.riskLocation || client.companyAddress || '-'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                      <div className="font-semibold text-slate-500 col-span-1">Type of Insurance</div>
                      <div className="col-span-2 font-bold text-slate-900">{policy.typeOfInsurance}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Insurance Company</div>
                      <div className="col-span-2 font-medium">{policy.insuranceCompany || '-'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Interest / Sum Insured</div>
                      <div className="col-span-2 font-medium">
                        <div className="font-bold text-slate-900">{policy.currency} {policy.sumInsured?.toLocaleString() || '-'}</div>
                        {policy.sumInsuredBreakdown && policy.sumInsuredBreakdown.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {policy.sumInsuredBreakdown.map((b,i) => (
                              <div key={i} className="text-[12px] text-slate-600">- {b.assetName}: {policy.currency} {b.amount.toLocaleString()}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Premium Rate</div>
                      <div className="col-span-2 font-medium">{policy.premiumRate || '-'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="font-semibold text-slate-500 col-span-1">Premium Calculation</div>
                      <div className="col-span-2 font-medium">{policy.currency} {policy.premiumAmount?.toLocaleString() || '-'}</div>
                    </div>
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
