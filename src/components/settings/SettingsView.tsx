import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsView = () => {
  const { clearDatabase } = useData();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClearDatabase = () => {
    clearDatabase();
    toast.success('Database has been completely reset.');
    setShowConfirm(false);
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-50 relative">
      <div className="mb-8 shrink-0">
        <h1 className="text-xl font-bold text-slate-900 mb-1">System Settings</h1>
        <p className="text-[13px] text-slate-500">Manage your workspace configuration and data.</p>
      </div>

      <div className="flex-1 overflow-auto max-w-4xl">
        
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-8 group">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">General Information</h2>
              <p className="text-[13px] text-slate-500 mt-1 mb-4">
                You are running RiskFlow Enterprise v1.2.0.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-red-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-red-900">Danger Zone</h2>
              <p className="text-[13px] text-red-700/80 mt-1 mb-4">
                Actions here can cause permanent data loss. Please be careful.
              </p>

              <div className="bg-red-50/50 border border-red-100 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-[13px] text-slate-900">Factory Reset Database</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    This will permanently delete all clients, deals, claims, and history logs from your local storage.
                  </p>
                </div>
                
                {!showConfirm ? (
                  <button 
                    onClick={() => setShowConfirm(true)}
                    className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-[13px] rounded-md transition-colors whitespace-nowrap shadow-sm group-hover:border-red-300"
                  >
                    Reset Database
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-[13px] rounded-md transition-colors whitespace-nowrap shadow-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleClearDatabase}
                      className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-semibold text-[13px] rounded-md transition-colors whitespace-nowrap shadow-sm flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Yes, Delete Everything
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
