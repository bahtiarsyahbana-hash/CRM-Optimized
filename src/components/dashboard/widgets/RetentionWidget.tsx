import React, { useMemo } from 'react';
import { useData } from '../../../context/DataContext';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { trackOf } from '../../../utils/dealTrack';
import {
  WidgetProps, WidgetShell, Metric, WidgetEmpty,
  isBound, fmtIDR, daysUntil,
} from './shared';

/** Expiry buckets, in days from today. */
const BUCKETS = [
  { key: '0-30',  label: 'Next 30 days',  max: 30,  tone: 'red' as const },
  { key: '31-60', label: '31 – 60 days',  max: 60,  tone: 'amber' as const },
  { key: '61-90', label: '61 – 90 days',  max: 90,  tone: 'slate' as const },
];

/**
 * Retention — the renewal book. What's expiring soon, and how much of it is
 * already working its way through Submissions. Drills to Submissions on the
 * Renewals tab.
 */
export const RetentionWidget: React.FC<WidgetProps> = ({ navigate }) => {
  const { deals } = useData();

  const stats = useMemo(() => {
    // Bound policies expiring within 90 days, bucketed.
    const expiring = deals
      .filter(isBound)
      .map(d => ({ deal: d, days: daysUntil(d.periodEnd) }))
      .filter((x): x is { deal: typeof deals[number]; days: number } =>
        x.days !== null && x.days >= 0 && x.days <= 90);

    const buckets = BUCKETS.map((b, i) => {
      const min = i === 0 ? 0 : BUCKETS[i - 1].max + 1;
      const items = expiring.filter(x => x.days >= min && x.days <= b.max);
      return {
        ...b,
        count: items.length,
        premium: items.reduce((s, x) => s + (x.deal.premiumAmount || 0), 0),
      };
    });

    const atRisk = expiring.reduce((s, x) => s + (x.deal.premiumAmount || 0), 0);

    // Renewals already in the submission funnel (not yet approved).
    const inFunnel = deals.filter(d =>
      d.approvalStatus !== 'Approved' && trackOf(d.dealType) === 'Renewal');

    return {
      expiringCount: expiring.length,
      atRisk,
      buckets,
      funnelCount: inFunnel.length,
    };
  }, [deals]);

  const nothingToShow = stats.expiringCount === 0 && stats.funnelCount === 0;

  return (
    <WidgetShell
      title="Retention"
      icon={RefreshCw}
      drillLabel="Open Submissions · Renewals"
      onDrill={() => navigate({ view: 'submission', params: { track: 'Renewal' } })}
    >
      {nothingToShow ? (
        <WidgetEmpty>No policies expiring in the next 90 days.</WidgetEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Metric
              label="Expiring in 90 days"
              value={String(stats.expiringCount)}
              tone={stats.expiringCount > 0 ? 'amber' : 'default'}
            />
            <Metric label="Premium at risk" value={fmtIDR(stats.atRisk)} />
          </div>

          <div className="space-y-1.5">
            {stats.buckets.map(b => (
              <div key={b.key} className="flex items-center gap-2 text-[12px]">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  b.tone === 'red' && 'bg-red-500',
                  b.tone === 'amber' && 'bg-amber-500',
                  b.tone === 'slate' && 'bg-slate-400',
                )} />
                <span className="text-slate-700 flex-1">{b.label}</span>
                <span className="text-slate-500">{b.count}</span>
                <span className="font-mono text-slate-600 w-16 text-right">{fmtIDR(b.premium)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[12px] text-slate-600">
            <span className="font-bold text-slate-900">{stats.funnelCount}</span>{' '}
            renewal{stats.funnelCount === 1 ? '' : 's'} currently in the submission funnel
          </div>
        </>
      )}
    </WidgetShell>
  );
};
