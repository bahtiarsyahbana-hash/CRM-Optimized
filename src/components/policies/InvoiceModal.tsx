import React, { useState } from 'react';
import { Deal, PaymentStatus } from '../../types';
import { useData } from '../../context/DataContext';
import { X, Receipt, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getInvoiceAging } from '../../utils/invoiceAging';
import toast from 'react-hot-toast';

interface Props {
  policy: Deal;
  clientName: string;
  onClose: () => void;
}

const toDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const InvoiceModal: React.FC<Props> = ({ policy, clientName, onClose }) => {
  const { updateDeal } = useData();

  const [invoiceDate, setInvoiceDate] = useState<string>(toDateInput(policy.invoiceDate));
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(policy.paymentStatus || 'Unpaid');
  const [paymentDate, setPaymentDate] = useState<string>(toDateInput(policy.paymentDate));

  // Live preview of aging based on the form's current values (not the saved deal).
  const previewDeal: Deal = {
    ...policy,
    invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
    paymentStatus,
    paymentDate: paymentStatus === 'Paid' && paymentDate ? new Date(paymentDate).toISOString() : undefined,
  };
  const aging = getInvoiceAging(previewDeal);

  const save = () => {
    if (paymentStatus === 'Paid' && !paymentDate) {
      toast.error('Please enter the date the payment was received.');
      return;
    }
    updateDeal(policy.id, {
      invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
      paymentStatus: invoiceDate ? paymentStatus : undefined,
      paymentDate: paymentStatus === 'Paid' && paymentDate ? new Date(paymentDate).toISOString() : undefined,
    });
    toast.success('Invoice updated.');
    onClose();
  };

  const bindDateStr = policy.bindDate ? new Date(policy.bindDate).toLocaleDateString() : '—';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">Invoice</h3>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate max-w-[28ch]">
                {clientName} — {policy.typeOfInsurance || 'policy'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5">
              <div className="text-slate-500 mb-0.5">Bind date</div>
              <div className="font-semibold text-slate-800">{bindDateStr}</div>
            </div>
            <div className={cn('border rounded-md p-2.5', aging.className)}>
              <div className="opacity-70 mb-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Status
              </div>
              <div className="font-semibold">{aging.label}</div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Payment Status</label>
            <div className="flex rounded-md overflow-hidden border border-slate-200">
              {(['Unpaid', 'Paid'] as PaymentStatus[]).map((opt, idx) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPaymentStatus(opt)}
                  className={cn(
                    'flex-1 px-3 py-2 text-[13px] font-semibold transition-colors',
                    idx > 0 && 'border-l border-slate-200',
                    paymentStatus === opt
                      ? opt === 'Paid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {paymentStatus === 'Paid' && (
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Payment Received On</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {paymentStatus === 'Unpaid' && (
            <div className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Claims cannot be submitted against this policy while the invoice is unpaid.
                Outstanding aging is measured from the bind date (or invoice date if no bind date is set).
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
          >
            Save invoice
          </button>
        </div>
      </div>
    </div>
  );
};
