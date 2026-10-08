/**
 * "Lock" on a day-wise category row = repeat this item every week. When the next week's days are switched on, the item
 * is put on the same weekdays it was on in the most recent week. Pure helpers (the database part is in lib/server/lockedMenu.ts).
 */

const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isDateKey(day: unknown): day is string {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false;
  const d = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** 0 = Sunday ... 6 = Saturday, for a 'YYYY-MM-DD' calendar day. */
export function weekdayIndex(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function addDays(day: string, amount: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export interface AssignedDay {
  day: string;
  sequence: number;
}

/** First day (Saturday) of the kitchen week a day belongs to. Kitchen weeks run Saturday to Friday. */
export function kitchenWeekStart(day: string): string {
  return addDays(day, -((weekdayIndex(day) + 1) % 7));
}

/**
 * Should a locked item be on `target`? Look at the most recent kitchen week (Saturday to Friday) BEFORE the week of
 * `target` in which the item was on any day: the weekdays it had there are its weekdays. If `target` falls on one of
 * them, the item goes on `target`, in the position it had the last time it was on that weekday. Otherwise null.
 * Days of the target's own week are ignored, so adding Thursday first never makes Friday drop out.
 */
export function lockedItemPlacement(target: string, assigned: AssignedDay[]): { sequence: number } | null {
  if (!isDateKey(target)) return null;
  const dated = assigned.filter((a) => isDateKey(a.day));
  if (dated.some((a) => a.day === target)) return null; // already there
  const targetWeek = kitchenWeekStart(target);
  const before = dated.filter((a) => a.day < targetWeek);
  if (before.length === 0) return null;
  const last = before.reduce((m, a) => (a.day > m ? a.day : m), before[0].day);
  const weekStart = kitchenWeekStart(last);
  const weekEnd = addDays(weekStart, 6);
  const weekdays = new Set(before.filter((a) => a.day >= weekStart && a.day <= weekEnd).map((a) => weekdayIndex(a.day)));
  const wanted = weekdayIndex(target);
  if (!weekdays.has(wanted)) return null;
  const sameWeekday = before.filter((a) => weekdayIndex(a.day) === wanted).sort((a, b) => (a.day < b.day ? 1 : -1));
  return { sequence: sameWeekday[0]?.sequence ?? 0 };
}
