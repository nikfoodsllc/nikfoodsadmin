/**
 * "Count it before it is paid" from the Orders table. Mirrors livesite/src/lib/orderCounting.ts (the customer site decides; this
 * only decides what to show). An unpaid, not cancelled order can be counted in the Kitchen, Packing and Delivery reports and put on
 * the route plan; a paid order counts by itself, and a cancelled, failed or refunded one never counts.
 */
export type CountBlock = 'cancelled' | 'paid' | 'failed' | 'refunded';

interface CountableOrder {
  status?: string;
  paymentStatus?: string;
  countBeforePayment?: boolean;
}

export function countBlockedReason(order: CountableOrder): CountBlock | null {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.paymentStatus === 'paid') return 'paid';
  if (order.paymentStatus === 'failed') return 'failed';
  if (order.paymentStatus === 'refunded') return 'refunded';
  return null;
}

/** Counted early and still waiting for payment (once it is paid the tag goes away: it counts anyway) */
export function isCountedEarly(order: CountableOrder): boolean {
  return order.countBeforePayment === true && countBlockedReason(order) === null;
}

export interface CountResultRow {
  orderId: string;
  ok: boolean;
  reason?: string;
  unchanged?: boolean;
}

/** The message after a count / stop-counting action: how many changed, and why the rest were skipped. */
export function countSummary(results: CountResultRow[], count: boolean): { text: string; severity: 'success' | 'warning' | 'error' } {
  const changed = results.filter((r) => r.ok && !r.unchanged).length;
  const same = results.filter((r) => r.ok && r.unchanged).length;
  const skipped = results.filter((r) => !r.ok);
  const verb = count ? 'Counting' : 'No longer counting';
  const parts: string[] = [];
  if (changed > 0) parts.push(`${verb} ${changed} order${changed === 1 ? '' : 's'}`);
  if (same > 0) parts.push(`${same} ${count ? 'already counted' : 'were not counted'}`);
  if (skipped.length > 0) {
    const reasons = Array.from(new Set(skipped.map((r) => r.reason || 'unknown reason')));
    parts.push(`${skipped.length} skipped (${reasons.join('; ')})`);
  }
  const text = parts.join('. ') || 'Nothing to do';
  return { text, severity: skipped.length === 0 ? 'success' : changed > 0 || same > 0 ? 'warning' : 'error' };
}
