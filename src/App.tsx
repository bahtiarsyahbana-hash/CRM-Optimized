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
import { NavTarget, Navigate, ViewId } from './lib/navigation';

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
 * Group order follows the lifecycle: acquire → bind → service → reference → admin.
 * Dashboard sits outside any group, as its own top-level item.
 *
 * Groups only cover pages that exist today. Billing (Invoices), Open Covers,
 * Certificates, Cancellations, Insurers, Products, Benefits and Users & Roles
 * are absent from this build and are therefore absent from the nav — they slot
 * into this same shape as they land.
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
    // to keep them visibly distinct from ViewState ids.
    id: 'group:policies',
    label: 'Policies',
    children: [
      { id: 'policies', label: 'Policy Register', icon: Briefcase },
    ],
  },

  {
    id: 'group:servicing',
    label: 'Servicing',
    children: [
      { id: 'claims', label: 'Claims', icon: ShieldAlert },
      { id: 'aftersales', label: 'Endorsements', icon: FileEdit },
    ],
  },

  {
    id: 'group:directory',
    label: 'Directory',
    children: [
      { id: 'clients', label: 'Clients', icon: Users },
    ],
  },

  {
    id: 'group:administration',
    label: 'Administration',
    children: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'architecture', label: 'System Docs', icon: Database },
    ],
  },
];

/* -------------------------------------------------------------------------- */

function Shell() {
  const [nav, setNav] = useState<NavTarget>({ view: 'submission' });
  const currentView = nav.view;

  const navigate: Navigate = (target) => setNav(target);
  /** Sidebar clicks navigate without params, clearing any active drill-through filter. */
  const setCurrentView = (view: ViewId) => setNav({ view });

  /**
   * Remount key for the content area. Views seed their filters from props on
   * mount, so this forces a re-seed when the same view is re-entered with
   * different params (e.g. Insurer Panel → Policies twice for two insurers).
   */
  const navKey = `${nav.view}:${JSON.stringify(nav.params ?? {})}`;

  // Every group starts expanded; state is per-session.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (id: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Which group holds the active view — used to keep a collapsed group marked active.
  const activeGroupId = useMemo(
    () => NAV.find(e => isGroup(e) && e.children.some(c => c.id === currentView))?.id,
    [currentView],
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
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <span className="hidden sm:block">Admin User</span>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">A</div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[200px] border-r border-slate-200 bg-white flex flex-col py-4 shrink-0 overflow-y-auto">
          {NAV.map(entry => {
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
            {currentView === 'claims' && <ClaimsView />}
            {currentView === 'aftersales' && <AftersalesView initialTab="endorsements" />}
            {currentView === 'clients' && <ClientsView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'architecture' && <ArchitectureView />}
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
