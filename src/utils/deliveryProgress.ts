/**
 * Which delivery days of an order are done. An order can be delivered on several days (say Wednesday and Friday). The live
 * site writes `order.optimo.deliveries` as the drivers finish each day's stop in OptimoRoute, and moves the order to
 * Partially Delivered after the first finished day and to Delivered after the last one. This turns that record into the lines
 * shown when you hover over (or open) a Partially Delivered order.
 */
export interface DayDeliveryRecord {
  date?: string | null;
  status?: string | null;
  at?: string | Date | null;
}

export type DayState = 'delivered' | 'failed' | 'pending';

export interface DayProgressLine {
  date: string;
  /** "Wed, Oct 14" */
  label: string;
  state: DayState;
  /** "Delivered", "Not delivered yet" or "Delivery failed" */
  text: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const TEXT: Record<DayState, string> = { delivered: 'Delivered', failed: 'Delivery failed', pending: 'Not delivered yet' };

/** One line per delivery day, oldest first. Records without a valid date are skipped; unknown statuses count as not delivered yet. */
export function deliveryProgressLines(records: DayDeliveryRecord[] | null | undefined): DayProgressLine[] {
  const lines: DayProgressLine[] = [];
  for (const r of records ?? []) {
    const date = typeof r?.date === 'string' ? r.date : '';
    if (!DAY_RE.test(date)) continue;
    const state: DayState = r.status === 'delivered' ? 'delivered' : r.status === 'failed' ? 'failed' : 'pending';
    lines.push({ date, label: dayLabel(date), state, text: TEXT[state] });
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date));
}

/** The words for a tooltip, or a general sentence when the order has no per-day record (a status set by hand). */
export function partialDeliveryTitle(records: DayDeliveryRecord[] | null | undefined): string {
  const lines = deliveryProgressLines(records);
  if (lines.length === 0) return 'Some of the delivery days are delivered. The rest are still to come.';
  return lines.map((l) => `${l.label}: ${l.text}`).join('\n');
}
