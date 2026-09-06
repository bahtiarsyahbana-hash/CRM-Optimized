import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { AppUser, UserRole, USER_ROLES, ROLE_PERMISSIONS, PERMISSION_MODULES } from '../../types';
import { canSaveUserEdit, isLastActiveAdministrator } from '../../utils/permissions';
import { X, UserCog, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[13px]';

const ROLE_SUMMARY: Record<UserRole, string> = {
  Administrator: 'Everything, including user management and master data.',
  Operations:    'Submissions, declarations, policies, claims and clients. No rate changes, no master data, no users.',
  Finance:       'Invoices, commission and payment. Read-only on the pipeline.',
  Viewer:        'Read-only across the operational app.',
};

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> =
  ({ label, required, hint, children }) => (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );

export const UserForm: React.FC<{ user?: AppUser | null; onClose: () => void }> = ({ user, onClose }) => {
  const { users, addUser, updateUser } = useData();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'Viewer');
  const [division, setDivision] = useState(user?.division || '');
  const [active, setActive] = useState(user?.active ?? true);

  const isLastAdmin = user ? isLastActiveAdministrator(users, user.id) : false;

  // One gate covers demotion and deactivation, since a single submit can do both.
  const guard = useMemo(
    () => user ? canSaveUserEdit(users, user.id, { role, active }) : { allowed: true as const },
    [user, users, role, active],
  );

  const emailTaken = users.some(u =>
    u.id !== user?.id && u.email.trim().toLowerCase() === email.trim().toLowerCase());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    if (!email.trim()) return toast.error('Email is required.');
    if (emailTaken) return toast.error('That email is already used by another user.');
    if (!guard.allowed) return toast.error(guard.reason!);

    const payload = {
      name: name.trim(),
      email: email.trim(),
      role,
      division: division.trim() || undefined,
      active,
    };

    if (user) {
      updateUser(user.id, payload);
      toast.success('User updated');
    } else {
      addUser(payload);
      toast.success('User added');
    }
    onClose();
  };

  const blocked = !guard.allowed || emailTaken;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">{user ? 'Edit User' : 'Add User'}</h2>
              <p className="text-[12px] text-slate-500">Determines which screens this person is shown.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="user-form" onSubmit={submit} className="p-5 space-y-4">
          {isLastAdmin && (
            <div className="flex items-start gap-2 text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This is the last active Administrator. Their role and active status are locked until
                another user is made an Administrator.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" required>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className={inputClass} placeholder="Full name" />
            </Field>
            <Field label="Email" required hint={emailTaken ? undefined : 'Used as the identifier.'}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className={cn(inputClass, emailTaken && 'border-red-300 focus:border-red-500 focus:ring-red-500')}
                placeholder="name@bindcover.com" />
              {emailTaken && (
                <p className="mt-1 text-[11px] text-red-600">Already used by another user.</p>
              )}
            </Field>
          </div>

          <Field label="Role" required hint={ROLE_SUMMARY[role]}>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              disabled={isLastAdmin}
              className={cn(inputClass, isLastAdmin && 'bg-slate-50 text-slate-500 cursor-not-allowed')}
            >
              {USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Division">
            <input type="text" value={division} onChange={e => setDivision(e.target.value)}
              className={inputClass} placeholder="e.g. Marine, Corporate, Finance" />
          </Field>

          <Field label="Status">
            <div className="flex rounded-md overflow-hidden border border-slate-200">
              {[true, false].map((val, idx) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setActive(val)}
                  disabled={isLastAdmin && !val}
                  title={isLastAdmin && !val ? 'The last active Administrator cannot be deactivated.' : undefined}
                  className={cn(
                    'flex-1 px-3 py-2 text-[13px] font-semibold transition-colors',
                    idx > 0 && 'border-l border-slate-200',
                    active === val
                      ? (val ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white')
                      : isLastAdmin && !val
                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {val ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
          </Field>

          {/* What this role will actually see — the point of the setting. */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Sidebar for this role
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERMISSION_MODULES.filter(m => m.navView).map(m => {
                const level = ROLE_PERMISSIONS[role][m.id];
                return (
                  <span
                    key={m.id}
                    title={level === 'None' ? 'Hidden from the sidebar' : level}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium border',
                      level === 'None'
                        ? 'bg-white text-slate-300 border-slate-200 line-through'
                        : level === 'Edit'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200',
                    )}
                  >
                    {m.label}
                  </span>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Struck-through entries are hidden entirely, not shown and refused.
            </p>
          </div>

          {!guard.allowed && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {guard.reason}
            </div>
          )}
        </form>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
            Cancel
          </button>
          <button type="submit" form="user-form" disabled={blocked}
            className={cn(
              'px-4 py-2 text-[13px] font-semibold text-white rounded-md shadow-sm transition-colors',
              blocked ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
            )}>
            {user ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  );
};
