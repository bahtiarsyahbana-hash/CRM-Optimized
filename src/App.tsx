import React, { useMemo, useState } from 'react';
import { DataProvider } from './context/DataContext';
import { Toaster } from 'react-hot-toast';
import {
  Briefcase,
  Users,
  LayoutDashboard,
  Database,
  ShieldAlert,
  PieChart,
  Settings,
  Inbox,
  FileEdit,
  ChevronDown,
  ChevronRight,
  Umbrella,
  Receipt,
  FileX,
  Building,
  Package,
  ListChecks,
  UserCog,
  Layers,
} from 'lucide-react';
import { cn } from './lib/utils';
import { ClientsView } from './components/clients/ClientsView';
import { SubmissionView } from './components/submission/SubmissionView';
import { PipelineView } from './components/pipeline/PipelineView';
import { PoliciesView } from './components/policies/PoliciesView';
import { AftersalesView } from './components/aftersales/AftersalesView';
import { ClaimsView } from './components/claims/ClaimsView';
import { ArchitectureView } from './components/docs/ArchitectureView';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { SettingsView } from './components/settings/SettingsView';
import { GlobalSearch } from './components/shared/GlobalSearch';
import { StubView } from './components/shared/StubView';
import { MasterPoliciesView } from './components/masterpolicies/MasterPoliciesView';
import { UsersRolesView } from './components/administration/UsersRolesView';
import { InsurersView } from './components/administration/InsurersView';
import { useData } from './context/DataContext';
import { visibleViews, moduleForView } from './utils/permissions';
import { NavTarget, Navigate, ViewId, resolveViewId } from './lib/navigation';

/* -------------------------------------------------------------------------- */
/*                                 Nav config                                 */
/* -------------------------------------------------------------------------- */

interface NavLeaf {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  label: string;
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => 'children' in entry;

/**
 * Group order follows the lifecycle: acquire → bind → bill → service →
 * reference → admin. Dashboard and Invoices sit outside any group, as their
 * own top-level items.
 *
 * Items marked `stub` appear in the nav and render a placeholder — the
 * structure is settled ahead of the implementation.
 */
const NAV: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: PieChart },

  {
    id: 'group:business',
    label: 'Business',
    children: [
      { id: 'submission', label: 'Submissions', icon: Inbox },
      { id: 'pipelines', label: 'Pipeline', icon: LayoutDashboard },
    ],
  },

  {
    // Group ids live in their own namespace (collapse state) but are suffixed
    // to keep them visibly distinct from ViewId values.
    id: 'group:policies',
    label: 'Policies',
    children: [
      { id: 'policies', label: 'Policy Register', icon: Briefcase },
      { id: 'master-policies', label: 'Master Policies', icon: Umbrella },
    ],
  },

  { id: 'invoices', label: 'Invoices', icon: Receipt },

  {
    id: 'group:servicing',
    label: 'Servicing',
    children: [
      { id: 'claims', label: 'Claims', icon: ShieldAlert },
      { id: 'aftersales', label: 'Endorsements', icon: FileEdit },
      { id: 'cancellations', label: 'Cancellations', icon: FileX },
    ],
  },

  {
    id: 'group:directory',
    label: 'Directory',
    children: [
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'insurers', label: 'Insurers', icon: Building },
    ],
  },

  {
    id: 'group:administration',
    label: 'Administration',
    children: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'benefits', label: 'Benefits', icon: ListChecks },
      { id: 'lines-of-business', label: 'Lines of Business', icon: Layers },
      { id: 'users-roles', label: 'Users & Roles', icon: UserCog },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'architecture', label: 'System Docs', icon: Database },
    ],
  },
];

/**
 * Briefs for the unbuilt pages. Keeping the intent next to the nav means the
 * placeholder states what the page is for rather than just that it's missing.
 * `today` notes where the underlying data currently lives, when it exists.
 */
const STUBS: Record<string, { title: string; purpose: string; today?: string }> = {
  'invoices': {
    title: 'Invoices',
    purpose: 'Premium billing and collection across the book.',
    today: 'Invoice date, payment status and receipt date are captured today per policy, from the Invoice action on the Policy Register.',
  },
  'cancellations': {
    title: 'Cancellations',
    purpose: 'Mid-term cancellations and the return premium they generate.',
  },
  'products': {
    title: 'Products',
    purpose: 'Product catalogue and the insurance types available under each.',
    today: 'Products and their types are defined in types.ts as PRODUCT_INSURANCE_TYPES, and drive the cascade on the submission form.',
  },
  'benefits': {
    title: 'Benefits',
    purpose: 'Reusable benefit and coverage definitions to build products from.',
  },
  'lines-of-business': {
    title: 'Lines of Business',
    purpose: 'Client industry list — the categories a client is classified under.',
    today: 'Line of Business is an open-ended union on Client (accepts any string) with no managed list, which is the fragmentation this page exists to fix.',
  },
  'users-roles': {
    title: 'Users & Roles',
    purpose: 'User accounts and the permissions attached to them.',
    today: 'There is no authentication in this build — the app runs as a single implicit admin user.',
  },
};

/* -------------------------------------------------------------------------- */

function Shell() {
  const { currentUser, users, setCurrentUserId } = useData();
  const [nav, setNav] = useState<NavTarget>({ view: 'submission' });
  const currentView = nav.view;

  /** Retired ids (open-covers, certificates) resolve to the view that replaced them. */
  const navigate: Navigate = (target) =>
    setNav({ ...target, view: resolveViewId(target.view) });
  /** Sidebar clicks navigate without params, clearing any active drill-through filter. */
  const setCurrentView = (view: ViewId) => navigate({ view });

  /**
   * Remount key for the content area. Views seed their filters from props on
   * mount, so this forces a re-seed when the same view is re-entered with
   * different params (e.g. Insurer Panel → Policies twice for two insurers).
   */
  const navKey = `${nav.view}:${JSON.stringify(nav.params ?? {})}`;

  /**
   * Switching role can hide the screen you are standing on. Fall back to the
   * first visible entry rather than rendering a blank pane.
   */
  React.useEffect(() => {
    const mod = moduleForView(nav.view);
    if (mod && !visibleViews(currentUser).has(nav.view)) {
      const first = NAV.flatMap(e => (isGroup(e) ? e.children : [e]))
        .find(leaf => !moduleForView(leaf.id) || visibleViews(currentUser).has(leaf.id));
      if (first) setNav({ view: first.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  // Every group starts expanded; state is per-session.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (id: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Sidebar entries this user may see. A module set to None is hidden entirely
   * rather than shown and refused on click. Views with no module behind them
   * (System Docs) are always visible.
   *
   * TODO(supabase): this shapes the UI only. When auth lands, every gated view
   * needs a server-side check too — hiding a link protects nothing.
   */
  const allowedViews = useMemo(() => visibleViews(currentUser), [currentUser]);
  const maySee = (view: ViewId) => !moduleForView(view) || allowedViews.has(view);

  const NAV_FOR_USER = useMemo(
    () => NAV
      .map(entry => isGroup(entry)
        ? { ...entry, children: entry.children.filter(c => maySee(c.id)) }
        : entry)
      .filter(entry => isGroup(entry) ? entry.children.length > 0 : maySee(entry.id)),
    [allowedViews],
  );

  // Which group holds the active view — used to keep a collapsed group marked active.
  const activeGroupId = useMemo(
    () => NAV_FOR_USER.find(e => isGroup(e) && e.children.some(c => c.id === currentView))?.id,
    [currentView, NAV_FOR_USER],
  );

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 relative">
        <div className="flex items-center gap-2.5">
          <img src="https://i.ibb.co/tPpYK6wp/B-logo.png" alt="BCI" className="w-8 h-8 rounded-full object-cover shrink-0" />
          <span className="font-bold text-slate-900 text-lg tracking-tight leading-none">
            IRIS <span className="font-normal text-slate-400 text-[15px]">by BCI</span>
          </span>
        </div>
        <GlobalSearch onNavigate={(view) => setCurrentView(view as ViewId)} />
        {/* No auth — this is an "acting as" switcher, not a session. It exists so
            the role matrix is observable at all. */}
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <select
              value={currentUser?.id ?? ''}
              onChange={e => setCurrentUserId(e.target.value)}
              title="Acting as — no login, this only changes which screens are shown"
              className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer text-right pr-1"
            >
              {users.filter(u => u.active).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 pr-1">
              {currentUser?.role ?? 'No user'} · viewing as
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
            {(currentUser?.name ?? 'A').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[200px] border-r border-slate-200 bg-white flex flex-col py-4 shrink-0 overflow-y-auto">
          {NAV_FOR_USER.map(entry => {
            /* --- Ungrouped top-level item (Dashboard) --- */
            if (!isGroup(entry)) {
              const active = currentView === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setCurrentView(entry.id)}
                  className={cn(
                    'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-slate-100/80 text-blue-600 font-semibold border-r-4 border-blue-600'
                      : 'text-slate-500 hover:bg-slate-50',
                  )}
                >
                  <entry.icon className="w-4 h-4 shrink-0" />
                  {entry.label}
                </button>
              );
            }

            /* --- Group --- */
            const collapsed = collapsedGroups.has(entry.id);
            const groupActive = activeGroupId === entry.id;

            return (
              <div key={entry.id} className="mt-3 first:mt-0">
                <button
                  onClick={() => toggleGroup(entry.id)}
                  className="w-full flex items-center gap-1.5 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {collapsed
                    ? <ChevronRight className="w-3 h-3 shrink-0" />
                    : <ChevronDown className="w-3 h-3 shrink-0" />}
                  <span>{entry.label}</span>
                  {/* When collapsed, still show that the active page lives in here. */}
                  {collapsed && groupActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                  )}
                </button>

                {!collapsed && entry.children.map(child => {
                  const active = currentView === child.id;
                  return (
                    <button
                      key={child.id}
                      onClick={() => setCurrentView(child.id)}
                      className={cn(
                        'w-full flex items-center gap-3 pl-8 pr-5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-slate-100/80 text-blue-600 font-semibold border-r-4 border-blue-600'
                          : 'text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      <child.icon className="w-4 h-4 shrink-0" />
                      {child.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div className="flex-1 overflow-auto">
            {currentView === 'dashboard' && <DashboardOverview navigate={navigate} />}
            {currentView === 'submission' && (
              <SubmissionView key={navKey} initialTrack={nav.params?.track} />
            )}
            {currentView === 'pipelines' && <PipelineView />}
            {currentView === 'policies' && (
              <PoliciesView key={navKey} initialSearch={nav.params?.insurer} />
            )}
            {currentView === 'master-policies' && <MasterPoliciesView />}
            {currentView === 'users-roles' && <UsersRolesView />}
            {currentView === 'insurers' && <InsurersView />}
            {currentView === 'claims' && <ClaimsView />}
            {currentView === 'aftersales' && <AftersalesView initialTab="endorsements" />}
            {currentView === 'clients' && <ClientsView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'architecture' && <ArchitectureView />}

            {/* Unbuilt pages — present in the nav, awaiting a brief. */}
            {STUBS[currentView] && <StubView {...STUBS[currentView]} />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Toaster position="top-right" />
      <Shell />
    </DataProvider>
  );
}
