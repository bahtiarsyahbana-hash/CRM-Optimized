import React from 'react';
import { Construction } from 'lucide-react';

/**
 * Placeholder for a page that exists in the navigation but has no
 * implementation yet. Renders without error and states plainly that it is
 * unbuilt, so nothing looks broken or half-finished.
 *
 * `purpose` is the one-line brief for what the page is meant to do — it keeps
 * the intent attached to the page rather than living only in a spec document.
 */
export const StubView: React.FC<{
  title: string;
  purpose: string;
  /** Optional note on where the underlying data lives today, if anywhere. */
  today?: string;
}> = ({ title, purpose, today }) => (
  <div className="h-full flex flex-col p-8 bg-slate-50">
    <div className="mb-6 shrink-0">
      <h1 className="text-xl font-bold text-slate-900 mb-1">{title}</h1>
      <p className="text-[13px] text-slate-500">{purpose}</p>
    </div>

    <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6 py-16">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Construction className="w-6 h-6" />
        </div>
        <p className="text-[15px] font-semibold text-slate-900 mb-1">Coming soon</p>
        <p className="text-[13px] text-slate-500">
          This page is in the navigation so the structure is settled, but it has not been built yet.
        </p>
        {today && (
          <p className="text-[12px] text-slate-500 mt-4 pt-4 border-t border-slate-100">
            {today}
          </p>
        )}
      </div>
    </div>
  </div>
);
