import { DealType } from '../types';

/**
 * Deals split into two acquisition tracks. This is the app's answer to
 * "is this a renewal?" — there is no separate `is_renewal` flag, the
 * distinction is carried entirely by `Deal.dealType`.
 *
 * The mapping mirrors the split PipelineView has always used for its
 * New Business / Renewal tabs, so the two views agree on what counts as
 * a renewal.
 */
export type DealTrack = 'New Business' | 'Renewal';

/** Deal types that belong to the renewal track. Everything else is new business. */
const RENEWAL_DEAL_TYPES: DealType[] = ['Renewal', 'Existing Client Update'];

export const trackOf = (dealType: DealType): DealTrack =>
  RENEWAL_DEAL_TYPES.includes(dealType) ? 'Renewal' : 'New Business';

/** True when the deal sits on the renewal track. */
export const isRenewal = (dealType: DealType): boolean => trackOf(dealType) === 'Renewal';
