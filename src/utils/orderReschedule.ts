/**
 * Moving an order's delivery dates (admin): what the screens show and which dates may be picked.
 * The live site does the moving (see livesite/src/lib/orderReschedule.ts: it keeps these rules, keep the two in step).
 * Only the delivery date (actualDeliveryDate) moves; the kitchen day (deliveryDate) stays.
 * Dates are 'YYYY-MM-DD' strings.
 */
export const RESCHEDULABLE_STATUSES = ['confirmed', 'preparing', 'ready'] as const;
export const MAX_DAYS_AHEAD = 120;

export interface OrderRescheduleLike {
  status?: string | null;
  paymentStatus?: string | null;
  items?: Array<{
    deliveryDate?: unknown;
    actualDeliveryDate?: unknown;
    day?: string | null;
    items?: Array<{ quantity?: number | null; originalDeliveryDate?: string | null; food?: { name?: string | null } | null }> | null;
  }> | null;
  reschedules?: Array<{ at?: unknown; by?: { name?: string } | null }> | null;
  rescheduleEmail?: {
    sentAt?: unknown;
    by?: { name?: string } | null;
    count?: number | null;
    /** What the email provider reported (livesite webhook): delivered, opened, bounced ... */
    delivery?: { status?: string | null; deliveredAt?: unknown; bouncedAt?: unknown; firstOpenedAt?: unknown; openCount?: number | null } | null;
  } | null;
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

export interface MovedGroup {
  /** Where the items started and where they are now (delivery dates) */
  from: string;
  to: string;
  /** What moved, e.g. '2 x Dosa Batter' */
  items: string[];
}

/** What happened to the moved-date email after it was sent (an open is only a hint: it comes from a tracking pixel). */
export type EmailEventState = 'sent' | 'delivered' | 'opened' | 'delayed' | 'bounced' | 'complained';

export interface EmailEventView {
  state: EmailEventState;
  /** When that happened (the send time for 'sent') */
  at: Date | null;
  opens: number;
}

export function emailEventOf(email: OrderRescheduleLike['rescheduleEmail']): EmailEventView | null {
  const sentAt = timeOf(email?.sentAt);
  if (!email || !sentAt) return null;
  const d = email.delivery;
  const at = (v: unknown) => (timeOf(v) ? new Date(timeOf(v)) : null);
  const opens = Math.max(0, Number(d?.openCount ?? 0) || 0);
  if (d?.status === 'bounced') return { state: 'bounced', at: at(d.bouncedAt), opens };
  if (d?.status === 'complained') return { state: 'complained', at: null, opens };
  if (timeOf(d?.firstOpenedAt)) return { state: 'opened', at: at(d?.firstOpenedAt), opens: opens || 1 };
  if (d?.status === 'delivered') return { state: 'delivered', at: at(d.deliveredAt), opens };
  if (d?.status === 'delayed') return { state: 'delayed', at: null, opens };
  return { state: 'sent', at: new Date(sentAt), opens };
}

export interface RescheduleView {
  rescheduled: boolean;
  /** How many times an admin moved items */
  moves: number;
  lastAt: Date | null;
  lastBy: string;
  /** Items that are not on the delivery date they started with, grouped by from and to */
  groups: MovedGroup[];
  /** none = never moved or everything back on its original date; pending = the customer has not been told; sent = told after the last move */
  email: 'none' | 'pending' | 'sent';
  emailSentAt: Date | null;
  emailCount: number;
  /** What the provider reported about that email (null until one was sent) */
  emailEvent: EmailEventView | null;
  /** One line for a tooltip */
  summary: string;
}

const NOT: RescheduleView = { rescheduled: false, moves: 0, lastAt: null, lastBy: '', groups: [], email: 'none', emailSentAt: null, emailCount: 0, emailEvent: null, summary: '' };

function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** What an order's moved items say: is it rescheduled, from what to what, and has the customer been told. */
export function rescheduleView(order: OrderRescheduleLike | null | undefined): RescheduleView {
  const history = order?.reschedules ?? [];
  if (!order || history.length === 0) return NOT;

  const byKey = new Map<string, MovedGroup>();
  for (const line of order.items ?? []) {
    const to = dateText(line.actualDeliveryDate) || dateText(line.deliveryDate);
    for (const item of line.items ?? []) {
      const from = dateText(item.originalDeliveryDate);
      if (!from || !to || from === to) continue;
      const key = `${from}>${to}`;
      const group = byKey.get(key) ?? { from, to, items: [] };
      const name = item.food?.name?.trim() || 'Item';
      group.items.push((item.quantity ?? 1) > 1 ? `${item.quantity} x ${name}` : name);
      byKey.set(key, group);
    }
  }
  const groups = [...byKey.values()].sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from));

  const last = history[history.length - 1];
  const lastAt = timeOf(last.at) ? new Date(timeOf(last.at)) : null;
  const sentAtMs = timeOf(order.rescheduleEmail?.sentAt);
  const email: RescheduleView['email'] = groups.length === 0 ? 'none' : sentAtMs && sentAtMs >= timeOf(last.at) ? 'sent' : 'pending';
  const shown = groups.length > 0 ? groups.map((g) => `${shortDate(g.from)} \u2192 ${shortDate(g.to)}`).join(', ') : 'Back on the original dates';

  return {
    rescheduled: true,
    moves: history.length,
    lastAt,
    lastBy: last.by?.name ?? '',
    groups,
    email,
    emailSentAt: sentAtMs ? new Date(sentAtMs) : null,
    emailCount: order.rescheduleEmail?.count ?? (sentAtMs ? 1 : 0),
    emailEvent: email === 'sent' ? emailEventOf(order.rescheduleEmail) : null,
    summary: shown,
  };
}

/** Orders filter: only rescheduled orders ('yes'), only orders never moved ('no'). Anything else = no filter. */
export function rescheduledFilterFor(value: string | null | undefined): Record<string, unknown> | null {
  if (value === 'yes') return { 'reschedules.0': { $exists: true } };
  if (value === 'no') return { 'reschedules.0': { $exists: false } };
  return null;
}

/** An item picked in the order details, by its line and its position in it. */
export function selectionKey(line: number, item: number): string {
  return `${line}:${item}`;
}

/** The picked items as the {line, item} list the live site wants. */
export function selectionList(selected: Iterable<string>): Array<{ line: number; item: number }> {
  const out: Array<{ line: number; item: number }> = [];
  for (const key of selected) {
    if (!/^\d+:\d+$/.test(key)) continue;
    const [line, item] = key.split(':').map(Number);
    out.push({ line, item });
  }
  return out.sort((a, b) => a.line - b.line || a.item - b.item);
}

/** True when moving to `date` puts some picked item's delivery before its kitchen day (the food would arrive before it is cooked). */
export function deliversBeforeKitchen(order: OrderRescheduleLike, selected: Iterable<string>, date: string): boolean {
  for (const { line } of selectionList(selected)) {
    const kitchen = dateText(order.items?.[line]?.deliveryDate);
    if (kitchen && date && date < kitchen) return true;
  }
  return false;
}
