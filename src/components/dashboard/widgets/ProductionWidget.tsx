import React, { useMemo } from 'react';
import { useData } from '../../../context/DataContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { trackOf } from '../../../utils/dealTrack';
import {
  WidgetProps, WidgetShell, Metric, WidgetEmpty,
  isBound, fmtIDR, currentMonthStart, previousMonthStart,
} from './shared';

/**
 * Production — what has actually been written this month, against last month.
 * Counts a deal from its bindDate, falling back to updatedAt for records bound
 * before bindDate was captured.
 */
export const ProductionWidget: React.FC<WidgetProps> = ({ navigate }) => {
  const { deals } = useData();

  const stats = useMemo(() => {
    const thisMonth = currentMonthStart();
    const lastMonth = previousMonthStart();

    const boundAt = (d: typeof deals[number]) =>
      new Date(d.bindDate || d.updatedAt).getTime();

    const bound = deals.filter(isBound);
    const mtd = bound.filter(d => boundAt(d) >= thisMonth);
    const prior = bound.filter(d => {
      const t = boundAt(d);
      return t >= lastMonth && t < thisMonth;
    });

    const premiumOf = (list: typeof deals) => list.reduce((s, d) => s + (d.premiumAmount || 0), 0);
    const mtdPremium = premiumOf(mtd);
    const priorPremium = premiumOf(prior);

    // Percentage change vs last month. Null when there's no prior base.
    const delta = priorPremium > 0
      ? ((mtdPremium - priorPremium) / priorPremium) * 100
      : null;

    const newBiz = mtd.filter(d => trackOf(d.dealType) === 'New Business');
    const renewal = mtd.filter(d => trackOf(d.dealType) === 'Renewal');

    return {
      count: mtd.length,
      mtdPremium,
      priorPremium,
      delta,
      newBiz: { count: newBiz.length, premium: premiumOf(newBiz) },
      renewal: { count: renewal.length, premium: premiumOf(renewal) },
      hasAnyBound: bound.length > 0,
    };
  }, [deals]);

  const DeltaIcon = stats.delta === null ? Minus : stats.delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <WidgetShell
      title="Production"
      icon={TrendingUp}
      drillLabel="Open Pipeline"
      onDrill={() => navigate({ view: 'pipelines' })}
    >
      {!stats.hasAnyBound ? (
        <WidgetEmpty>Nothing bound yet — production starts once a deal binds.</WidgetEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Metric label="Bound this month" value={String(stats.count)} />
            <Metric label="Premium written" value={fmtIDR(stats.mtdPremium)} />
          </div>

          <div className={cn(
            'flex items-center gap-1.5 text-[12px] font-medium',
            stats.delta === null ? 'text-slate-500'
              : stats.delta >= 0 ? 'text-emerald-700' : 'text-red-600',
          )}>
            <DeltaIcon className="w-3.5 h-3.5" />
            {stats.delta === null
              ? 'No production last month to compare against'
              : `${stats.delta >= 0 ? '+' : ''}${stats.delta.toFixed(0)}% vs last month (${fmtIDR(stats.priorPremium)})`}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">New Business</div>
              <div className="text-[13px] font-bold text-slate-900 mt-0.5">{fmtIDR(stats.newBiz.premium)}</div>
              <div className="text-[11px] text-slate-500">{stats.newBiz.count} deal{stats.newBiz.count === 1 ? '' : 's'}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Renewal</div>
              <div className="text-[13px] font-bold text-slate-900 mt-0.5">{fmtIDR(stats.renewal.premium)}</div>
              <div className="text-[11px] text-slate-500">{stats.renewal.count} deal{stats.renewal.count === 1 ? '' : 's'}</div>
            </div>
          </div>
        </>
      )}
    </WidgetShell>
  );
};
