/**
 * Order cutoff for a delivery date, as the admin sees and sets it.
 *
 * Standard rule (the customer site): ordering for a delivery date closes at 1:00 PM Pacific on the day
 * before. An admin can set a custom cutoff for one date (an absolute moment, stored as `cutoffAt`) to close
 * earlier or to extend / reopen it. Keep the standard rule in step with livesite/src/lib/server/orderCutoff.ts.
 *
 * Pure functions. Dates are 'YYYY-MM-DD' strings (Pacific), moments are `Date` objects.
 */

export const CUTOFF_TIMEZONE = 'America/Los_Angeles';
export const DEFAULT_CUTOFF_HOUR = 13;

const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const INPUT_PATTERN = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

/** How many ms the zone is ahead of UTC at this moment (negative for Pacific). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The moment at which the wall clock in `timeZone` reads this date and time (daylight saving aware). */
export function zonedWallTimeToInstant(dateString: string, hour: number, minute = 0, timeZone = CUTOFF_TIMEZONE): Date {
  const match = DATE_PATTERN.exec(dateString);
  if (!match) throw new Error(`Invalid date: ${dateString}`);
  const guess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute);
  let instant = guess - zoneOffsetMs(new Date(guess), timeZone);
  instant = guess - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

export function previousDay(dateString: string): string {
  const match = DATE_PATTERN.exec(dateString);
  if (!match) throw new Error(`Invalid date: ${dateString}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 1)).toISOString().slice(0, 10);
}

/** The standard cutoff for a delivery date: 1:00 PM Pacific on the day before. */
export function defaultCutoffInstant(deliveryDate: string): Date {
  return zonedWallTimeToInstant(previousDay(deliveryDate), DEFAULT_CUTOFF_HOUR);
}

/** A stored custom cutoff as a valid `Date`, or null (missing, empty or unreadable means "standard"). */
export function parseCutoff(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

/** A moment as the value of an <input type="datetime-local">, read as Pacific wall-clock time. */
export function instantToInputValue(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CUTOFF_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** The moment for the value of an <input type="datetime-local">, read as Pacific wall-clock time (null if not valid). */
export function inputValueToInstant(value: string): Date | null {
  const match = INPUT_PATTERN.exec(value.trim());
  if (!match || !DATE_PATTERN.test(match[1])) return null;
  return zonedWallTimeToInstant(match[1], Number(match[2]), Number(match[3]));
}

/** Earliest and latest cutoff that makes sense for a delivery date: a week before it, up to the end of that day. */
export function allowedCutoffRange(deliveryDate: string): { min: Date; max: Date } {
  let weekBefore = deliveryDate;
  for (let i = 0; i < 7; i++) weekBefore = previousDay(weekBefore);
  const nextDay = new Date(Date.UTC(Number(deliveryDate.slice(0, 4)), Number(deliveryDate.slice(5, 7)) - 1, Number(deliveryDate.slice(8, 10)) + 1))
    .toISOString()
    .slice(0, 10);
  return { min: zonedWallTimeToInstant(weekBefore, 0), max: new Date(zonedWallTimeToInstant(nextDay, 0).getTime() - 60 * 1000) };
}

/** Null when `instant` is an acceptable custom cutoff for the date, otherwise the reason it is not. */
export function validateCutoff(deliveryDate: string, instant: Date): string | null {
  if (!DATE_PATTERN.test(deliveryDate)) return 'Invalid delivery date';
  if (!Number.isFinite(instant.getTime())) return 'Invalid cutoff time';
  const { min, max } = allowedCutoffRange(deliveryDate);
  if (instant.getTime() < min.getTime()) return 'The cutoff cannot be more than a week before the delivery date';
  if (instant.getTime() > max.getTime()) return 'The cutoff cannot be after the delivery date';
  return null;
}

export interface CutoffStatus {
  closesAt: Date;
  overridden: boolean;
  /** Ordering is still open for this date right now (the date itself is not in the past either). */
  isOpen: boolean;
}

export function cutoffStatus(deliveryDate: string, cutoffAt: unknown, now: Date = new Date()): CutoffStatus {
  const custom = parseCutoff(cutoffAt);
  const closesAt = custom ?? defaultCutoffInstant(deliveryDate);
  return { closesAt, overridden: custom !== null, isOpen: now.getTime() < closesAt.getTime() };
}

/** 'Tue, Oct 6 at 1:00 PM' in Pacific time. */
export function formatCutoff(instant: Date): string {
  const day = instant.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: CUTOFF_TIMEZONE });
  const time = instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CUTOFF_TIMEZONE });
  return `${day} at ${time}`;
}

/** The line shown to the admin: when ordering closes (or closed) and whether that is the standard or a custom time. */
export function describeCutoff(deliveryDate: string, cutoffAt: unknown, now: Date = new Date()): string {
  const status = cutoffStatus(deliveryDate, cutoffAt, now);
  const kind = status.overridden ? 'custom' : 'standard';
  return `${status.isOpen ? 'Closes' : 'Closed'} ${formatCutoff(status.closesAt)} Pacific (${kind})`;
}

/**
 * A cutoff `hours` later than the current closing time, but counted from now if that time has already
 * passed (so "extend by 2 hours" on a closed day reopens it for 2 hours from now).
 */
export function extendCutoff(deliveryDate: string, cutoffAt: unknown, hours: number, now: Date = new Date()): Date {
  const current = cutoffStatus(deliveryDate, cutoffAt, now).closesAt;
  const base = Math.max(current.getTime(), now.getTime());
  return new Date(base + hours * 3600 * 1000);
}
