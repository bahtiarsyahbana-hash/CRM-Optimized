/**
 * App-wide navigation contract.
 *
 * There is no router — navigation is React state held in App.tsx. This module
 * exists so components deep in the tree (dashboard widgets, global search) can
 * request navigation without importing App and creating a cycle.
 */

export type ViewId =
  // Built
  | 'dashboard'
  | 'submission'
  | 'pipelines'
  | 'policies'
  | 'claims'
  | 'aftersales'
  | 'clients'
  | 'settings'
  | 'architecture'
  | 'master-policies'
  // Stubbed — in the nav, no implementation yet
  | 'invoices'
  | 'cancellations'
  | 'insurers'
  | 'products'
  | 'benefits'
  | 'users-roles';

/** Track tabs on the Submissions view. */
export type SubmissionTrackParam = 'All' | 'New Business' | 'Renewal';

/**
 * A navigation request. `params` carries optional filter hints that the
 * destination view seeds its own local state from — this is how a dashboard
 * widget lands on a *filtered* page instead of dead-ending on an unfiltered one.
 *
 * Params are hints, not state: the destination owns its filters and the user
 * is free to change them on arrival.
 */
export interface NavTarget {
  view: ViewId;
  params?: {
    /** SubmissionView — which track tab to open on. */
    track?: SubmissionTrackParam;
    /** PoliciesView — seed the search box with an insurer name. */
    insurer?: string;
  };
}

export type Navigate = (target: NavTarget) => void;

/**
 * Views that were merged or renamed, mapped to where they live now.
 *
 * There is no router, so these are not URL redirects — they are id
 * redirects, applied when navigation is requested with a retired id (a stale
 * dashboard drill-through, a persisted view preference, a deep link once URLs
 * exist). Open Cover and Certificate became two *types* of one Master Policy
 * page rather than two pages.
 */
export const RETIRED_VIEW_IDS: Record<string, ViewId> = {
  'open-covers': 'master-policies',
  'certificates': 'master-policies',
};

/** Resolve a possibly-retired view id to the view that serves it today. */
export const resolveViewId = (id: string): ViewId =>
  (RETIRED_VIEW_IDS[id] ?? id) as ViewId;
