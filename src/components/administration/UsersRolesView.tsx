import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  AppUser, UserRole, USER_ROLES, PermissionLevel,
  PERMISSION_MODULES, ROLE_PERMISSIONS,
} from '../../types';
import {
  canDeleteUser, canSaveUserEdit, isLastActiveAdministrator,
} from '../../utils/permissions';
import {
  Plus, Search, UserCog, Edit2, Trash2, AlertTriangle, X, Info, Shield, Lock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { UserForm } from './UserForm';

type Tab = 'users' | 'roles';
type SortKey = 'name' | 'email' | 'role' | 'division';

const ROLE_BADGE: Record<UserRole, string> = {
  Administrator: 'bg-purple-50 text-purple-700 border-purple-200',
  Operations:    'bg-blue-50 text-blue-700 border-blue-200',
  Finance:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  Viewer:        'bg-slate-100 text-slate-600 border-slate-200',
};

const LEVEL_STYLE: Record<PermissionLevel, string> = {
  None: 'bg-slate-100 text-slate-400',
  View: 'bg-blue-50 text-blue-700',
  Edit: 'bg-emerald-50 text-emerald-700 font-semibold',
};

export const UsersRolesView = () => {
  const { users, currentUserId, deleteUser } = useData();

  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AppUser | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = users.filter(u =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.division || '').toLowerCase().includes(q));

    return [...rows].sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase();
      const bv = (b[sortKey] || '').toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [users, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const confirmDelete = () => {
    if (!deleteCandidate) return;
    const guard = canDeleteUser(users, deleteCandidate.id);
    if (!guard.allowed) {
      toast.error(guard.reason!);
      setDeleteCandidate(null);
      return;
    }
    deleteUser(deleteCandidate.id);
    toast.success(`${deleteCandidate.name} removed.`);
    setDeleteCandidate(null);
  };

  const adminCount = users.filter(u => u.role === 'Administrator' && u.active).length;

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50">
      <div className="flex justify-between items-start mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Users &amp; Roles</h1>
          <p className="text-[13px] text-slate-500">
            Who uses IRIS, and which parts of it they see.
          </p>
        </div>
        {tab === 'users' && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-semibold text-[13px] flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        )}
      </div>

      {/* This is the single most important thing on the page. */}
      <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 flex gap-2.5 shrink-0">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>This is not access control.</strong> IRIS has no login and no server, so roles
          only decide which screens a person is shown — they do not restrict what anyone can
          reach or change. Treat this as a convenience for keeping people out of screens they
          never use, not as a way to protect data.
        </div>
      </div>

      <div className="flex gap-4 mb-5 border-b border-slate-200 pb-px shrink-0">
        {(['users', 'roles'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-2 text-[13px] font-semibold transition-colors capitalize',
              tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {t === 'users' ? `Users (${users.length})` : 'Role Permissions'}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, role or division..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="text-[11px] text-slate-500 whitespace-nowrap">
              {adminCount} active Administrator{adminCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  {([['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['division', 'Division']] as [SortKey, string][])
                    .map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className="px-6 py-3 font-semibold text-slate-600 cursor-pointer select-none hover:text-slate-900"
                      >
                        {label}
                        {sortKey === key && <span className="ml-1 text-slate-400">{sortAsc ? '▲' : '▼'}</span>}
                      </th>
                    ))}
                  <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(u => {
                  const isLastAdmin = isLastActiveAdministrator(users, u.id);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setEditUser(u)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{u.name}</span>
                          {u.id === currentUserId && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                              you
                            </span>
                          )}
                          {isLastAdmin && (
                            <span
                              title="The last active Administrator cannot be removed, deactivated or demoted."
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                            >
                              <Lock className="w-2.5 h-2.5" /> last admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{u.email}</td>
                      <td className="px-6 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold border', ROLE_BADGE[u.role])}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{u.division || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                          u.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200',
                        )}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setEditUser(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteCandidate(u)}
                            disabled={isLastAdmin}
                            title={isLastAdmin
                              ? 'The last active Administrator cannot be removed.'
                              : 'Delete'}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              isLastAdmin
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50',
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <UserCog className="w-10 h-10 text-slate-300 mb-3" />
                <p className="font-medium text-slate-900 mb-1">
                  {users.length === 0 ? 'No users yet' : 'No users match your search'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ---- Role × module matrix ---- */
        <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" /> Role Permissions
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Three levels per module, not granular CRUD. A module set to <strong>None</strong> is
              hidden from the sidebar entirely rather than shown and refused. These defaults are
              fixed in this build.
            </p>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold text-slate-600">Module</th>
                  {USER_ROLES.map(r => (
                    <th key={r} className="px-4 py-3 font-semibold text-slate-600 text-center w-36">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSION_MODULES.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        {m.label}
                        {!m.navView && (
                          <span
                            title="Not a sidebar page — this gates something inside another screen."
                            className="text-[10px] text-slate-400 border border-slate-200 rounded px-1"
                          >
                            in-page
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.description}</div>
                    </td>
                    {USER_ROLES.map(r => {
                      const level = ROLE_PERMISSIONS[r][m.id];
                      return (
                        <td key={r} className="px-4 py-2.5 text-center">
                          <span className={cn('px-2 py-0.5 rounded text-[11px]', LEVEL_STYLE[level])}>
                            {level}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddOpen && <UserForm onClose={() => setIsAddOpen(false)} />}
      {editUser && <UserForm user={editUser} onClose={() => setEditUser(null)} />}

      {deleteCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-slate-900">Delete user?</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
              <button onClick={() => setDeleteCandidate(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-[13px] text-slate-700">
              Remove <span className="font-semibold">{deleteCandidate.name}</span> ({deleteCandidate.email})?
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button onClick={() => setDeleteCandidate(null)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete user
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
