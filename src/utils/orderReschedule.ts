/**
 * Moving an order's delivery dates (admin): what the screens show and which dates may be picked.
 * The live site does the moving (see livesite/src/lib/orderReschedule.ts: it keeps these rules, keep the two in step).
 * Dates are 'YYYY-MM-DD' strings.
 */
export const RESCHEDULABLE_STATUSES = ['confirmed', 'preparing', 'ready'] as const;
export const MAX_DAYS_AHEAD = 120;

export interface RescheduleChangeLike {
  index: number;
  fromDay?: string;
  toDay?: string;
  fromMenuDate: string;
  fromDeliveryDate: string;
  toDate: string;
}

export interface OrderRescheduleLike {
  status?: string | null;
  paymentStatus?: string | null;
  items?: Array<{ deliveryDate?: unknown; actualDeliveryDate?: unknown; day?: string | null }> | null;
  reschedules?: Array<{ at?: unknown; by?: { name?: string } | null; changes?: RescheduleChangeLike[] | null }> | null;
  rescheduleEmail?: { sentAt?: unknown; by?: { name?: string } | null; count?: number | null } | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

export function dateText(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const text = typeof value === 'string' ? value.trim() : '';
  return DATE_PATTERN.test(text) ? text.slice(0, 10) : '';
}

function timeOf(value: unknown): number {
  const t = value instanceof Date ? value.getTime() : typeof value === 'string' ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Today's date in Pacific time. */
export function pacificToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA gives YYYY-MM-DD
}

export function addDays(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)).toISOString().slice(0, 10);
}

/** Why this order cannot be moved, or null when it can (the same rule the live site applies). */
export function whyNotReschedulable(order: OrderRescheduleLike): string | null {
  if (order.paymentStatus !== 'paid') return 'Only paid orders can be moved to another date.';
  if (!order.status || !(RESCHEDULABLE_STATUSES as readonly string[]).includes(order.status)) {
    return order.status === 'cancelled' ? 'This order is cancelled.' : 'This order is already out for delivery or delivered.';
  }
  if (!order.items || order.items.length === 0) return 'This order has no delivery days.';
  return null;
}

/** The earliest and latest date that may be picked (today to 120 days ahead, Pacific). */
export function pickableRange(now: Date = new Date()): { min: string; max: string } {
  const today = pacificToday(now);
  return { min: today, max: addDays(today, MAX_DAYS_AHEAD) };
}

export interface RescheduleView {
  rescheduled: boolean;
  /** How many times an admin moved a delivery */
  moves: number;
  lastAt: Date | null;
  lastBy: string;
  /** Per day line that is not on its original date now: original delivery date to the current one */
  lines: Array<{ index: number; from: string; to: string }>;
  /** none = never moved or back on the original dates; pending = the customer has not been told; sent = told after the last move */
  email: 'none' | 'pending' | 'sent';
  emailSentAt: Date | null;
  emailCount: number;
  /** One line for a tooltip */
  summary: string;
}

const NOT: RescheduleView = { rescheduled: false, moves: 0, lastAt: null, lastBy: '', lines: [], email: 'none', emailSentAt: null, emailCount: 0, summary: '' };

function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** What an order's moved-date history says: is it rescheduled, from what to what, and has the customer been told. */
export function rescheduleView(order: OrderRescheduleLike | null | undefined): RescheduleView {
  const history = order?.reschedules ?? [];
  if (!order || history.length === 0) return NOT;

  const firstFrom = new Map<number, string>();
  for (const record of history) for (const change of record.changes ?? []) if (!firstFrom.has(change.index)) firstFrom.set(change.index, change.fromDeliveryDate);

  const lines: RescheduleView['lines'] = [];
  for (const [index, from] of [...firstFrom.entries()].sort((a, b) => a[0] - b[0])) {
    const line = order.items?.[index];
    const to = line ? dateText(line.actualDeliveryDate) || dateText(line.deliveryDate) : '';
    if (to && from && to !== from) lines.push({ index, from, to });
  }

  const last = history[history.length - 1];
  const lastAt = timeOf(last.at) ? new Date(timeOf(last.at)) : null;
  const sentAtMs = timeOf(order.rescheduleEmail?.sentAt);
  const email: RescheduleView['email'] = lines.length === 0 ? 'none' : sentAtMs && sentAtMs >= timeOf(last.at) ? 'sent' : 'pending';
  const shown = lines.length > 0 ? lines.map((l) => `${shortDate(l.from)} → ${shortDate(l.to)}`).join(', ') : 'Back on the original dates';

  return {
    rescheduled: true,
    moves: history.length,
    lastAt,
    lastBy: last.by?.name ?? '',
    lines,
    email,
    emailSentAt: sentAtMs ? new Date(sentAtMs) : null,
    emailCount: order.rescheduleEmail?.count ?? (sentAtMs ? 1 : 0),
    summary: shown,
  };
}

/** Orders filter: only rescheduled orders ('yes'), only orders never moved ('no'). Anything else = no filter. */
export function rescheduledFilterFor(value: string | null | undefined): Record<string, unknown> | null {
  if (value === 'yes') return { 'reschedules.0': { $exists: true } };
  if (value === 'no') return { 'reschedules.0': { $exists: false } };
  return null;
}
