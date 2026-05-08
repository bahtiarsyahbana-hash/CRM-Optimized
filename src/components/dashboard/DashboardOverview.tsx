import React from 'react';
import { useData } from '../../context/DataContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, Users, ShieldAlert, DollarSign, Briefcase } from 'lucide-react';

export const DashboardOverview = () => {
  const { deals, claims, clients } = useData();

  // Metrics calculation
  const totalClients = clients.length;
  const newBusinessCount = deals.filter(d => d.dealType === 'New Business').length;
  const renewalCount = deals.filter(d => d.dealType === 'Renewal').length;
  const crossSellCount = deals.filter(d => d.dealType === 'Cross Sell').length;

  const totalPipelinePremium = deals.reduce((acc, deal) => acc + (deal.premiumAmount || 0), 0);
  const totalClaims = claims.length;
  const activeClaims = claims.filter(c => c.status !== 'Closed' && c.status !== 'Approved' && c.status !== 'Declined').length;

  // Pie chart data
  const clientTypeData = [
    { name: 'New Business', value: newBusinessCount },
    { name: 'Renewals', value: renewalCount },
    { name: 'Cross Sell', value: crossSellCount }
  ].filter(d => d.value > 0);
  const COLORS = ['#3b82f6', '#a855f7', '#10b981']; // blue, purple, emerald

  // Bar chart data (deals by stage)
  const newBizStages = ['Leads', 'Data Collection', 'Quote', 'Nego', 'Bind / Closed Won', 'Policy On Progress'];
  const pipelineData = newBizStages.map(stage => {
    return {
      name: stage,
      value: deals.filter(d => d.statusStage === stage).length
    };
  });

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 overflow-y-auto relative">
      <div className="mb-8 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Company Dashboard</h2>
        <p className="text-[13px] text-slate-500">Overview of your firm's performance and risk exposure</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 shrink-0">
        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-500 text-[13px] uppercase tracking-wider">Registered Clients</h3>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{totalClients}</div>
          <p className="text-[12px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> System master records
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-500 text-[13px] uppercase tracking-wider">Active Deals</h3>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{deals.length}</div>
          <p className="text-[12px] text-slate-500 font-medium mt-2">
            Deals in pipeline
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-500 text-[13px] uppercase tracking-wider">Estimated Premium</h3>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">
             {totalPipelinePremium > 1000000 ? `$${(totalPipelinePremium / 1000000).toFixed(1)}M` : `$${totalPipelinePremium.toLocaleString()}`}
          </div>
          <p className="text-[12px] text-emerald-600 font-medium mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Potential revenue
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-500 text-[13px] uppercase tracking-wider">Active Claims</h3>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{activeClaims}</div>
          <p className="text-[12px] text-slate-500 font-medium mt-2">
            Out of {totalClaims} total claims
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-500 text-[13px] uppercase tracking-wider">Total Exposure (TSI)</h3>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {deals.reduce((acc, deal) => acc + (deal.sumInsured || 0), 0) > 1000000 ? `$${(deals.reduce((acc, deal) => acc + (deal.sumInsured || 0), 0) / 1000000).toFixed(1)}M` : `$${deals.reduce((acc, deal) => acc + (deal.sumInsured || 0), 0).toLocaleString()}`}
          </div>
          <p className="text-[12px] text-slate-500 font-medium mt-2">
            Total Sum Insured pipeline
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
           <h3 className="font-bold text-slate-900 mb-6">Deals by Stage</h3>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                 <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" />
                 <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                 <RechartsTooltip 
                   cursor={{ fill: '#f8fafc' }} 
                   contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                 />
                 <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
           <h3 className="font-bold text-slate-900 mb-6">Deal Type Distribution</h3>
           {clientTypeData.length === 0 ? (
             <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
               No deal data available to chart
             </div>
           ) : (
             <div className="h-[300px] w-full flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={clientTypeData}
                     cx="50%"
                     cy="50%"
                     innerRadius={80}
                     outerRadius={110}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {clientTypeData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <RechartsTooltip 
                     contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                   />
                   <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px' }}/>
                 </PieChart>
               </ResponsiveContainer>
             </div>
           )}
        </div>
      </div>

    </div>
  );
};

