import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { CatalogueItem, CatalogueKind } from '../../types';
import { deriveCatalogueCode, uniqueCatalogueCode } from '../../utils/catalogue';
import { X, Save, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { CATALOGUE_CONFIG } from './CatalogueView';

interface Props {
  kind: CatalogueKind;
  item?: CatalogueItem;
  onClose: () => void;
}

export const CatalogueForm: React.FC<Props> = ({ kind, item, onClose }) => {
  const { products, benefits, linesOfBusiness, addCatalogueItem, updateCatalogueItem } = useData();
  const config = CATALOGUE_CONFIG[kind];
  const siblings: CatalogueItem[] =
    kind === 'products' ? products : kind === 'benefits' ? benefits : linesOfBusiness;

  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || config.categorySuggestions[0] || '');
  const [code, setCode] = useState(item?.code || '');
  /** Once the user edits the code by hand we stop regenerating it from the name. */
  const [codeTouched, setCodeTouched] = useState(Boolean(item?.code));
  const [description, setDescription] = useState(item?.description || '');
  const [active, setActive] = useState(item?.active ?? true);

  const takenCodes = useMemo(
    () => new Set(siblings.filter(s => s.id !== item?.id).map(s => s.code.toUpperCase())),
    [siblings, item?.id],
  );

  const suggestCode = (fromName: string) =>
    uniqueCatalogueCode(deriveCatalogueCode(fromName), takenCodes);

  const onNameChange = (value: string) => {
    setName(value);
    if (!codeTouched) setCode(value.trim() ? suggestCode(value) : '');
  };

  const duplicateName = siblings.some(
    s => s.id !== item?.id && s.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const duplicateCode = code.trim() ? takenCodes.has(code.trim().toUpperCase()) : false;

  const canSave = name.trim().length > 0 && !duplicateName && !duplicateCode;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const payload = {
      name: name.trim(),
      category: category.trim(),
      code: (code.trim() || suggestCode(name)).toUpperCase(),
      description: description.trim() || undefined,
      active,
    };

    if (item) {
      updateCatalogueItem(kind, item.id, payload);
      toast.success(`${payload.name} updated.`);
    } else {
      addCatalogueItem(kind, payload);
      toast.success(`${payload.name} added.`);
    }
    onClose();
  };

  const listId = `catalogue-categories-${kind}`;
  const categoryOptions = useMemo(() => {
    const existing = siblings.map(s => s.category).filter(Boolean);
    return Array.from(new Set([...config.categorySuggestions, ...existing]));
  }, [siblings, config.categorySuggestions]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">
              {item ? `Edit ${config.singular}` : `Add ${config.singular}`}
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">{config.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              autoFocus
              placeholder={kind === 'benefits' ? 'e.g. Earthquake Extension' : 'e.g. Property All Risk'}
              className={cn(
                'w-full px-3 py-2 border rounded-md text-[13px] focus:outline-none transition-colors',
                duplicateName ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500',
              )}
            />
            {duplicateName && (
              <p className="text-[11px] text-red-600 mt-1">
                Another {config.singular.toLowerCase()} already has this name.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Category</label>
              <input
                type="text"
                list={listId}
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 transition-colors"
              />
              <datalist id={listId}>
                {categoryOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Code</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={code}
                  onChange={e => { setCodeTouched(true); setCode(e.target.value.toUpperCase()); }}
                  placeholder="Auto"
                  className={cn(
                    'w-full px-3 py-2 border rounded-md text-[13px] font-mono focus:outline-none transition-colors',
                    duplicateCode ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500',
                  )}
                />
                <button
                  type="button"
                  title="Regenerate from name"
                  onClick={() => { setCodeTouched(false); setCode(name.trim() ? suggestCode(name) : ''); }}
                  className="px-2 border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {duplicateCode && <p className="text-[11px] text-red-600 mt-1">This code is already used.</p>}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — what this covers, or when to use it."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600"
            />
            <span className="text-[12px] text-slate-700">
              <span className="font-semibold">Active</span>
              <span className="block text-slate-500 mt-0.5">
                Inactive items stay on the records that already use them, but are hidden from pickers.
              </span>
            </span>
          </label>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-4 h-4" /> {item ? 'Save changes' : `Add ${config.singular.toLowerCase()}`}
          </button>
        </div>
      </form>
    </div>
  );
};
