import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { CatalogueItem, CatalogueKind } from '../../types';
import {
  CatalogueUsage, canHardDeleteCatalogueItem,
  productUsage, benefitUsage, lineOfBusinessUsage,
} from '../../utils/catalogue';
import {
  Plus, Search, Edit2, Trash2, AlertTriangle, X, Info, Package, ListChecks, Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { CatalogueForm } from './CatalogueForm';

type StatusFilter = 'Active' | 'Inactive' | 'All';
type SortKey = 'name' | 'category' | 'code';

interface CatalogueConfig {
  kind: CatalogueKind;
  title: string;
  subtitle: string;
  singular: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Suggested categories, offered as a datalist rather than enforced. */
  categorySuggestions: string[];
  /** Shown above the list when there is something the user should know. */
  note?: React.ReactNode;
}

export const CATALOGUE_CONFIG: Record<CatalogueKind, CatalogueConfig> = {
  products: {
    kind: 'products',
    title: 'Products',
    subtitle: 'Insurance products offered to clients.',
    singular: 'Product',
    icon: Package,
    categorySuggestions: ['Insurance Product', 'Package', 'Specialty'],
    note: (
      <>
        This catalogue is <strong>standalone in this build</strong>. The submission form still
        takes its Product and Type of Insurance from the built-in list, so adding a product here
        does not yet make it selectable on a deal. Wiring the cascade to read this catalogue is a
        follow-up.
      </>
    ),
  },
  benefits: {
    kind: 'benefits',
    title: 'Benefits',
    subtitle: 'Reusable benefit and coverage definitions.',
    singular: 'Benefit',
    icon: ListChecks,
    categorySuggestions: ['Property', 'Liability', 'Marine', 'Personal Accident', 'Health'],
    note: (
      <>
        Benefits are a flat list — they do not attach to a product in this build. Reconciling them
        with the SOC coverage templates is deferred with the rest of the SOC work.
      </>
    ),
  },
  linesOfBusiness: {
    kind: 'linesOfBusiness',
    title: 'Lines of Business',
    subtitle: 'Industry sectors a client is classified under.',
    singular: 'Line of Business',
    icon: Layers,
    categorySuggestions: ['Industry Sector'],
    note: (
      <>
        Line of Business drives the default commission rate and client classification. It was
        previously an open-ended field accepting any text, so this list was seeded from the
        built-in values <em>plus</em> anything already recorded on a client.
      </>
    ),
  },
};

export const CatalogueView: React.FC<{ kind: CatalogueKind }> = ({ kind }) => {
  const {
    products, benefits, linesOfBusiness, catalogueSeedReports,
    deals, masterPolicies, clients,
    removeCatalogueItem, updateCatalogueItem,
  } = useData();

  const config = CATALOGUE_CONFIG[kind];
  const items: CatalogueItem[] =
    kind === 'products' ? products : kind === 'benefits' ? benefits : linesOfBusiness;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Active');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogueItem | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<CatalogueItem | null>(null);

  /** Each catalogue is referenced through a different field. */
  const usageOf = (item: CatalogueItem): CatalogueUsage => {
    if (kind === 'products') return productUsage(item, deals, masterPolicies);
    if (kind === 'linesOfBusiness') return lineOfBusinessUsage(item, clients);
    return benefitUsage();
  };

  const seedReport = catalogueSeedReports.find(r => r.kind === kind);

  const counts = useMemo(() => ({
    Active: items.filter(i => i.active).length,
    Inactive: items.filter(i => !i.active).length,
    All: items.length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = items.filter(i => {
      if (status === 'Active' && !i.active) return false;
      if (status === 'Inactive' && i.active) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q)
        || i.code.toLowerCase().includes(q)
        || i.category.toLowerCase().includes(q);
    });
    return [...rows].sort((a, b) => {
      const av = (a[sortKey] || '').toLowerCase();
      const bv = (b[sortKey] || '').toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [items, search, status, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const confirmRemove = () => {
    if (!removeCandidate) return;
    const usage = usageOf(removeCandidate);
    const what = removeCatalogueItem(kind, removeCandidate.id, usage.count > 0);
    toast.success(what === 'deleted'
      ? `${removeCandidate.name} deleted.`
      : `${removeCandidate.name} deactivated — it is referenced by existing records.`);
    setRemoveCandidate(null);
  };

  const Icon = config.icon;

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50">
      <div className="flex justify-between items-start mb-5 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">{config.title}</h1>
          <p className="text-[13px] text-slate-500">{config.subtitle}</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add {config.singular}
        </button>
      </div>

      {config.note && (
        <div className="mb-5 rounded-md border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-700 flex gap-2.5 shrink-0">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <div>
            {config.note}
            {seedReport && seedReport.discoveredFromData.length > 0 && (
              <div className="mt-1.5 text-[12px] text-amber-800">
                {seedReport.discoveredFromData.length} value
                {seedReport.discoveredFromData.length === 1 ? ' was' : 's were'} found on existing
                records and added: <span className="font-medium">{seedReport.discoveredFromData.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, code or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['Active', 'Inactive', 'All'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                  status === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {s} ({counts[s]})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
              <tr>
                {([['code', 'Code'], ['name', 'Name'], ['category', 'Category']] as [SortKey, string][])
                  .map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key)}
                      className="px-6 py-3 font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-900">
                      {label} {sortKey === key && <span className="text-slate-400">{sortAsc ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                <th className="px-6 py-3 font-semibold text-slate-600 text-center">Used by</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => {
                const usage = usageOf(item);
                return (
                  <tr
                    key={item.id}
                    onClick={() => setEditItem(item)}
                    className={cn('hover:bg-slate-50 transition-colors group cursor-pointer', !item.active && 'opacity-60')}
                  >
                    <td className="px-6 py-3">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 mt-0.5 max-w-md truncate">{item.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{item.category || '—'}</td>
                    <td className="px-6 py-3 text-center">
                      <span
                        title={usage.label}
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                          usage.count > 0
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200',
                        )}
                      >
                        {usage.count}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                        item.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200',
                      )}>
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => e.stopPropagation()}>
                        {!item.active && (
                          <button
                            onClick={() => { updateCatalogueItem(kind, item.id, { active: true }); toast.success(`${item.name} reactivated.`); }}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                        <button onClick={() => setEditItem(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {item.active && (
                          <button onClick={() => setRemoveCandidate(item)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={usage.count > 0 ? 'Deactivate — referenced by existing records' : 'Delete'}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <Icon className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-medium text-slate-900 mb-1">
                {items.length === 0 ? `No ${config.title.toLowerCase()} yet` : 'Nothing matches this filter'}
              </p>
              {items.length === 0 && (
                <button onClick={() => setIsAddOpen(true)} className="text-blue-600 text-[13px] font-bold hover:underline mt-2">
                  Add the first {config.singular.toLowerCase()}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isAddOpen && <CatalogueForm kind={kind} onClose={() => setIsAddOpen(false)} />}
      {editItem && <CatalogueForm kind={kind} item={editItem} onClose={() => setEditItem(null)} />}

      {removeCandidate && (() => {
        const usage = usageOf(removeCandidate);
        const hard = canHardDeleteCatalogueItem(usage);
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  hard ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-slate-900">
                    {hard ? `Delete ${config.singular.toLowerCase()}?` : `Deactivate ${config.singular.toLowerCase()}?`}
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {hard ? 'Not referenced anywhere — safe to remove.' : 'Referenced by existing records.'}
                  </p>
                </div>
                <button onClick={() => setRemoveCandidate(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 text-[13px] text-slate-700 space-y-2">
                <p><span className="font-semibold">{removeCandidate.name}</span> ({removeCandidate.code})</p>
                {!hard && (
                  <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Referenced by {usage.label}. It will be deactivated instead of deleted — hidden from
                    pickers, while those records keep their classification. Reactivate any time.
                  </p>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
                <button onClick={() => setRemoveCandidate(null)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
                  Cancel
                </button>
                <button onClick={confirmRemove}
                  className={cn('px-4 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm flex items-center gap-1.5',
                    hard ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')}>
                  <Trash2 className="w-4 h-4" /> {hard ? 'Delete' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
