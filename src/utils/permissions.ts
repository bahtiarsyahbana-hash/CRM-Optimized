import {
  AppUser, PermissionLevel, PermissionModule, PERMISSION_MODULES,
  ROLE_PERMISSIONS, UserRole,
} from '../types';
import { ViewId } from '../lib/navigation';

/**
 * Role-based UI shaping. NOT SECURITY.
 *
 * There is no authentication and no server: anyone can edit localStorage and
 * grant themselves anything. These helpers decide what a person *sees*, so they
 * aren't wading through screens they never use. They protect nothing.
 *
 * TODO(supabase): when auth lands, every one of these reads needs a matching
 * server-side check. A client-side `can()` returning false must never be the
 * only thing standing between a user and a write.
 */

/* -------------------------------------------------------------------------- */
/*                              Permission reads                              */
/* -------------------------------------------------------------------------- */

/** The level a user holds on a module. No user at all reads as None. */
export function levelFor(user: AppUser | null, module: PermissionModule): PermissionLevel {
  if (!user || !user.active) return 'None';
  return ROLE_PERMISSIONS[user.role][module];
}

/** Can the user see this module at all? */
export const canView = (user: AppUser | null, module: PermissionModule): boolean =>
  levelFor(user, module) !== 'None';

/** Can the user change things in this module? */
export const canEdit = (user: AppUser | null, module: PermissionModule): boolean =>
  levelFor(user, module) === 'Edit';

/**
 * Sidebar entries the user may see.
 *
 * A module set to None is hidden from the sidebar entirely — not shown and then
 * refused on click. Views with no module behind them (System Docs) stay visible;
 * only modules that exist in PERMISSION_MODULES are gated.
 */
export function visibleViews(user: AppUser | null): Set<ViewId> {
  const visible = new Set<ViewId>();
  for (const m of PERMISSION_MODULES) {
    if (m.navView && levelFor(user, m.id) !== 'None') visible.add(m.navView);
  }
  return visible;
}

/** The module gating a sidebar entry, when one does. */
export function moduleForView(view: ViewId): PermissionModule | undefined {
  return PERMISSION_MODULES.find(m => m.navView === view)?.id;
}

/* -------------------------------------------------------------------------- */
/*                          Hard rule: last Administrator                     */
/* -------------------------------------------------------------------------- */

/**
 * An Administrator who is the only active one left.
 *
 * Losing the last Administrator would leave nobody able to manage users or
 * master data, and with no auth there is no back door to recover through — the
 * only route back would be editing localStorage by hand.
 */
export function isLastActiveAdministrator(users: AppUser[], userId: string): boolean {
  const user = users.find(u => u.id === userId);
  if (!user || user.role !== 'Administrator' || !user.active) return false;
  return users.filter(u => u.role === 'Administrator' && u.active).length === 1;
}

export interface GuardResult {
  allowed: boolean;
  /** Why not, phrased for the user. Undefined when allowed. */
  reason?: string;
}

const LAST_ADMIN_REASON =
  'This is the last active Administrator. Promote another user to Administrator first — '
  + 'otherwise nobody can manage users or master data, and there is no way back without '
  + 'editing browser storage by hand.';

/**
 * The last active Administrator cannot be deleted, deactivated, or demoted.
 * All three routes funnel through here so none can be missed.
 *
 * TODO(supabase): mirror as a server-side constraint when auth lands.
 */
export function canDeleteUser(users: AppUser[], userId: string): GuardResult {
  return isLastActiveAdministrator(users, userId)
    ? { allowed: false, reason: LAST_ADMIN_REASON }
    : { allowed: true };
}

export function canDeactivateUser(users: AppUser[], userId: string): GuardResult {
  return isLastActiveAdministrator(users, userId)
    ? { allowed: false, reason: LAST_ADMIN_REASON }
    : { allowed: true };
}

/** Demotion is any role change away from Administrator. */
export function canChangeUserRole(
  users: AppUser[],
  userId: string,
  nextRole: UserRole,
): GuardResult {
  if (nextRole === 'Administrator') return { allowed: true };
  return isLastActiveAdministrator(users, userId)
    ? { allowed: false, reason: LAST_ADMIN_REASON }
    : { allowed: true };
}

/**
 * Single gate for saving an edited user — covers demotion and deactivation
 * together, since one form submit can do both at once.
 */
export function canSaveUserEdit(
  users: AppUser[],
  userId: string,
  next: { role: UserRole; active: boolean },
): GuardResult {
  if (!isLastActiveAdministrator(users, userId)) return { allowed: true };
  if (next.role !== 'Administrator') return { allowed: false, reason: LAST_ADMIN_REASON };
  if (!next.active) return { allowed: false, reason: LAST_ADMIN_REASON };
  return { allowed: true };
}
