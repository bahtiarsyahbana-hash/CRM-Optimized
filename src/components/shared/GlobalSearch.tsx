import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, ShieldAlert, FileText } from 'lucide-react';
import { useData } from '../../context/DataContext';

export const GlobalSearch = ({ onNavigate }: { onNavigate: (view: 'clients'|'submission'|'pipelines'|'aftersales') => void }) => {
  const { deals, claims, clients } = useData();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results: any[] = [];
  if (query.length > 1) {
    const q = query.toLowerCase();
    
    // Deals — company/LOB live on the linked client, not the deal itself.
    deals.forEach(d => {
      const client = clients.find(c => c.id === d.clientId);
      const companyName = client?.companyName || 'Unknown Client';
      const lineOfBusiness = client?.lineOfBusiness || '-';
      if (
        companyName.toLowerCase().includes(q) ||
        lineOfBusiness.toLowerCase().includes(q) ||
        (d.typeOfInsurance && d.typeOfInsurance.toLowerCase().includes(q))
      ) {
        const isApproved = d.approvalStatus === 'Approved';
        results.push({
          type: 'deal',
          icon: Building2,
          title: companyName,
          // Tell the user where the hit will take them, since deals live in
          // two different views depending on approval state.
          subtitle: `${isApproved ? 'Pipeline' : 'Submission'} • ${lineOfBusiness} • ${d.currency} ${d.sumInsured?.toLocaleString() || '0'}`,
          id: d.id,
          approved: isApproved,
        });
      }
    });

    // Claims
    claims.forEach(cl => {
      if (cl.title.toLowerCase().includes(q) || cl.description.toLowerCase().includes(q)) {
        results.push({ 
          type: 'claim', 
          icon: ShieldAlert, 
          title: cl.title, 
          subtitle: cl.status, 
          id: cl.id 
        });
      }
    });
  }

  const handleSelect = (result: { type: string; approved?: boolean }) => {
    setIsOpen(false);
    setQuery('');
    if (result.type === 'client') onNavigate('clients');
    // Deals live in Submission until approved, then move to the Pipeline.
    if (result.type === 'deal') onNavigate(result.approved ? 'pipelines' : 'submission');
    if (result.type === 'claim') onNavigate('aftersales');
  };

  return (
    <div className="relative w-80" ref={containerRef}>
      <div className="relative group">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
        <input 
          type="text"
          value={query}
          onChange={(e) => {
             setQuery(e.target.value);
             setIsOpen(true);
          }}
          onFocus={() => { if(query) setIsOpen(true) }}
          placeholder="Search clients, deals, or claims..."
          className="w-full bg-slate-50 border border-slate-200 rounded-md py-2.5 pl-9 pr-4 text-[13px] text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
        />
      </div>

      {isOpen && query.length > 1 && (
        <div className="absolute top-full mt-2 left-0 right-[-100px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden isolate" style={{maxHeight: '400px', overflowY: 'auto'}}>
           {results.length > 0 ? (
             <div className="py-2">
               {results.map((r, i) => (
                 <button
                   key={`${r.type}-${r.id}-${i}`}
                   onClick={() => handleSelect(r)}
                   className="w-full px-4 py-3 text-left hover:bg-slate-50 flex gap-3 items-center border-b border-slate-50 last:border-0"
                 >
                   <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                     <r.icon className="w-4 h-4" />
                   </div>
                   <div>
                     <div className="font-semibold text-slate-900 text-[13px]">{r.title}</div>
                     <div className="text-[12px] text-slate-500 mt-0.5">{r.subtitle}</div>
                   </div>
                 </button>
               ))}
             </div>
           ) : (
             <div className="p-4 text-center text-[13px] text-slate-500">
               No results found for "{query}"
             </div>
           )}
        </div>
      )}
    </div>
  );
}
