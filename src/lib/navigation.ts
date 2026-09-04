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
  // Stubbed — in the nav, no implementation yet
  | 'open-covers'
  | 'certificates'
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
