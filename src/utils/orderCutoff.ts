/**
 * Order cutoff for a delivery date, as the admin sees and sets it.
 *
 * Standard rule (the customer site): ordering for a delivery date closes at 5:00 PM Pacific on the day before for
 * flat items and at 1:00 PM Pacific on the day before for day-wise (Food Menu) items. An admin can set a custom cutoff
 * for one date and one kind of item (an absolute moment, stored as `flatCutoffAt` / `dayWiseCutoffAt`) to close
 * earlier or to extend / reopen it. The older single `cutoffAt` of a date applies to both kinds until the date is
 * saved again. Keep the standard rules in step with livesite/src/lib/server/orderCutoff.ts.
 *
 * Pure functions. Dates are 'YYYY-MM-DD' strings (Pacific), moments are `Date` objects.
 */

export const CUTOFF_TIMEZONE = 'America/Los_Angeles';
export const DEFAULT_CUTOFF_HOUR = 13;

/** The two kinds of items that have their own cutoff. */
export type ItemKind = 'flat' | 'day-wise';
export const ITEM_KINDS: readonly ItemKind[] = ['flat', 'day-wise'];
/** Standard cutoff per kind: this hour (24h clock, Pacific) on the day before the delivery date. */
export const DEFAULT_CUTOFF_HOUR_BY_KIND: Record<ItemKind, number> = { flat: 17, 'day-wise': 13 };
/** What the admin calls each kind. */
export const ITEM_KIND_LABEL: Record<ItemKind, string> = { flat: 'Flat items', 'day-wise': 'Day-wise items (Food Menu)' };

/** The custom cutoff fields of a date. */
export interface CutoffFields {
  /** Older single cutoff: applies to both kinds when the kind's own field is not set. */
  cutoffAt?: unknown;
  flatCutoffAt?: unknown;
  dayWiseCutoffAt?: unknown;
}

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

/** The standard cutoff for a delivery date: 5:00 PM (flat) or 1:00 PM (day-wise) Pacific on the day before. */
export function defaultCutoffInstant(deliveryDate: string, kind: ItemKind = 'day-wise'): Date {
  return zonedWallTimeToInstant(previousDay(deliveryDate), DEFAULT_CUTOFF_HOUR_BY_KIND[kind]);
}

/** A stored custom cutoff as a valid `Date`, or null (missing, empty or unreadable means "standard"). */
export function parseCutoff(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

/** The custom cutoff in effect for one kind of a date: the kind's own field, else the older single one, else none. */
export function overrideForKind(date: CutoffFields | null | undefined, kind: ItemKind): unknown {
  if (!date) return undefined;
  const own = kind === 'flat' ? date.flatCutoffAt : date.dayWiseCutoffAt;
  return parseCutoff(own) ? own : date.cutoffAt;
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

export function cutoffStatus(deliveryDate: string, cutoffAt: unknown, now: Date = new Date(), kind: ItemKind = 'day-wise'): CutoffStatus {
  const custom = parseCutoff(cutoffAt);
  const closesAt = custom ?? defaultCutoffInstant(deliveryDate, kind);
  return { closesAt, overridden: custom !== null, isOpen: now.getTime() < closesAt.getTime() };
}

/** 'Tue, Oct 6 at 1:00 PM' in Pacific time. */
export function formatCutoff(instant: Date): string {
  const day = instant.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: CUTOFF_TIMEZONE });
  const time = instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CUTOFF_TIMEZONE });
  return `${day} at ${time}`;
}

/** The line shown to the admin: when ordering closes (or closed) and whether that is the standard or a custom time. */
export function describeCutoff(deliveryDate: string, cutoffAt: unknown, now: Date = new Date(), kind: ItemKind = 'day-wise'): string {
  const status = cutoffStatus(deliveryDate, cutoffAt, now, kind);
  const which = status.overridden ? 'custom' : 'standard';
  return `${status.isOpen ? 'Closes' : 'Closed'} ${formatCutoff(status.closesAt)} Pacific (${which})`;
}

/**
 * A cutoff `hours` later than the current closing time, but counted from now if that time has already
 * passed (so "extend by 2 hours" on a closed day reopens it for 2 hours from now).
 */
export function extendCutoff(deliveryDate: string, cutoffAt: unknown, hours: number, now: Date = new Date(), kind: ItemKind = 'day-wise'): Date {
  const current = cutoffStatus(deliveryDate, cutoffAt, now, kind).closesAt;
  const base = Math.max(current.getTime(), now.getTime());
  return new Date(base + hours * 3600 * 1000);
}
