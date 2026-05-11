import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Client, CompanyClass } from '../../types';
import { Plus, Search, Building2, Edit, Trash2, Filter, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { ClientForm } from './ClientForm';
import { ClientImportModal } from './ClientImportModal';
import { classifyClient } from '../../utils/clientClassifier';

type ClassFilter = 'all' | CompanyClass;

export const ClientsView = () => {
  const { clients, deals, deleteClient } = useData();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Compute classification once per render for all clients.
  const classifiedClients = useMemo(() => {
    return clients.map(c => ({
      client: c,
      classification: classifyClient(c, deals),
    }));
  }, [clients, deals]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    return classifiedClients
      .filter(({ client, classification }) => {
        const matchesSearch =
          (client.companyName || '').toLowerCase().includes(q) ||
          (client.lineOfBusiness || '').toLowerCase().includes(q) ||
          (client.businessOccupation || '').toLowerCase().includes(q) ||
          (client.parentGroup || '').toLowerCase().includes(q);
        const matchesClass = classFilter === 'all' || classification.effectiveClass === classFilter;
        return matchesSearch && matchesClass;
      })
      .sort((a, b) => new Date(b.client.updatedAt).getTime() - new Date(a.client.updatedAt).getTime());
  }, [classifiedClients, search, classFilter]);

  const counts = useMemo(() => {
    const sme = classifiedClients.filter(c => c.classification.effectiveClass === 'SME').length;
    const large = classifiedClients.filter(c => c.classification.effectiveClass === 'Large Enterprise').length;
    return { all: classifiedClients.length, sme, large };
  }, [classifiedClients]);

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (deals.some(d => d.clientId === id)) {
      toast.error(`Cannot delete ${name} because they have active pipelines.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete the client profile for ${name}?`)) {
      deleteClient(id);
      toast.success('Client deleted');
    }
  };

  const getClientDealCount = (clientId: string) => {
    return deals.filter(d => d.clientId === clientId).length;
  };

  return (
    <div className="h-full flex flex-col p-8 relative bg-slate-50">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Client Database</h2>
          <p className="text-[13px] text-slate-500">Manage master company profiles.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors border border-slate-200 shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Client Profile
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by company, group, LOB, or occupation..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <ClassFilterPill label={`All (${counts.all})`} active={classFilter === 'all'} onClick={() => setClassFilter('all')} />
            <ClassFilterPill label={`SME (${counts.sme})`} active={classFilter === 'SME'} onClick={() => setClassFilter('SME')} />
            <ClassFilterPill label={`Large Ent. (${counts.large})`} active={classFilter === 'Large Enterprise'} onClick={() => setClassFilter('Large Enterprise')} />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Company Name</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Class</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Parent Group</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Line of Business</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Business Occupation</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-center">Deals</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map(({ client, classification }) => {
                const dealCount = getClientDealCount(client.id);
                return (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="font-semibold text-slate-900">{client.companyName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <ClassBadge
                        cls={classification.effectiveClass}
                        isManual={classification.isManualOverride}
                        title={classification.autoReasons.join(' · ')}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-slate-600">{client.parentGroup || '-'}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-700">{client.lineOfBusiness}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-slate-600 truncate max-w-[200px]" title={client.businessOccupation}>{client.businessOccupation}</div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                        dealCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                      )}>
                        {dealCount} Pipeline{dealCount !== 1 && 's'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(client)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(client.id, client.companyName)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {filteredClients.length === 0 && (
            <div className="p-12 border-t border-slate-100 flex flex-col items-center justify-center text-slate-500">
              <Building2 className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-[14px] font-semibold text-slate-900 mb-1">No clients found</p>
              <p className="text-[13px] text-slate-500 mb-4">
                {clients.length === 0
                  ? 'You have not added any master client profiles.'
                  : 'No clients match your current search and filter.'}
              </p>
              {clients.length === 0 && (
                <button 
                  onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
                  className="text-blue-600 text-[13px] font-bold hover:underline"
                >
                  Create a Client Profile
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <ClientForm 
          client={editingClient} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}

      {isImportOpen && (
        <ClientImportModal onClose={() => setIsImportOpen(false)} />
      )}
    </div>
  );
};

const ClassFilterPill: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 text-[12px] font-semibold rounded transition-colors",
      active
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100"
    )}
  >
    {label}
  </button>
);

const ClassBadge: React.FC<{ cls: CompanyClass; isManual: boolean; title?: string }> = ({ cls, isManual, title }) => {
  const isLarge = cls === 'Large Enterprise';
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
        isLarge
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-slate-100 text-slate-700 border-slate-200"
      )}
    >
      {isLarge ? 'Large Ent.' : 'SME'}
      {isManual && <span className="text-[9px] font-bold uppercase opacity-70">·M</span>}
    </span>
  );
};