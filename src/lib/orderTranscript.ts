/**
 * The order's transcript: everything that happened to an order, in one list, built from what the order itself records
 * (payment, emails, delivery date moves, store credit, refunds, status changes, OptimoRoute, delivery). Each event has a time,
 * a short sentence, who did it (an admin's name, the customer or the system) and a kind for the colour. Newest first.
 */
export type TranscriptKind = 'order' | 'payment' | 'email' | 'date' | 'credit' | 'refund' | 'status' | 'route' | 'delivery' | 'cancel';

export interface TranscriptEvent {
  at: string; // ISO
  kind: TranscriptKind;
  text: string;
  /** Extra lines under the sentence (items, a note) */
  details?: string[];
  by?: string;
}

type When = Date | string | null | undefined;
type Who = { id?: string; name?: string } | string | null | undefined;

export interface TranscriptOrder {
  createdAt?: When;
  updatedAt?: When;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  source?: string;
  createdByAdmin?: string;
  paidAt?: When;
  paymentLinkSentAt?: When;
  totalPaid?: number;
  storeCreditUsed?: number;
  storeCreditState?: string;
  refundedAmount?: number;
  refundedAt?: When;
  deliveredAt?: When;
  deliveredBy?: string;
  emailStatus?: { status?: string; lastAttempt?: When; error?: string } | null;
  statusHistory?: Array<{ at: When; by?: Who; from?: string; to?: string }> | null;
  reschedules?: Array<{
    at: When;
    by?: Who;
    changes?: Array<{ name?: string; quantity?: number; fromDeliveryDate?: string; toDate?: string }>;
  }> | null;
  rescheduleEmail?: { sentAt?: When; by?: Who } | null;
  creditsIssued?: Array<{
    at: When;
    by?: string;
    note?: string;
    amount?: number;
    fee?: number;
    tip?: number;
    entireOrder?: boolean;
    items?: Array<{ name?: string; quantity?: number; amount?: number }>;
  }> | null;
  stripeRefunds?: Array<{ amount?: number; at?: string; reason?: string; note?: string }> | null;
  optimo?: { state?: string; at?: When; stops?: Array<{ date?: string }> } | null;
}

const iso = (v: When): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  partially_delivered: 'Partially delivered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const statusLabel = (s?: string) => (s ? STATUS_LABEL[s] ?? s : '');

/** "Thu, Oct 22" for a YYYY-MM-DD day. */
export function dayLabel(day?: string): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) return day ?? '';
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const who = (by: Who, names: Record<string, string>): string | undefined => {
  if (!by) return undefined;
  if (typeof by === 'string') return names[by] || (by === 'optimoroute' ? 'OptimoRoute' : undefined);
  return by.name || (by.id ? names[by.id] : undefined);
};

const isObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

/** Every admin id the transcript may need a name for. */
export function adminIdsIn(order: TranscriptOrder): string[] {
  const ids = new Set<string>();
  if (order.createdByAdmin) ids.add(order.createdByAdmin);
  for (const c of order.creditsIssued ?? []) if (c.by) ids.add(c.by);
  const fromWho = (w: Who) => {
    const id = typeof w === 'string' ? w : w?.id;
    const hasName = typeof w === 'object' && w?.name;
    if (id && !hasName) ids.add(id);
  };
  for (const s of order.statusHistory ?? []) fromWho(s.by);
  for (const r of order.reschedules ?? []) fromWho(r.by);
  fromWho(order.rescheduleEmail?.by);
  return [...ids].filter(isObjectId);
}

export function buildOrderTranscript(order: TranscriptOrder, names: Record<string, string> = {}): TranscriptEvent[] {
  const events: TranscriptEvent[] = [];
  const add = (at: When, e: Omit<TranscriptEvent, 'at'>) => {
    const t = iso(at);
    if (t) events.push({ at: t, ...e });
  };

  add(order.createdAt, {
    kind: 'order',
    text: order.source === 'admin' ? 'Order entered by an admin' : 'Order placed by the customer',
    by: order.source === 'admin' ? who(order.createdByAdmin, names) : undefined,
  });
  add(order.paymentLinkSentAt, { kind: 'email', text: 'Payment link emailed to the customer' });

  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded') {
    const credit = (order.storeCreditUsed ?? 0) > 0 && order.storeCreditState !== 'released' ? order.storeCreditUsed ?? 0 : 0;
    const total = order.totalPaid ?? 0;
    const text =
      credit > 0 && credit >= total - 0.005
        ? `Paid in full with store credit (${money(credit)})`
        : credit > 0
          ? `Paid: store credit ${money(credit)} + ${order.paymentMethod ?? 'card'} ${money(total - credit)}`
          : `Payment received${order.paymentMethod ? ` by ${order.paymentMethod}` : ''}${total ? ` (${money(total)})` : ''}`;
    add(order.paidAt ?? order.createdAt, { kind: 'payment', text });
  }

  const email = order.emailStatus;
  if (email?.lastAttempt) {
    add(email.lastAttempt, {
      kind: 'email',
      text: email.status === 'sent' ? 'Confirmation email sent to the customer' : email.status === 'failed' ? 'Confirmation email failed to send' : `Confirmation email: ${email.status ?? 'pending'}`,
      ...(email.status === 'failed' && email.error ? { details: [email.error] } : {}),
    });
  }

  for (const r of order.reschedules ?? []) {
    const groups = new Map<string, { from: string; to: string; names: string[] }>();
    for (const c of r.changes ?? []) {
      const key = `${c.fromDeliveryDate}>${c.toDate}`;
      const g = groups.get(key) ?? { from: c.fromDeliveryDate ?? '', to: c.toDate ?? '', names: [] };
      g.names.push(`${c.quantity && c.quantity > 1 ? `${c.quantity} × ` : ''}${c.name ?? 'Item'}`);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      add(r.at, {
        kind: 'date',
        text: `Delivery date changed: ${g.names.length} item${g.names.length === 1 ? '' : 's'} moved from ${dayLabel(g.from)} to ${dayLabel(g.to)}`,
        details: g.names,
        by: who(r.by, names),
      });
    }
  }
  if (order.rescheduleEmail?.sentAt) add(order.rescheduleEmail.sentAt, { kind: 'email', text: 'Customer emailed about the new delivery date', by: who(order.rescheduleEmail.by, names) });

  for (const c of order.creditsIssued ?? []) {
    const details = [
      ...(c.items ?? []).map((i) => `${i.quantity && i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name ?? 'Item'} · ${money(i.amount ?? 0)}`),
      ...(c.fee ? [`Platform Fee (with tax) · ${money(c.fee)}`] : []),
      ...(c.tip ? [`Tip · ${money(c.tip)}`] : []),
      ...(c.note ? [`Note: ${c.note}`] : []),
    ];
    add(c.at, {
      kind: 'credit',
      text: c.entireOrder ? `Entire order credited: ${money(c.amount ?? 0)} given as store credit` : `Store credit given: ${money(c.amount ?? 0)}`,
      details,
      by: who(c.by, names),
    });
  }

  const refunds = order.stripeRefunds ?? [];
  for (const r of refunds) {
    add(r.at, {
      kind: 'refund',
      text: `Refunded in Stripe: ${money(r.amount ?? 0)}${r.reason ? ` (${r.reason.replace(/_/g, ' ')})` : ''}`,
      ...(r.note ? { details: [`Note: ${r.note}`] } : {}),
      by: 'Stripe',
    });
  }
  if (refunds.length === 0 && (order.refundedAmount ?? 0) > 0) add(order.refundedAt, { kind: 'refund', text: `Refunded in Stripe: ${money(order.refundedAmount ?? 0)}`, by: 'Stripe' });

  const history = order.statusHistory ?? [];
  for (const s of history) {
    add(s.at, {
      kind: s.to === 'cancelled' ? 'cancel' : 'status',
      text: s.from ? `Status changed from ${statusLabel(s.from)} to ${statusLabel(s.to)}` : `Status set to ${statusLabel(s.to)}`,
      by: who(s.by, names),
    });
  }
  if (order.status === 'cancelled' && !history.some((s) => s.to === 'cancelled')) add(order.updatedAt, { kind: 'cancel', text: 'Order cancelled' });

  if (order.optimo?.state) {
    const days = [...new Set((order.optimo.stops ?? []).map((s) => dayLabel(s.date)).filter(Boolean))];
    const text =
      order.optimo.state === 'sent' || order.optimo.state === 'adopted'
        ? 'Delivery stop added to OptimoRoute'
        : order.optimo.state === 'removed'
          ? 'Delivery stop removed from OptimoRoute'
          : `OptimoRoute: ${order.optimo.state}`;
    add(order.optimo.at, { kind: 'route', text, ...(days.length ? { details: [`Delivery ${days.length > 1 ? 'days' : 'day'}: ${days.join(', ')}`] } : {}), by: 'System' });
  }

  if (order.deliveredAt) add(order.deliveredAt, { kind: 'delivery', text: 'Order delivered', by: order.deliveredBy === 'optimoroute' ? 'OptimoRoute' : who(order.deliveredBy, names) });

  // newest first; events at the same moment keep the order they happen in (placed, paid, then the rest)
  const rank: Record<TranscriptKind, number> = { order: 0, payment: 1, email: 2, date: 3, credit: 3, refund: 3, route: 3, status: 4, delivery: 5, cancel: 5 };
  return events.sort((a, b) => b.at.localeCompare(a.at) || rank[b.kind] - rank[a.kind]);
}
