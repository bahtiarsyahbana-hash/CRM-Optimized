import React, { useMemo } from 'react';
import { useData } from '../../../context/DataContext';
import { Layers } from 'lucide-react';
import { WidgetProps, WidgetShell, Metric, WidgetEmpty, isBound, fmtIDR } from './shared';

/**
 * Portfolio — the book as it stands right now. Bound policies only.
 * Drills through to the Policy Register.
 */
export const PortfolioWidget: React.FC<WidgetProps> = ({ navigate }) => {
  const { deals } = useData();

  const stats = useMemo(() => {
    const bound = deals.filter(isBound);
    const sumInsured = bound.reduce((s, d) => s + (d.sumInsured || 0), 0);
    const premium = bound.reduce((s, d) => s + (d.premiumAmount || 0), 0);

    // Concentration by product category, largest first.
    const byProduct = new Map<string, number>();
    bound.forEach(d => {
      const key = d.productType || 'Unspecified';
      byProduct.set(key, (byProduct.get(key) || 0) + (d.premiumAmount || 0));
    });
    const products = [...byProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { count: bound.length, sumInsured, premium, products };
  }, [deals]);

  return (
    <WidgetShell
      title="Portfolio"
      icon={Layers}
      drillLabel="Open Policy Register"
      onDrill={() => navigate({ view: 'policies' })}
    >
      {stats.count === 0 ? (
        <WidgetEmpty>No bound policies yet.</WidgetEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Metric label="Policies in force" value={String(stats.count)} />
            <Metric label="Premium" value={fmtIDR(stats.premium)} />
          </div>
          <Metric label="Total sum insured" value={fmtIDR(stats.sumInsured)} />

          {stats.products.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                By product
              </div>
              <div className="space-y-1.5">
                {stats.products.map(([name, amount]) => {
                  const pct = stats.premium > 0 ? (amount / stats.premium) * 100 : 0;
                  return (
                    <div key={name} className="flex items-center gap-2 text-[12px]">
                      <span className="text-slate-700 truncate flex-1">{name}</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-slate-600 w-16 text-right shrink-0">
                        {fmtIDR(amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </WidgetShell>
  );
};
