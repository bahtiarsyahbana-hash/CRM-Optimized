import React, { useState } from 'react';
import { DataProvider } from './context/DataContext';
import { Toaster } from 'react-hot-toast';
import { Briefcase, Users, LayoutDashboard, FileText, Database, ShieldAlert, GitMerge, PieChart, Settings } from 'lucide-react';
import { cn } from './lib/utils';
import { ClientsView } from './components/clients/ClientsView';
import { PipelineView } from './components/pipeline/PipelineView';
import { PoliciesView } from './components/policies/PoliciesView';
import { AftersalesView } from './components/aftersales/AftersalesView';
import { ClaimsView } from './components/claims/ClaimsView';
import { ArchitectureView } from './components/docs/ArchitectureView';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { SettingsView } from './components/settings/SettingsView';
import { GlobalSearch } from './components/shared/GlobalSearch';

type ViewState = 'dashboard' | 'clients' | 'pipelines' | 'policies' | 'claims' | 'aftersales' | 'architecture' | 'reports' | 'settings';

function Dashboard() {
  const [currentView, setCurrentView] = useState<ViewState>('pipelines'); // Pipeline as primary view

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'pipelines', label: 'Pipelines', icon: LayoutDashboard },
    { id: 'policies', label: 'Policies', icon: Briefcase },
    { id: 'claims', label: 'Claims', icon: ShieldAlert },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

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
        <GlobalSearch onNavigate={(view) => setCurrentView(view as ViewState)} />
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <span className="hidden sm:block">Admin User</span>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">A</div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[200px] border-r border-slate-200 bg-white flex flex-col py-4 shrink-0">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors",
                currentView === item.id
                  ? "bg-slate-100/80 text-blue-600 font-semibold border-r-4 border-blue-600"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}

          <div className="mt-8 px-5 w-full flex flex-col pt-4 border-t border-slate-100">
             <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">System</div>
             <button
               onClick={() => setCurrentView('aftersales')}
               className={cn(
                 "flex items-center gap-3 py-2 text-sm transition-colors",
                 currentView === 'aftersales' ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-slate-800"
               )}
             >
               <ShieldAlert className="w-4 h-4 shrink-0" />
               Aftersales
             </button>
             <button
               onClick={() => setCurrentView('architecture')}
               className={cn(
                 "flex items-center gap-3 py-2 text-sm transition-colors",
                 currentView === 'architecture' ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-slate-800"
               )}
             >
               <Database className="w-4 h-4 shrink-0" />
               System Docs
             </button>
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div className="flex-1 overflow-auto">
            {currentView === 'dashboard' && <DashboardOverview />}
            {currentView === 'clients' && <ClientsView />}
            {currentView === 'pipelines' && <PipelineView />}
            {currentView === 'policies' && <PoliciesView />}
            {currentView === 'claims' && <ClaimsView />}
            {currentView === 'aftersales' && <AftersalesView />}
            {currentView === 'architecture' && <ArchitectureView />}
            {currentView === 'reports' && (
              <div className="p-8">
                 <h1 className="text-xl font-bold text-slate-900 mb-1">Reports</h1>
                 <p className="text-[13px] text-slate-500">Coming soon.</p>
              </div>
            )}
            {currentView === 'settings' && <SettingsView />}
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
      <Dashboard />
    </DataProvider>
  );
}