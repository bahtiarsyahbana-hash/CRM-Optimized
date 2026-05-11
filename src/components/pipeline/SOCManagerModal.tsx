import React, { useState, useEffect, useMemo } from 'react';
import { Deal, Client, SOCCoverage, SOCDetails } from '../../types';
import { X, FileText, Download, Plus, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../context/DataContext';
import { generateSOC } from '../../utils/socGenerator';
import { format } from 'date-fns';

interface Props {
  deal: Deal;
  client: Client;
  onClose: () => void;
}

export const SOCManagerModal = ({ deal, client, onClose }: Props) => {
  const { updateDeal } = useData();
  const [templateType, setTemplateType] = useState<'Motor Vehicle' | 'General' | 'Other'>(
    deal.socDetails?.templateType ||
    (deal.typeOfInsurance?.toLowerCase().includes('motor') || deal.typeOfInsurance?.toLowerCase().includes('kendaraan') ? 'Motor Vehicle' : 'General')
  );

  const [coverages, setCoverages] = useState<SOCCoverage[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(67000);
  const [policyFee, setPolicyFee] = useState<number>(0);
  const [deductible, setDeductible] = useState<string>('');

  // Upper table dynamic fields
  const [attentionTo, setAttentionTo] = useState<string>('');
  const [socDate, setSocDate] = useState<string>(format(new Date(), 'dd-MMM-yyyy'));
  const [socNumber, setSocNumber] = useState<string>('');

  useEffect(() => {
    if (deal.socDetails) {
      setCoverages(deal.socDetails.coverages);
      setDiscountPercent(deal.socDetails.discountPercent);
      setAdminFee(deal.socDetails.adminFee);
      setPolicyFee(deal.socDetails.policyFee || 0);
      setDeductible(deal.socDetails.deductible || '');
      setTemplateType(deal.socDetails.templateType);

      setAttentionTo(deal.socDetails.attentionTo || client.picName || '');
      setSocDate(deal.socDetails.socDate || format(new Date(), 'dd-MMM-yyyy'));
      setSocNumber(deal.socDetails.socNumber || deal.coverNoteNumber || '');
    } else {
      applyTemplate(templateType);
      setAttentionTo(client.picName || '');
      setSocNumber(deal.coverNoteNumber || '');
    }
  }, [deal.socDetails, client, deal]);

  const applyTemplate = (type: 'Motor Vehicle' | 'General' | 'Other') => {
    setTemplateType(type);
    if (type === 'General') {
      setCoverages([
        { id: crypto.randomUUID(), name: 'FLEXAS (KEBAKARAN)', rate: '0.0294', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'FWTWD (BANJIR)', rate: '0.05', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'RSMDCC (HURU-HARA)', rate: '0.00001', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'OTHERS (LAIN-LAIN)', rate: '0.00001', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'EARTHQUAKE (GEMPA BUMI)', rate: '0', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'MACHINERY BREAKDOWN', rate: '0', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'PUBLIC LIABILITY', rate: '0', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'BUSINESS INTERUPTION', rate: '0', rateType: 'percentage', amount: 0 },
      ]);
    } else if (type === 'Motor Vehicle') {
      setCoverages([
        { id: crypto.randomUUID(), name: 'Comprehensive', rate: '1.2', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'LOADING RATE', rate: '0', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'FWTWD', rate: '0.10', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'SRCC', rate: '0.05', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'TERRORISM SABOTAGE', rate: '0', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'PERSONAL ACCIDENT DRIVER : 10,000,000', rate: '50000', rateType: 'fixed', amount: 0 },
        { id: crypto.randomUUID(), name: 'PERSONAL ACCIDENT PASSENGER : 10,000,000', rate: '40000', rateType: 'fixed', amount: 0 },
        { id: crypto.randomUUID(), name: 'THIRD PARTY LIABILITY : 50,000,000', rate: '375000', rateType: 'fixed', amount: 0 },
        { id: crypto.randomUUID(), name: 'THEFT BY OWN DRIVER', rate: '0.01', rateType: 'percentage', amount: 0 },
        { id: crypto.randomUUID(), name: 'AUTHORIZED GARAGE', rate: '0.01', rateType: 'percentage', amount: 0 },
      ]);
    } else {
      setCoverages([{ id: crypto.randomUUID(), name: 'Main Coverage', rate: '0', rateType: 'fixed', amount: 0 }]);
    }
  };

  const currentTotalSumInsured = deal.sumInsured || 0;

  // Derive amounts and totals
  const derivedCoverages = useMemo(() => {
    return coverages.map(cov => {
      let amt = 0;
      const rateVal = parseFloat(cov.rate || '0');
      if (!isNaN(rateVal)) {
        if (cov.rateType === 'percentage') {
          amt = (rateVal / 100) * currentTotalSumInsured;
        } else {
          amt = rateVal;
        }
      }
      return { ...cov, amount: amt };
    });
  }, [coverages, currentTotalSumInsured]);

  const subTotal = derivedCoverages.reduce((sum, cov) => sum + cov.amount, 0);
  const discountAmount = subTotal * (discountPercent / 100);
  const totalPremium = subTotal - discountAmount + adminFee + policyFee;

  const updateCoverage = (id: string, field: keyof SOCCoverage, value: any) => {
    setCoverages(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCoverage = (id: string) => {
    setCoverages(prev => prev.filter(c => c.id !== id));
  };

  const addCoverage = () => {
    setCoverages(prev => [...prev, { id: crypto.randomUUID(), name: '', rate: '0', rateType: 'percentage', amount: 0 }]);
  };

  const currentSOCDetails: SOCDetails = {
    templateType,
    coverages: derivedCoverages,
    subTotal,
    discountPercent,
    adminFee,
    policyFee,
    deductible,
    totalPremium,
    attentionTo,
    socDate,
    socNumber
  };

  // Open the generated PDF in a new browser tab.
  // We use a Blob URL (not data URI) so the browser shows a clean URL and proper PDF viewer.
  const handlePreview = () => {
    try {
      const doc = generateSOC({ ...deal, socDetails: currentSOCDetails }, client);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        toast.error('Popup blocked. Please allow popups for this site to preview the SOC.');
        URL.revokeObjectURL(url);
        return;
      }
      // Revoke the blob URL after a delay so the new tab has time to load it.
      // (Revoking too early would prevent the PDF from displaying.)
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error('Preview generation failed', error);
      toast.error('Could not generate preview.');
    }
  };

  const handleSave = () => {
    updateDeal(deal.id, { ...deal, socDetails: currentSOCDetails, premiumAmount: totalPremium });
    toast.success('SOC Details saved locally');
  };

  const handleDownload = () => {
    let finalSocNumber = socNumber;
    if (!finalSocNumber) {
      finalSocNumber = `SOC/${format(new Date(), 'yyyyMM')}/${Math.floor(1000 + Math.random() * 9000)}`;
      setSocNumber(finalSocNumber);
    }

    const finalSocDetails = { ...currentSOCDetails, socNumber: finalSocNumber };

    updateDeal(deal.id, { ...deal, socDetails: finalSocDetails, premiumAmount: totalPremium });
    const doc = generateSOC({ ...deal, socDetails: finalSocDetails }, client);
    const filename = `SOC_${client.companyName.replace(/\s+/g, '_')}_${deal.id.substring(0, 6)}.pdf`;
    doc.save(filename);
    toast.success('SOC Document downloaded');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Manage Summary Of Cover (SOC)</h2>
              <p className="text-[12px] font-medium text-slate-500">{client.companyName} • {deal.typeOfInsurance} • SI: {deal.currency} {currentTotalSumInsured.toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content — single full-width form (no live preview panel) */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1">SOC Template Type</label>
                  <select
                    value={templateType}
                    onChange={(e) => applyTemplate(e.target.value as any)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[13px] focus:outline-none focus:border-blue-500"
                  >
                    <option value="General">General Insurance</option>
                    <option value="Motor Vehicle">Motor Vehicle</option>
                    <option value="Other">Other Custom</option>
                  </select>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-slate-500">Security (Insurance)</div>
                  <div className="text-[13px] font-semibold text-slate-900 mb-2">{deal.insuranceCompany || 'TBA'}</div>
                  <div className="text-[12px] text-slate-500">Deductible</div>
                  <input
                    type="text"
                    value={deductible}
                    onChange={(e) => setDeductible(e.target.value)}
                    placeholder="e.g. As per policy"
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 text-right w-48"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 mt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Attention To (PIC)</label>
                  <input type="text" value={attentionTo} onChange={e => setAttentionTo(e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">SOC Date</label>
                  <input type="text" value={socDate} onChange={e => setSocDate(e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500" placeholder="DD-MMM-YYYY" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">SOC Number</label>
                  <input type="text" value={socNumber} readOnly className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[12px] text-slate-500 focus:outline-none" placeholder="Generated on issue" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-[13px]">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-10 text-center">NO.</th>
                    <th className="px-3 py-2 font-semibold">COVERAGE</th>
                    <th className="px-3 py-2 font-semibold w-56">RATE</th>
                    <th className="px-3 py-2 font-semibold text-right w-40">AMOUNT ({deal.currency})</th>
                    <th className="px-2 py-2 font-semibold w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {derivedCoverages.map((cov, i) => (
                    <tr key={cov.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 text-center text-slate-500">{i + 1}</td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={cov.name}
                          onChange={(e) => updateCoverage(cov.id, 'name', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-[12px] font-medium text-slate-800 uppercase"
                          placeholder="Coverage Name"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={cov.rate}
                            onChange={(e) => updateCoverage(cov.id, 'rate', e.target.value)}
                            className="w-20 px-1 py-1 bg-white border border-slate-200 rounded text-[12px] focus:outline-none focus:border-blue-500 text-right font-mono"
                          />
                          <select
                            value={cov.rateType}
                            onChange={(e) => updateCoverage(cov.id, 'rateType', e.target.value)}
                            className="bg-transparent border-none text-[11px] text-slate-500 focus:ring-0 cursor-pointer p-0"
                          >
                            <option value="percentage">%</option>
                            <option value="fixed">Fixed</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-medium text-slate-800 text-[12px]">
                        {cov.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button onClick={() => removeCoverage(cov.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="px-4 py-3 bg-slate-50">
                      <button onClick={addCoverage} className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700">
                        <Plus className="w-4 h-4" /> Add Coverage
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Totals Section */}
              <div className="bg-slate-100/50 p-5 border-t border-slate-200 grid grid-cols-2 gap-4">
                <div className="space-y-3 col-start-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-slate-600 font-medium">Sub Total:</span>
                    <span className="font-mono text-slate-800">{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-600 text-[13px]">
                    <span className="font-medium">Discount (%):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] text-right focus:outline-none focus:border-blue-500"
                      />
                      <span className="font-mono">-{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[13px]">
                    <span className="font-medium">Admin Cost:</span>
                    <input
                      type="number"
                      value={adminFee}
                      onChange={(e) => setAdminFee(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] text-right font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[13px]">
                    <span className="font-medium">Policy Fee (Optional):</span>
                    <input
                      type="number"
                      value={policyFee}
                      onChange={(e) => setPolicyFee(parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1 bg-white border border-slate-200 rounded text-[12px] text-right font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="pt-3 border-t border-slate-300 flex items-center justify-between mt-2">
                    <span className="text-[14px] font-bold text-slate-900">Total Premium:</span>
                    <span className="text-[15px] font-bold font-mono text-slate-900">{totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center gap-3 shrink-0">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Tip: Click <span className="font-semibold text-slate-600">Preview</span> to view the SOC PDF in a new tab without downloading.
          </p>
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md font-semibold text-[13px] text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-md font-semibold text-[13px] text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={handlePreview}
              className="px-4 py-2 rounded-md font-semibold text-[13px] text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={handleDownload}
              className="px-6 py-2 rounded-md font-semibold text-[13px] text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download SOC PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};