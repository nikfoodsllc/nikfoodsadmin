/**
 * Filters and sorting for the All Users list. "Text messages" follows the same meaning as smsConsentView:
 * agreed = ticked a box (or signed up on the public page for their phone number) and has not stopped,
 * stopped = agreed once and then withdrew, never = nothing on record.
 */
export type TextFilter = 'all' | 'agreed' | 'stopped' | 'never';
export type UserSort = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export const TEXT_FILTERS: TextFilter[] = ['all', 'agreed', 'stopped', 'never'];
export const USER_SORTS: UserSort[] = ['newest', 'oldest', 'name_asc', 'name_desc'];

export function parseTextFilter(value: unknown): TextFilter {
  return TEXT_FILTERS.includes(value as TextFilter) ? (value as TextFilter) : 'all';
}

export function parseUserSort(value: unknown): UserSort {
  return USER_SORTS.includes(value as UserSort) ? (value as UserSort) : 'newest';
}

/** Mongo sort for the list (name sorts ignore case via collation in the route; _id keeps ties stable) */
export function userSortSpec(sort: UserSort): Record<string, 1 | -1> {
  switch (sort) {
    case 'oldest': return { createdAt: 1, _id: 1 };
    case 'name_asc': return { name: 1, _id: 1 };
    case 'name_desc': return { name: -1, _id: 1 };
    default: return { createdAt: -1, _id: -1 };
  }
}

/** Phone numbers on the public Text Updates page, split by what they chose (10 digits each) */
export interface SubscriberPhones {
  agreed: string[];
  stopped: string[];
}

/** Mongo condition on the users collection for a text-message choice, or null for "all" */
export function textFilterClause(filter: TextFilter, subs: SubscriberPhones): Record<string, unknown> | null {
  if (filter === 'all') return null;
  const agreed = { $or: [{ 'smsConsent.optedIn': true }, ...(subs.agreed.length ? [{ phone: { $in: subs.agreed } }] : [])] };
  if (filter === 'agreed') return agreed;
  const notAgreed = { $nor: agreed.$or };
  const everAgreed = {
    $or: [
      { 'smsConsent.optedInAt': { $exists: true, $ne: null } },
      { 'smsConsent.optedOutAt': { $exists: true, $ne: null } },
      ...(subs.stopped.length ? [{ phone: { $in: subs.stopped } }] : []),
    ],
  };
  if (filter === 'stopped') return { $and: [notAgreed, everAgreed] };
  return { $and: [notAgreed, { $nor: everAgreed.$or }] };
}
