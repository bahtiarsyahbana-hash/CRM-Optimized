import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Deal, DealStage, TERMINAL_CLAIM_STATUSES } from '../../types';
import { computeDealCommission } from '../../utils/commissionCalc';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Coins, TrendingUp, Sparkles, Clock, ShieldAlert, Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ----- helpers --------------------------------------------------------------

const BOUND_STAGES: DealStage[] = ['Bind / Closed Won', 'Policy On Progress'];
const PROSPECT_STAGES: DealStage[] = ['Leads', 'Data Collection', 'Quote', 'Nego'];

const isBound = (d: Deal) => BOUND_STAGES.includes(d.statusStage);
const isProspect = (d: Deal) => PROSPECT_STAGES.includes(d.statusStage);

const isoMonthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

const currentMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
};

const daysSince = (iso?: string): number | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
};

const fmtIDR = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${Math.round(n).toLocaleString()}`;
};

const fmtIDRFull = (n: number) => `Rp ${Math.round(n).toLocaleString()}`;

// ----- main view ------------------------------------------------------------

export const DashboardOverview = () => {
  const { deals, claims, clients } = useData();

  const mtdCutoff = useMemo(() => currentMonthStart(), []);

  const boundMTD = useMemo(
    () => deals.filter(d => isBound(d) && new Date(d.createdAt).getTime() >= mtdCutoff),
    [deals, mtdCutoff],
  );

  const allBound = useMemo(() => deals.filter(isBound), [deals]);

  const totalGWP = useMemo(
    () => boundMTD.reduce((sum, d) => sum + (d.premiumAmount || 0), 0),
    [boundMTD],
  );

  const totalNetIncome = useMemo(
    () => boundMTD.reduce((sum, d) => sum + computeDealCommission(d).netIncome, 0),
    [boundMTD],
  );

  const newBusinessMTD = useMemo(() => {
    const items = boundMTD.filter(d => d.dealType === 'New Business');
    return {
      count: items.length,
      gwp: items.reduce((sum, d) => sum + (d.premiumAmount || 0), 0),
    };
  }, [boundMTD]);

  const outstanding = useMemo(() => {
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    let totalUnpaid = 0;
    for (const d of allBound) {
      if (!d.invoiceDate) continue;
      if (d.paymentStatus === 'Paid') continue;
      const age = daysSince(d.invoiceDate);
      if (age == null || age < 0) continue;
      const premium = d.premiumAmount || 0;
      totalUnpaid += premium;
      if (age <= 30) buckets['0-30'] += premium;
      else if (age <= 60) buckets['31-60'] += premium;
      else if (age <= 90) buckets['61-90'] += premium;
      else buckets['90+'] += premium;
    }
    return { ...buckets, total: totalUnpaid };
  }, [allBound]);

  const claimsMetric = useMemo(() => {
    const open = claims.filter(c => !TERMINAL_CLAIM_STATUSES.includes(c.status));
    const totalEstimated = open.reduce((sum, c) => sum + (c.estimatedAmount || 0), 0);
    return { count: open.length, totalEstimated };
  }, [claims]);

  const prospect = useMemo(() => {
    const items = deals.filter(isProspect);
    return {
      count: items.length,
      gwp: items.reduce((sum, d) => sum + (d.premiumAmount || 0), 0),
    };
  }, [deals]);

  const trend = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; gwp: number; ts: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, label: monthLabel(d.toISOString()), gwp: 0, ts: d.getTime() });
    }
    const map = new Map(buckets.map(b => [b.key, b]));
    for (const d of allBound) {
      const key = isoMonthKey(d.createdAt);
      const b = map.get(key);
      if (b) b.gwp += d.premiumAmount || 0;
    }
    return buckets;
  }, [allBound]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Dashboard</h1>
            <p className="text-[13px] text-slate-500">
              Month-to-date · {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            {clients.length} client{clients.length === 1 ? '' : 's'} · {deals.length} deal{deals.length === 1 ? '' : 's'} · {claims.length} claim{claims.length === 1 ? '' : 's'} total
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <MetricCard
            label="Total Premium (GWP)"
            primary={fmtIDR(totalGWP)}
            secondary={`${boundMTD.length} bound deal${boundMTD.length === 1 ? '' : 's'} this month`}
            icon={<Coins className="w-5 h-5" />}
            tone="blue"
            fullValue={fmtIDRFull(totalGWP)}
          />
          <MetricCard
            label="Total Income (Net)"
            primary={fmtIDR(totalNetIncome)}
            secondary="Commission after discount, tax, agent cashback"
            icon={<TrendingUp className="w-5 h-5" />}
            tone="emerald"
            fullValue={fmtIDRFull(totalNetIncome)}
          />
          <MetricCard
            label="New Business"
            primary={`${newBusinessMTD.count}`}
            secondary={fmtIDR(newBusinessMTD.gwp) + ' GWP'}
            icon={<Sparkles className="w-5 h-5" />}
            tone="purple"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard
            label="Prospect Pipeline"
            primary={`${prospect.count}`}
            secondary={fmtIDR(prospect.gwp) + ' potential GWP'}
            icon={<Target className="w-5 h-5" />}
            tone="amber"
          />
          <MetricCard
            label="Open Claims"
            primary={`${claimsMetric.count}`}
            secondary={'Est. ' + fmtIDR(claimsMetric.totalEstimated)}
            icon={<ShieldAlert className="w-5 h-5" />}
            tone="red"
          />
          <OutstandingCard data={outstanding} />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[14px] font-bold text-slate-900">GWP by Month</div>
              <div className="text-[11px] text-slate-500">Rolling 12 months · bound deals</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">12-month total</div>
              <div className="text-[14px] font-bold text-slate-900">{fmtIDR(trend.reduce((s, b) => s + b.gwp, 0))}</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtIDR(Number(v))}
                  width={70}
                />
                <RechartsTooltip
                  formatter={(v: any) => fmtIDRFull(Number(v))}
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6 }}
                />
                <Bar dataKey="gwp" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <DataReadiness deals={deals} claims={claims} />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  primary: string;
  secondary?: string;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'purple' | 'amber' | 'red';
  fullValue?: string;
}> = ({ label, primary, secondary, icon, tone, fullValue }) => {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  }[tone];
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', toneClass)}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums" title={fullValue}>{primary}</div>
      {secondary && <div className="text-[12px] text-slate-500 mt-1">{secondary}</div>}
    </div>
  );
};

const OutstandingCard: React.FC<{ data: { '0-30': number; '31-60': number; '61-90': number; '90+': number; total: number } }> = ({ data }) => {
  const has90Plus = data['90+'] > 0;
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outstanding 90+ Days</div>
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', has90Plus ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400')}>
          <Clock className="w-5 h-5" />
        </div>
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', has90Plus ? 'text-red-700' : 'text-slate-900')} title={fmtIDRFull(data['90+'])}>
        {fmtIDR(data['90+'])}
      </div>
      <div className="text-[12px] text-slate-500 mt-1">Total unpaid: {fmtIDR(data.total)}</div>
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
        <AgeBucket label="0-30" amount={data['0-30']} />
        <AgeBucket label="31-60" amount={data['31-60']} />
        <AgeBucket label="61-90" amount={data['61-90']} />
      </div>
    </div>
  );
};

const AgeBucket: React.FC<{ label: string; amount: number }> = ({ label, amount }) => (
  <div>
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label} days</div>
    <div className="text-[12px] font-semibold text-slate-700 tabular-nums mt-0.5">{fmtIDR(amount)}</div>
  </div>
);

const DataReadiness: React.FC<{ deals: any[]; claims: any[] }> = ({ deals }) => {
  const noPremium = deals.filter(d => (d.statusStage === 'Bind / Closed Won' || d.statusStage === 'Policy On Progress') && !d.premiumAmount).length;
  const noCommission = deals.filter(d => (d.statusStage === 'Bind / Closed Won' || d.statusStage === 'Policy On Progress') && (!d.commission || !d.commission.baseRate)).length;
  const noInvoice = deals.filter(d => (d.statusStage === 'Bind / Closed Won' || d.statusStage === 'Policy On Progress') && !d.invoiceDate).length;

  if (noPremium === 0 && noCommission === 0 && noInvoice === 0) return null;
  return (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-[12px] text-amber-900">
      <div className="font-semibold mb-1">Data tip — for accurate metrics</div>
      <ul className="space-y-0.5 list-disc list-inside text-[11px]">
        {noPremium > 0 && <li>{noPremium} bound deal{noPremium === 1 ? '' : 's'} missing premium amount → not counted in GWP</li>}
        {noCommission > 0 && <li>{noCommission} bound deal{noCommission === 1 ? '' : 's'} missing commission rate → not counted in Total Income</li>}
        {noInvoice > 0 && <li>{noInvoice} bound deal{noInvoice === 1 ? '' : 's'} missing invoice date → not counted in Outstanding receivables</li>}
      </ul>
    </div>
  );
};