import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealType, DealStage, PaymentStatus } from '../../types';
import { defaultCommissionRate, DEFAULT_TAX_PERCENT } from '../../utils/commissionCalc';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { INSURANCE_COMPANIES } from '../../constants/insuranceCompanies';

export const DealDetailForm = ({ 
  deal, 
  onClose 
}: { 
  deal?: Deal | null, 
  onClose: () => void 
}) => {
  const { addDeal, updateDeal, clients } = useData();

  const [clientId, setClientId] = useState(deal?.clientId || '');
  const [dealType, setDealType] = useState<DealType>(deal?.dealType || 'New Business');
  const [typeOfInsurance, setTypeOfInsurance] = useState(deal?.typeOfInsurance || '');
  const [sumInsured, setSumInsured] = useState<string>(deal?.sumInsured?.toString() || '');
  const [isMultipleAssets, setIsMultipleAssets] = useState<boolean>(!!deal?.sumInsuredBreakdown && deal.sumInsuredBreakdown.length > 0);
  const [sumInsuredBreakdown, setSumInsuredBreakdown] = useState<{ assetName: string; amount: string }[]>(
    deal?.sumInsuredBreakdown?.map(b => ({ assetName: b.assetName, amount: b.amount.toString() })) || [{ assetName: '', amount: '' }]
  );
  const [currency, setCurrency] = useState(deal?.currency || 'IDR');
  const [premiumType, setPremiumType] = useState(deal?.premiumType || 'Estimated Premium');
  const [premiumAmount, setPremiumAmount] = useState<string>(deal?.premiumAmount?.toString() || '');
  const [premiumRate, setPremiumRate] = useState<string>(deal?.premiumRate || '');
  const [insuranceCompany, setInsuranceCompany] = useState(deal?.insuranceCompany || '');
  const [periodStart, setPeriodStart] = useState(deal?.periodStart ? new Date(deal.periodStart).toISOString().split('T')[0] : '');
  const [periodEnd, setPeriodEnd] = useState(deal?.periodEnd ? new Date(deal.periodEnd).toISOString().split('T')[0] : '');
  const [statusStage, setStatusStage] = useState<DealStage>(deal?.statusStage || 'Leads');
  const [riskLocation, setRiskLocation] = useState(deal?.riskLocation || '');
  const [riskDetail, setRiskDetail] = useState(deal?.riskDetail || '');
  const [notes, setNotes] = useState(deal?.notes || '');
  const [qqList, setQqList] = useState<string[]>(deal?.qq || []);

  const [baseRate, setBaseRate] = useState<string>(
    deal?.commission?.baseRate != null ? String(deal.commission.baseRate) : ''
  );
  const [discountPercent, setDiscountPercent] = useState<string>(
    deal?.commission?.discountPercent != null ? String(deal.commission.discountPercent) : ''
  );
  const [efCommissionPercent, setEfCommissionPercent] = useState<string>(
    deal?.commission?.efCommissionPercent != null ? String(deal.commission.efCommissionPercent) : ''
  );
  const [taxPercent, setTaxPercent] = useState<string>(
    deal?.commission?.taxPercent != null ? String(deal.commission.taxPercent) : String(DEFAULT_TAX_PERCENT)
  );
  const [agentName, setAgentName] = useState<string>(deal?.commission?.agentName || '');
  const [agentCashback, setAgentCashback] = useState<string>(
    deal?.commission?.agentCashback != null ? String(deal.commission.agentCashback) : ''
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    deal?.invoiceDate ? new Date(deal.invoiceDate).toISOString().split('T')[0] : ''
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(deal?.paymentStatus || 'Unpaid');
  const [paymentDate, setPaymentDate] = useState<string>(
    deal?.paymentDate ? new Date(deal.paymentDate).toISOString().split('T')[0] : ''
  );

  const selectedClient = clients.find(c => c.id === clientId);
  const showCommissionSection = dealType === 'New Business' || dealType === 'Renewal';

  const insuranceTypeOptions = ['Property All Risk', 'Industrial All Risk', 'Fire Insurance', 'Earthquake Insurance', 'Marine Cargo', 'Marine Hull', 'Motor Vehicle', 'Heavy Equipment', 'Liability Insurance', 'Directors & Officers Liability', 'Professional Indemnity', 'Money Insurance', 'Fidelity Guarantee', 'Personal Accident', 'Group Term Life', 'Health Insurance', 'Travel Insurance', 'Cyber Insurance', 'Credit Insurance', 'Surety Bond', 'Other'];
  const currencyOptions = ['IDR', 'USD', 'CNY', 'MYR', 'JPY', 'EUR'];
  const premiumTypeOptions = ['Estimated Premium', 'Fixed Premium'];
  const dealTypeOptions = ['New Business', 'Renewal', 'Cross Sell', 'Upsell', 'Existing Client Update'];
  const statusStageOptions = ['Renewal', 'Existing Client Update'].includes(dealType)
    ? ['Policy On Progress', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Lost']
    : ['Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress', 'Lost'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      toast.error('Please select a Client.');
      return;
    }
    if (!typeOfInsurance) {
      toast.error('Please select Type of Insurance.');
      return;
    }
    if (dealType === 'Renewal' && !insuranceCompany) {
      toast.error('Insurance Company is required for Renewals.');
      return;
    }
    if (statusStage === 'Policy On Progress' && !insuranceCompany) {
      toast.error('Insurance Company is required for Policy On Progress.');
      return;
    }
    if (showCommissionSection && discountPercent && baseRate && parseFloat(discountPercent) > parseFloat(baseRate)) {
      toast.error('Discount % cannot exceed Base Commission %.');
      return;
    }

    let finalSumInsured: number | undefined = undefined;
    let finalBreakdown: { assetName: string; amount: number }[] | undefined = undefined;

    if (isMultipleAssets) {
      const validAssets = sumInsuredBreakdown.filter(b => b.assetName.trim() !== '' && b.amount.trim() !== '');
      if (validAssets.length === 0) {
        toast.error('Please add at least one valid asset sum insured.');
        return;
      }
      finalBreakdown = validAssets.map(b => ({
        assetName: b.assetName,
        amount: parseFloat(b.amount.replace(/,/g, ''))
      }));
      finalSumInsured = finalBreakdown.reduce((acc, curr) => acc + curr.amount, 0);
    } else {
      finalSumInsured = sumInsured ? parseFloat(sumInsured.replace(/,/g, '')) : undefined;
    }

    const payload = {
      clientId,
      typeOfInsurance,
      sumInsured: finalSumInsured,
      sumInsuredBreakdown: finalBreakdown,
      currency,
      premiumType,
      premiumAmount: premiumAmount ? parseFloat(premiumAmount.replace(/,/g, '')) : undefined,
      premiumRate,
      dealType: dealType as DealType,
      insuranceCompany,
      periodStart: periodStart ? new Date(periodStart).toISOString() : undefined,
      periodEnd: periodEnd ? new Date(periodEnd).toISOString() : undefined,
      statusStage: statusStage as DealStage,
      riskLocation,
      riskDetail,
      notes,
      qq: qqList.filter(q => q.trim()).length > 0 ? qqList.filter(q => q.trim()) : undefined,
      commission: showCommissionSection ? {
        baseRate: baseRate !== '' ? parseFloat(baseRate) : undefined,
        discountPercent: discountPercent !== '' ? parseFloat(discountPercent) : undefined,
        efCommissionPercent: efCommissionPercent !== '' ? parseFloat(efCommissionPercent) : undefined,
        taxPercent: taxPercent !== '' ? parseFloat(taxPercent) : DEFAULT_TAX_PERCENT,
        agentName: agentName || undefined,
        agentCashback: agentCashback ? parseFloat(agentCashback.replace(/,/g, '')) : undefined,
      } : undefined,
      invoiceDate: showCommissionSection && invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
      paymentStatus: showCommissionSection && invoiceDate ? paymentStatus : undefined,
      paymentDate: showCommissionSection && paymentStatus === 'Paid' && paymentDate ? new Date(paymentDate).toISOString() : undefined,
    };

    if (deal) {
      updateDeal(deal.id, payload);
      toast.success('Pipeline deal updated successfully');
    } else {
      addDeal(payload);
      toast.success('Pipeline deal created successfully');
    }
    onClose();
  };

  const formatNumber = (value: string) => {
    const num = value.replace(/[^0-9.]/g, '');
    if (!num) return '';
    const parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{deal ? 'Edit Pipeline Deal' : 'Add Pipeline Deal'}</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Track opportunities and policies.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <form id="deal-form" onSubmit={handleSubmit} className="space-y-8">
            
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-800 text-[14px] flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</div>
                Client Definition
              </h3>
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Client / Company <span className="text-red-500">*</span></label>
                  {clients.length === 0 ? (
                    <div className="text-[13px] text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                      No clients found. Please create a Client Profile first in the Clients view.
                    </div>
                  ) : (
                    <select value={clientId} onChange={e => setClientId(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]">
                      <option value="">Select a Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12px] font-semibold text-slate-600">
                      QQ <span className="text-slate-400 font-normal">(atas nama — additional named parties)</span>
                    </label>
                    {qqList.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setQqList([...qqList, ''])}
                        className="text-[12px] font-medium text-blue-600 hover:text-blue-700"
                      >
                        + Add QQ
                      </button>
                    )}
                  </div>
                  {qqList.length === 0 ? (
                    <p className="text-[12px] text-slate-400 italic">No QQ parties added.</p>
                  ) : (
                    <div className="space-y-2">
                      {qqList.map((entry, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-[11px] font-bold text-slate-400 w-6 shrink-0 text-center">QQ</span>
                          <input
                            type="text"
                            value={entry}
                            onChange={e => {
                              const next = [...qqList];
                              next[i] = e.target.value;
                              setQqList(next);
                            }}
                            placeholder={`Party ${i + 1} name`}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                          />
                          <button
                            type="button"
                            onClick={() => setQqList(qqList.filter((_, j) => j !== i))}
                            className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-md transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {qqList.length >= 5 && (
                        <p className="text-[11px] text-slate-400">Maximum 5 QQ parties reached.</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-800 text-[14px] flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</div>
                Insurance Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Deal Type <span className="text-red-500">*</span></label>
                  <select 
                    value={dealType} 
                    onChange={e => {
                      const newType = e.target.value as DealType;
                      setDealType(newType);
                      if (['Renewal', 'Existing Client Update'].includes(newType) && statusStage === 'Leads') {
                        setStatusStage('Policy On Progress');
                      }
                    }} 
                    required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]">
                    {dealTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Insurance <span className="text-red-500">*</span></label>
                  <select value={typeOfInsurance} onChange={e => {
                    const newType = e.target.value;
                    setTypeOfInsurance(newType);
                    if (!deal || !baseRate) {
                      setBaseRate(String(defaultCommissionRate(selectedClient, newType)));
                    }
                  }} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]">
                    <option value="">Select Insurance Type</option>
                    {insuranceTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[12px] font-semibold text-slate-600">Sum Insured <span className="text-slate-400 font-normal">({currency})</span></label>
                    <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={isMultipleAssets} onChange={(e) => setIsMultipleAssets(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      Multiple Assets
                    </label>
                  </div>
                  
                  {!isMultipleAssets ? (
                    <input type="text" value={sumInsured} onChange={e => setSumInsured(formatNumber(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" placeholder="1,000,000" />
                  ) : (
                    <div className="space-y-3 bg-white p-3 border border-slate-200 rounded-md">
                      {sumInsuredBreakdown.map((item, index) => (
                        <div key={index} className="flex gap-3">
                          <input type="text" value={item.assetName} onChange={(e) => {
                            const newBreakdown = [...sumInsuredBreakdown];
                            newBreakdown[index].assetName = e.target.value;
                            setSumInsuredBreakdown(newBreakdown);
                          }} placeholder="Asset (e.g. Content)" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" />
                          <input type="text" value={formatNumber(item.amount)} onChange={(e) => {
                            const newBreakdown = [...sumInsuredBreakdown];
                            newBreakdown[index].amount = formatNumber(e.target.value);
                            setSumInsuredBreakdown(newBreakdown);
                          }} placeholder="Amount" className="flex-[1.5] px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" />
                          {sumInsuredBreakdown.length > 1 && (
                            <button type="button" onClick={() => {
                              const newBreakdown = sumInsuredBreakdown.filter((_, i) => i !== index);
                              setSumInsuredBreakdown(newBreakdown);
                            }} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-md transition-colors shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        {sumInsuredBreakdown.length < 3 ? (
                          <button type="button" onClick={() => setSumInsuredBreakdown([...sumInsuredBreakdown, { assetName: '', amount: '' }])} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
                            + Add Asset (Max 3)
                          </button>
                        ) : (
                          <span className="text-[12px] text-slate-400">Maximum 3 assets reached.</span>
                        )}
                        <div className="text-[12px] text-slate-700 font-semibold">
                          Total: {sumInsuredBreakdown.reduce((acc, curr) => acc + (parseFloat(curr.amount.replace(/,/g, '')) || 0), 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Currency <span className="text-red-500">*</span></label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]">
                    {currencyOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Premium Type <span className="text-red-500">*</span></label>
                  <select value={premiumType} onChange={e => setPremiumType(e.target.value)} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]">
                    {premiumTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Premium Amount <span className="text-slate-400 font-normal">({currency})</span></label>
                  <input type="text" value={premiumAmount} onChange={e => setPremiumAmount(formatNumber(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" placeholder="0" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Premium Rate</label>
                  <input type="text" value={premiumRate} onChange={e => setPremiumRate(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" placeholder="e.g. 0.05% or from quotation" />
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Period Start</label>
                    <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Period End</label>
                    <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]" />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Insurance Company {(dealType === 'Renewal' || statusStage === 'Policy On Progress') && <span className="text-red-500">*</span>}</label>
                  <select 
                    value={insuranceCompany} 
                    onChange={e => setInsuranceCompany(e.target.value)} 
                    required={dealType === 'Renewal' || statusStage === 'Policy On Progress'} 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                  >
                    <option value="">Select Insurance Company</option>
                    {INSURANCE_COMPANIES.map(company => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-800 text-[14px] flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">3</div>
                Risk & Pipeline Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Status Stage <span className="text-red-500">*</span></label>
                  <select value={statusStage} onChange={e => setStatusStage(e.target.value as DealStage)} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]">
                    {statusStageOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Risk Location <span className="text-slate-400 font-normal">(if different from client address)</span></label>
                  <textarea value={riskLocation} onChange={e => setRiskLocation(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px] resize-none" placeholder="Location of risk" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Risk Detail <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <textarea value={riskDetail} onChange={e => setRiskDetail(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px] resize-none" placeholder="Underwriting notes, exposure notes..." />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Notes <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px] resize-none" placeholder="Follow up notes, communication history..." />
                </div>
              </div>
            </div>

            {showCommissionSection && (
              <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
                <h3 className="font-semibold text-slate-800 text-[14px] flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">4</div>
                  Commission &amp; Invoicing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Base Commission %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={baseRate}
                      onChange={e => setBaseRate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      placeholder="e.g. 15"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                      Discount to Client %
                      {baseRate && <span className="text-[11px] font-normal text-slate-400 ml-1">max {baseRate}%</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={baseRate || undefined}
                      step="0.01"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">EF Commission %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={efCommissionPercent}
                      onChange={e => setEfCommissionPercent(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">PPh 23 Tax %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxPercent}
                      onChange={e => setTaxPercent(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Sales Agent Name</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      placeholder="Agent name (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                      Agent Cashback <span className="text-slate-400 font-normal">({currency})</span>
                    </label>
                    <input
                      type="text"
                      value={agentCashback}
                      onChange={e => setAgentCashback(formatNumber(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-slate-200">
                  <div className="text-[12px] font-semibold text-slate-600 mb-3">Invoicing</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={e => setInvoiceDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Payment Status</label>
                      <div className="flex rounded-md overflow-hidden border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('Unpaid')}
                          className={`flex-1 px-3 py-2 text-[13px] font-semibold transition-colors ${paymentStatus === 'Unpaid' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                          Unpaid
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('Paid')}
                          className={`flex-1 px-3 py-2 text-[13px] font-semibold transition-colors border-l border-slate-200 ${paymentStatus === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                          Paid
                        </button>
                      </div>
                    </div>
                    {paymentStatus === 'Paid' && (
                      <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Payment Date</label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={e => setPaymentDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0 rounded-b-lg">
          <button type="button" onClick={onClose} className="px-5 py-2 font-semibold text-[13px] text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
            Cancel
          </button>
          <button type="submit" form="deal-form" disabled={clients.length === 0} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold text-[13px] rounded-md transition-colors flex items-center gap-2 shadow-sm">
            <Save className="w-4 h-4" />
            {deal ? 'Save Changes' : 'Create Deal'}
          </button>
        </div>

      </div>
    </div>
  );
};
