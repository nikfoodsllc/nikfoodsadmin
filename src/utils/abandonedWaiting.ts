/**
 * Why a checkout without a reminder email has none (yet). Mirrors the rules of the automatic reminder on the customer site
 * (livesite/src/lib/server/cartReminders.ts): about 30 minutes after they leave, never later than 24 hours, one per person
 * every 2 days. Days that have closed are not known here, so a cart that is simply "waiting" may also be held back by that.
 */
export const REMINDER_AFTER_MINUTES = 30;
export const REMINDER_MAX_AGE_HOURS = 24;
export const REMINDER_GAP_DAYS = 2;

export type WaitingCode = 'soon' | 'gap' | 'too_old' | 'no_email' | 'no_items' | 'waiting';

export interface WaitingNote {
  code: WaitingCode;
  text: string;
}

interface WaitingRow {
  userId: string;
  email?: string;
  lastActivityAt: string;
  noItemDetails: boolean;
}

/** A reminder (or one being sent) to this person within the gap: when it was, keyed by person and by email. */
export interface RecentReminders {
  byUser: Map<string, number[]>;
  byEmail: Map<string, number[]>;
}

const dayText = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });

export function waitingNote(row: WaitingRow, recent: RecentReminders, now: Date = new Date()): WaitingNote {
  const email = (row.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) return { code: 'no_email', text: 'No reminder: no email saved' };
  if (row.noItemDetails) return { code: 'no_items', text: 'No reminder: no saved items to show' };
  const last = new Date(row.lastActivityAt).getTime();
  const age = now.getTime() - last;
  const tooOld = age > REMINDER_MAX_AGE_HOURS * 3_600_000;
  // the 2-day rule is judged at the end of the reminder window: for a checkout past it, a reminder that kept it blocked
  // for the whole window is the reason there was none (not just "too old")
  const end = tooOld ? last + REMINDER_MAX_AGE_HOURS * 3_600_000 : now.getTime();
  const from = end - REMINDER_GAP_DAYS * 24 * 3_600_000;
  const times = [...(recent.byUser.get(row.userId) ?? []), ...(recent.byEmail.get(email) ?? [])].filter((t) => t > from && t <= end);
  const earlier = times.length > 0 ? Math.max(...times) : 0;
  if (earlier > 0) return { code: 'gap', text: `No reminder: already emailed ${dayText(earlier)} (one every ${REMINDER_GAP_DAYS} days)` };
  if (tooOld) return { code: 'too_old', text: `No reminder: left more than ${REMINDER_MAX_AGE_HOURS} hours ago` };
  if (age < REMINDER_AFTER_MINUTES * 60_000) return { code: 'soon', text: `Reminder goes out ${REMINDER_AFTER_MINUTES} minutes after they leave` };
  return { code: 'waiting', text: 'Waiting for the reminder email' };
}

/** Builds the lookup from the reminders sent (or started) within the gap; a failed send does not count (it is retried). */
export function recentReminders(
  drafts: Array<{ userId?: string; customer?: { email?: string }; reminderEmail?: { claimedAt?: Date | string; status?: string } }>
): RecentReminders {
  const byUser = new Map<string, number[]>();
  const byEmail = new Map<string, number[]>();
  const add = (map: Map<string, number[]>, key: string, at: number) => map.set(key, [...(map.get(key) ?? []), at]);
  for (const d of drafts) {
    const r = d.reminderEmail;
    if (!r?.claimedAt || r.status === 'failed') continue;
    const at = new Date(r.claimedAt).getTime();
    if (!Number.isFinite(at)) continue;
    if (d.userId) add(byUser, d.userId, at);
    const email = (d.customer?.email ?? '').trim().toLowerCase();
    if (email) add(byEmail, email, at);
  }
  return { byUser, byEmail };
}
