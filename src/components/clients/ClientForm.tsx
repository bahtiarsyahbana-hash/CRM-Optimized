import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Client, LineOfBusiness, CompanyClass, CompanyClassMode, SourceClient, SOURCE_CLIENT_OPTIONS } from '../../types';
import { X, Building2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { classifyClient } from '../../utils/clientClassifier';
import { cn } from '../../lib/utils';

interface ClientFormProps {
  client?: Client | null;
  onClose: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ client, onClose }) => {
  const { addClient, updateClient, deals } = useData();
  
  const [formData, setFormData] = useState({
    companyName: '',
    lineOfBusiness: 'Manufacture' as LineOfBusiness,
    companyAddress: '',
    sourceClient: '' as '' | SourceClient,
    estimatedAnnualPremium: '',
    parentGroup: '',
    companyClass: '' as '' | CompanyClass,
    companyClassMode: 'auto' as CompanyClassMode,
    picName: '',
    picEmail: '',
    picPhone: ''
  });

  useEffect(() => {
    if (client) {
      setFormData({
        companyName: client.companyName,
        lineOfBusiness: client.lineOfBusiness,
        companyAddress: client.companyAddress || '',
        sourceClient: (client.sourceClient || '') as '' | SourceClient,
        estimatedAnnualPremium: client.estimatedAnnualPremium ? client.estimatedAnnualPremium.toLocaleString('en-US') : '',
        parentGroup: client.parentGroup || '',
        companyClass: (client.companyClass || '') as '' | CompanyClass,
        companyClassMode: client.companyClassMode || 'auto',
        picName: client.picName || '',
        picEmail: client.picEmail || '',
        picPhone: client.picPhone || ''
      });
    }
  }, [client]);

  // Live preview of what auto-classification would say, given the current form state.
  const livePreview = useMemo(() => {
    const previewClient: Client = {
      id: client?.id || '__preview__',
      companyName: formData.companyName,
      lineOfBusiness: formData.lineOfBusiness,
      parentGroup: formData.parentGroup,
      createdAt: client?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return classifyClient(previewClient, deals);
  }, [client?.id, formData.parentGroup, deals, formData.companyName, formData.lineOfBusiness, client?.createdAt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName) {
      toast.error('Company Name is required.');
      return;
    }

    const isManual = formData.companyClassMode === 'manual' && !!formData.companyClass;

    const payload = {
      companyName: formData.companyName,
      lineOfBusiness: formData.lineOfBusiness,
      companyAddress: formData.companyAddress,
      // Preserve legacy fields on edit so existing data isn't wiped.
      businessOccupation: client?.businessOccupation,
      assetDetail: client?.assetDetail,
      estimatedValueAsset: client?.estimatedValueAsset,
      sourceClient: (formData.sourceClient || undefined) as SourceClient | undefined,
      estimatedAnnualPremium: formData.estimatedAnnualPremium
        ? parseFloat(formData.estimatedAnnualPremium.replace(/,/g, ''))
        : undefined,
      parentGroup: formData.parentGroup.trim() || undefined,
      companyClass: isManual ? (formData.companyClass as CompanyClass) : undefined,
      companyClassMode: isManual ? ('manual' as CompanyClassMode) : ('auto' as CompanyClassMode),
      picName: formData.picName,
      picEmail: formData.picEmail,
      picPhone: formData.picPhone,
    };

    if (client) {
      updateClient(client.id, payload);
      toast.success('Client updated successfully');
    } else {
      addClient(payload);
      toast.success('Client created successfully');
    }
    onClose();
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const rawValue = e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '');
    if (rawValue === '') {
      setFormData(prev => ({ ...prev, [field]: '' }));
      return;
    }
    const val = parseFloat(rawValue);
    if (!isNaN(val)) {
      setFormData(prev => ({ ...prev, [field]: val.toLocaleString('en-US') }));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-auto flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{client ? 'Edit Client Profile' : 'New Client Profile'}</h2>
              <p className="text-[13px] text-slate-500">Manage master company data and assets.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">1. Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Company Name *</label>
                  <input type="text" required value={formData.companyName} onChange={e => setFormData(prev => ({...prev, companyName: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]" placeholder="e.g. PT Maju Jaya" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Line of Business *</label>
                  <select required value={formData.lineOfBusiness} onChange={e => setFormData(prev => ({...prev, lineOfBusiness: e.target.value as LineOfBusiness}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]">
                    <option value="Manufacture">Manufacture</option>
                    <option value="Trading">Trading</option>
                    <option value="Financial Institution">Financial Institution</option>
                    <option value="Property">Property</option>
                    <option value="Individual">Individual</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Parent Group</label>
                  <input type="text" value={formData.parentGroup} onChange={e => setFormData(prev => ({...prev, parentGroup: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]" placeholder="e.g. Astra Group, Salim Group (optional)" />
                  <p className="mt-1 text-[11px] text-slate-500">Setting a group will auto-classify this client as Large Enterprise.</p>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Company Class</label>
                  <select
                    value={formData.companyClassMode === 'manual' ? formData.companyClass : '__auto__'}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '__auto__') {
                        setFormData(prev => ({ ...prev, companyClassMode: 'auto', companyClass: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, companyClassMode: 'manual', companyClass: v as CompanyClass }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]"
                  >
                    <option value="__auto__">Auto: {livePreview.autoClass}</option>
                    <option value="SME">Manual: SME</option>
                    <option value="Large Enterprise">Manual: Large Enterprise</option>
                    <option value="Individual">Manual: Individual</option>
                  </select>
                  <div className={cn(
                    "mt-1.5 flex items-start gap-1.5 text-[11px]",
                    formData.companyClassMode === 'manual' ? "text-amber-700" : "text-slate-500"
                  )}>
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      {formData.companyClassMode === 'manual'
                        ? `Manual override active. Auto would say: ${livePreview.autoClass}.`
                        : livePreview.autoReasons.join(' · ')}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Company Address</label>
                  <textarea rows={2} value={formData.companyAddress} onChange={e => setFormData(prev => ({...prev, companyAddress: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px] resize-none" placeholder="Full head office address..." />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">2. Source & Estimated Premium</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Source Client</label>
                  <select
                    value={formData.sourceClient}
                    onChange={e => setFormData(prev => ({ ...prev, sourceClient: e.target.value as '' | SourceClient }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px] bg-white"
                  >
                    <option value="">— Select source —</option>
                    {SOURCE_CLIENT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">How did this client come in?</p>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">Estimated Annual Premium</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[13px] font-medium">IDR</span>
                    <input
                      type="text"
                      value={formData.estimatedAnnualPremium}
                      onChange={e => handleNumberChange(e, 'estimatedAnnualPremium')}
                      className="w-full pl-12 pr-4 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px] font-mono"
                      placeholder="0"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Total expected premium across all policies in a year.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">3. PIC Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">PIC Name</label>
                  <input type="text" value={formData.picName} onChange={e => setFormData(prev => ({...prev, picName: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]" placeholder="Person in charge name..." />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">PIC Email</label>
                  <input type="email" value={formData.picEmail} onChange={e => setFormData(prev => ({...prev, picEmail: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]" placeholder="pic@example.com" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">PIC Phone Number</label>
                  <input type="tel" value={formData.picPhone} onChange={e => setFormData(prev => ({...prev, picPhone: e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-[13px]" placeholder="+62..." />
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-colors">
            Cancel
          </button>
          <button type="submit" form="client-form" className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm">
            {client ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  );
};