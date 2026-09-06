import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Insurer, InsurerContact, InsurerDocument } from '../../types';
import { deriveInsurerCode } from '../../utils/insurers';
import { X, Building, Plus, Trash2, Users2, FileText, Info, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const Field: React.FC<{ label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }> =
  ({ label, required, hint, className, children }) => (
    <div className={className}>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );

export const InsurerForm: React.FC<{ insurer?: Insurer | null; onClose: () => void }> = ({ insurer, onClose }) => {
  const { insurers, addInsurer, updateInsurer } = useData();

  const [name, setName] = useState(insurer?.name || '');
  const [code, setCode] = useState(insurer?.code || '');
  const [codeTouched, setCodeTouched] = useState(Boolean(insurer));
  const [email, setEmail] = useState(insurer?.email || '');
  const [phone, setPhone] = useState(insurer?.phone || '');
  const [commissionRate, setCommissionRate] = useState(
    insurer?.commissionRatePercent != null ? String(insurer.commissionRatePercent) : '');
  const [active, setActive] = useState(insurer?.active ?? true);
  const [contacts, setContacts] = useState<InsurerContact[]>(insurer?.contacts ?? []);
  const [documents, setDocuments] = useState<InsurerDocument[]>(insurer?.documents ?? []);

  // Suggest a code from the name until the user types one of their own.
  const handleName = (v: string) => {
    setName(v);
    if (!codeTouched) setCode(v.trim() ? deriveInsurerCode(v) : '');
  };

  const codeTaken = useMemo(
    () => insurers.some(i => i.id !== insurer?.id && i.code.toUpperCase() === code.trim().toUpperCase()),
    [insurers, insurer?.id, code],
  );

  const rate = commissionRate === '' ? undefined : parseFloat(commissionRate);
  const rateInvalid = rate !== undefined && (isNaN(rate) || rate < 0 || rate > 100);

  const blocked = !name.trim() || !code.trim() || codeTaken || rateInvalid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    if (!code.trim()) return toast.error('Code is required.');
    if (codeTaken) return toast.error(`Code ${code.toUpperCase()} is already used by another insurer.`);
    if (rateInvalid) return toast.error('Commission rate must be between 0 and 100.');

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      commissionRatePercent: rate,
      contacts: contacts.filter(c => c.name.trim()),
      documents,
      active,
    };

    if (insurer) { updateInsurer(insurer.id, payload); toast.success('Insurer updated'); }
    else { addInsurer(payload); toast.success('Insurer added'); }
    onClose();
  };

  const addContact = () =>
    setContacts(prev => [...prev, { id: newId(), name: '', email: '', phone: '', scope: '' }]);
  const patchContact = (id: string, patch: Partial<InsurerContact>) =>
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const removeContact = (id: string) => setContacts(prev => prev.filter(c => c.id !== id));

  const addDocument = () =>
    setDocuments(prev => [...prev, {
      id: newId(), name: '', type: '', uploadDate: new Date().toISOString().slice(0, 10), note: '',
    }]);
  const patchDocument = (id: string, patch: Partial<InsurerDocument>) =>
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
  const removeDocument = (id: string) => setDocuments(prev => prev.filter(d => d.id !== id));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{insurer ? 'Edit Insurer' : 'Add Insurer'}</h2>
              <p className="text-[13px] text-slate-500">Panel record, contacts and documents.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <form id="insurer-form" onSubmit={submit} className="space-y-5">

            {/* ---- Main ---- */}
            <section className="bg-white rounded-lg p-5 border border-slate-200 space-y-4">
              <h3 className="text-[13px] font-bold text-slate-800 border-b border-slate-100 pb-2">Insurer</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Name" required className="md:col-span-2">
                  <input type="text" value={name} onChange={e => handleName(e.target.value)}
                    className={inputClass} placeholder="e.g. PT Asuransi Central Asia (ACA)" />
                </Field>

                <Field
                  label="Code" required
                  hint={codeTaken ? undefined : 'Uppercase short reference. Suggested from the name.'}
                >
                  <input
                    type="text"
                    value={code}
                    onChange={e => { setCodeTouched(true); setCode(e.target.value.toUpperCase()); }}
                    className={cn(inputClass, 'font-mono', codeTaken && 'border-red-300 focus:border-red-500 focus:ring-red-500')}
                    placeholder="ACA"
                  />
                  {codeTaken && <p className="mt-1 text-[11px] text-red-600">Already used by another insurer.</p>}
                </Field>

                <Field label="Email">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className={inputClass} placeholder="underwriting@insurer.co.id" />
                </Field>

                <Field label="Phone">
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    className={inputClass} placeholder="+62 21 ..." />
                </Field>

                <Field
                  label="Commission Rate (%)"
                  hint="Pre-fills a deal's base commission when this insurer is selected. Stays editable per deal."
                >
                  <input
                    type="number" step="0.01" min="0" max="100"
                    value={commissionRate}
                    onChange={e => setCommissionRate(e.target.value)}
                    className={cn(inputClass, rateInvalid && 'border-red-300')}
                    placeholder="e.g. 15"
                  />
                </Field>
              </div>

              <Field label="Status">
                <div className="flex rounded-md overflow-hidden border border-slate-200 max-w-xs">
                  {[true, false].map((val, idx) => (
                    <button
                      key={String(val)} type="button" onClick={() => setActive(val)}
                      className={cn(
                        'flex-1 px-3 py-2 text-[13px] font-semibold transition-colors',
                        idx > 0 && 'border-l border-slate-200',
                        active === val
                          ? (val ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white')
                          : 'bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {val ? 'Active' : 'Inactive'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Inactive insurers are hidden from pickers but keep their history.</p>
              </Field>
            </section>

            {/* ---- Contacts ---- */}
            <section className="bg-white rounded-lg p-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Users2 className="w-3.5 h-3.5 text-slate-400" /> Contacts
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Several per insurer — a marine PIC and a non-marine PIC are usually different people.
                  </p>
                </div>
                <button type="button" onClick={addContact}
                  className="px-2.5 py-1.5 text-[12px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-md flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Contact
                </button>
              </div>

              {contacts.length === 0 ? (
                <p className="text-[12px] text-slate-400 italic py-3">No contacts yet.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c, i) => (
                    <div key={c.id} className="border border-slate-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact {i + 1}</span>
                        <button type="button" onClick={() => removeContact(c.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Person In Charge">
                          <input type="text" value={c.name} onChange={e => patchContact(c.id, { name: e.target.value })}
                            className={inputClass} placeholder="Full name" />
                        </Field>
                        <Field label="Scope" hint="e.g. Marine, Non-Marine, Claims">
                          <input type="text" value={c.scope || ''} onChange={e => patchContact(c.id, { scope: e.target.value })}
                            className={inputClass} placeholder="Marine" />
                        </Field>
                        <Field label="Email">
                          <input type="email" value={c.email || ''} onChange={e => patchContact(c.id, { email: e.target.value })}
                            className={inputClass} placeholder="pic@insurer.co.id" />
                        </Field>
                        <Field label="Phone">
                          <input type="tel" value={c.phone || ''} onChange={e => patchContact(c.id, { phone: e.target.value })}
                            className={inputClass} placeholder="+62 ..." />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ---- Documents: METADATA ONLY ---- */}
            <section className="bg-white rounded-lg p-5 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> Documents
                </h3>
                <button type="button" onClick={addDocument}
                  className="px-2.5 py-1.5 text-[12px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-md flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Document
                </button>
              </div>

              <div className="flex items-start gap-2 text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Records only — no files are stored.</strong> IRIS keeps everything in browser
                  storage with about 5&nbsp;MB in total, so a single attached PDF would fill it and take
                  clients, deals and policies down with it. Keep the file in your own system and record
                  it here.
                </span>
              </div>

              {documents.length === 0 ? (
                <p className="text-[12px] text-slate-400 italic py-2">No documents recorded.</p>
              ) : (
                <div className="space-y-3">
                  {documents.map(d => (
                    <div key={d.id} className="border border-slate-200 rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Document</span>
                        <button type="button" onClick={() => removeDocument(d.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Document Name">
                          <input type="text" value={d.name} onChange={e => patchDocument(d.id, { name: e.target.value })}
                            className={inputClass} placeholder="e.g. 2026 Marine Slip" />
                        </Field>
                        <Field label="Type">
                          <input type="text" value={d.type} onChange={e => patchDocument(d.id, { type: e.target.value })}
                            className={inputClass} placeholder="Slip / Treaty / Rate sheet" />
                        </Field>
                        <Field label="Date Received">
                          <input type="date" value={d.uploadDate?.slice(0, 10) || ''}
                            onChange={e => patchDocument(d.id, { uploadDate: e.target.value })}
                            className={inputClass} />
                        </Field>
                        <Field label="Note" className="md:col-span-3">
                          <input type="text" value={d.note || ''} onChange={e => patchDocument(d.id, { note: e.target.value })}
                            className={inputClass} placeholder="Where the file lives, what it covers..." />
                        </Field>
                      </div>
                      {/* TODO(supabase): replace this with a real upload once a storage
                          bucket exists. It must write an object key, never file bytes. */}
                      <button
                        type="button"
                        disabled
                        title="File upload needs server-side storage, which this build does not have."
                        className="mt-2 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded-md flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <Upload className="w-3 h-3" /> Attach file — not available yet
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
            Cancel
          </button>
          <button type="submit" form="insurer-form" disabled={blocked}
            className={cn(
              'px-5 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm transition-colors',
              blocked ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
            )}>
            {insurer ? 'Save Changes' : 'Add Insurer'}
          </button>
        </div>
      </div>
    </div>
  );
};
