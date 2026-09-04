import React from 'react';
import { Deal, DealStage } from '../../../types';
import { Navigate } from '../../../lib/navigation';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

/* -------------------------------------------------------------------------- */
/*                              Widget contract                               */
/* -------------------------------------------------------------------------- */

export interface WidgetProps {
  navigate: Navigate;
}

export interface WidgetDefinition {
  /** Stable key. Phase 2 layout persistence is keyed off this — never reuse an id. */
  id: string;
  title: string;
  /** One-liner for the phase 2 "add widget" picker. */
  description: string;
  /** Columns spanned on the dashboard grid. Phase 2 overrides this per user. */
  defaultSpan: 1 | 2;
  component: React.ComponentType<WidgetProps>;
}

/* -------------------------------------------------------------------------- */
/*                              Shared selectors                              */
/* -------------------------------------------------------------------------- */

export const BOUND_STAGES: DealStage[] = ['Bind / Closed Won', 'Policy On Progress'];

/** A deal that has been placed — i.e. part of the book. */
export const isBound = (d: Deal) => BOUND_STAGES.includes(d.statusStage);

export const currentMonthStart = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
};

export const previousMonthStart = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() - 1, 1).getTime();
};

/** Days from now until `iso`. Negative when already past. */
export const daysUntil = (iso?: string): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
};

/* -------------------------------------------------------------------------- */
/*                                Formatting                                  */
/* -------------------------------------------------------------------------- */

export const fmtIDR = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${Math.round(n).toLocaleString()}`;
};

/* -------------------------------------------------------------------------- */
/*                                   Chrome                                   */
/* -------------------------------------------------------------------------- */

/**
 * Common card chrome. Every widget gets a title, an optional icon, and a
 * drill-through footer — no widget is allowed to dead-end.
 */
export const WidgetShell: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where the footer link goes, in words. */
  drillLabel: string;
  onDrill: () => void;
  children: React.ReactNode;
}> = ({ title, icon: Icon, drillLabel, onDrill, children }) => (
  <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
    <div className="px-5 pt-4 pb-3 flex items-center gap-2.5 border-b border-slate-100">
      <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <h3 className="text-[13px] font-bold text-slate-900">{title}</h3>
    </div>

    <div className="p-5 flex-1">{children}</div>

    <button
      onClick={onDrill}
      className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 hover:bg-slate-100 text-[12px] font-semibold text-blue-600 flex items-center justify-between transition-colors group"
    >
      {drillLabel}
      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
    </button>
  </div>
);

/** Big number with a caption. */
export const Metric: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'emerald' | 'amber';
}> = ({ label, value, sub, tone = 'default' }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
    <div className={cn(
      'text-[20px] font-bold leading-tight mt-0.5',
      tone === 'emerald' && 'text-emerald-700',
      tone === 'amber' && 'text-amber-700',
      tone === 'default' && 'text-slate-900',
    )}>
      {value}
    </div>
    {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

/** Empty state used when a widget has nothing to show yet. */
export const WidgetEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[12px] text-slate-400 italic py-6 text-center">{children}</div>
);
