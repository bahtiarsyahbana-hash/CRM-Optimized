import { Deal } from '../types';

export type AgingBucket = 'paid' | 'unbound' | 'fresh' | '30+' | '90+' | '120+';

export interface AgingInfo {
  bucket: AgingBucket;
  daysOutstanding: number | null;
  /** Human label like "45 days outstanding" or "Paid" */
  label: string;
  /** Tailwind background + text classes for badge styling */
  className: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getInvoiceAging(deal: Deal, now: Date = new Date()): AgingInfo {
  // Already paid → no aging concern
  if (deal.paymentStatus === 'Paid') {
    return {
      bucket: 'paid',
      daysOutstanding: 0,
      label: 'Paid',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  // Anchor: bindDate, then invoiceDate as fallback, then periodStart.
  const anchorIso = deal.bindDate || deal.invoiceDate || deal.periodStart;
  if (!anchorIso) {
    return {
      bucket: 'unbound',
      daysOutstanding: null,
      label: 'Not bound',
      className: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  }

  const days = Math.floor((now.getTime() - new Date(anchorIso).getTime()) / MS_PER_DAY);
  const daysOutstanding = Math.max(0, days);

  if (daysOutstanding >= 120) {
    return {
      bucket: '120+',
      daysOutstanding,
      label: `${daysOutstanding} days overdue`,
      className: 'bg-red-100 text-red-800 border-red-300',
    };
  }
  if (daysOutstanding >= 90) {
    return {
      bucket: '90+',
      daysOutstanding,
      label: `${daysOutstanding} days outstanding`,
      className: 'bg-orange-100 text-orange-800 border-orange-300',
    };
  }
  if (daysOutstanding >= 30) {
    return {
      bucket: '30+',
      daysOutstanding,
      label: `${daysOutstanding} days outstanding`,
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  return {
    bucket: 'fresh',
    daysOutstanding,
    label: `${daysOutstanding} days outstanding`,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

/** Can a claim be filed against this deal? Paid invoice is required. */
export function canFileClaim(deal: Deal): { allowed: boolean; reason?: string } {
  if (deal.paymentStatus === 'Paid') return { allowed: true };
  return {
    allowed: false,
    reason: deal.invoiceDate
      ? 'The invoice for this policy is still unpaid. Mark the invoice as paid before submitting a claim.'
      : 'No invoice has been recorded for this policy yet. Record and mark the invoice paid before submitting a claim.',
  };
}
