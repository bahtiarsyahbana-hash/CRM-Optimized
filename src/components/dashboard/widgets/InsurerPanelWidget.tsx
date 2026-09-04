import React, { useMemo } from 'react';
import { useData } from '../../../context/DataContext';
import { Building } from 'lucide-react';
import { WidgetProps, WidgetShell, WidgetEmpty, isBound, fmtIDR } from './shared';

/**
 * Insurer Panel — where the book is placed, by premium share. Each row is
 * itself a drill-through: clicking an insurer opens the Policy Register
 * filtered to that insurer.
 */
export const InsurerPanelWidget: React.FC<WidgetProps> = ({ navigate }) => {
  const { deals } = useData();

  const stats = useMemo(() => {
    const bound = deals.filter(isBound);

    const byInsurer = new Map<string, { premium: number; count: number }>();
    bound.forEach(d => {
      const key = d.insuranceCompany || 'Unassigned';
      const cur = byInsurer.get(key) || { premium: 0, count: 0 };
      cur.premium += d.premiumAmount || 0;
      cur.count += 1;
      byInsurer.set(key, cur);
    });

    const total = bound.reduce((s, d) => s + (d.premiumAmount || 0), 0);
    const rows = [...byInsurer.entries()]
      .map(([name, v]) => ({ name, ...v, share: total > 0 ? (v.premium / total) * 100 : 0 }))
      .sort((a, b) => b.premium - a.premium);

    return { rows: rows.slice(0, 5), insurerCount: rows.length, total };
  }, [deals]);

  return (
    <WidgetShell
      title="Insurer Panel"
      icon={Building}
      drillLabel="Open Policy Register"
      onDrill={() => navigate({ view: 'policies' })}
    >
      {stats.rows.length === 0 ? (
        <WidgetEmpty>No bound policies to attribute to an insurer yet.</WidgetEmpty>
      ) : (
        <>
          <div className="text-[11px] text-slate-500 mb-3">
            {stats.insurerCount} insurer{stats.insurerCount === 1 ? '' : 's'} on panel
            {stats.rows.length < stats.insurerCount && ` · top ${stats.rows.length} shown`}
          </div>

          <div className="space-y-2">
            {stats.rows.map(row => (
              <button
                key={row.name}
                onClick={() => navigate({ view: 'policies', params: { insurer: row.name } })}
                className="w-full text-left group"
                title={`View ${row.name} policies`}
              >
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-slate-700 truncate pr-2 group-hover:text-blue-600 transition-colors">
                    {row.name}
                  </span>
                  <span className="font-mono text-slate-600 shrink-0">
                    {fmtIDR(row.premium)}
                    <span className="text-slate-400 ml-1.5">{row.share.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full group-hover:bg-indigo-600 transition-colors"
                    style={{ width: `${row.share}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </WidgetShell>
  );
};
