import { QUIET_MINUTES, type DraftDoc, type DraftItem } from '@/utils/abandonedCheckouts';

/**
 * The Paid tab: people who left checkout without paying and later came back and paid, so you can see which ones were won back
 * and what brought them back. Only a real return counts: the checkout they left must have been quiet for QUIET_MINUTES before
 * the order (someone who changes their cart and pays a minute later never "left"). Hidden people are not listed.
 */

export interface PaidOrderRef {
  orderId: string;
  user: string;
  createdAt: Date | string;
  totalPaid?: number;
}

export type PaidReason = 'reminder_click' | 'reminder' | 'contacted' | 'own';

export interface PaidRow {
  /** the order they paid (what the list shows and sorts on) */
  orderId: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  amount: number;
  paidAt: string;
  /** when they left the checkout that was not paid */
  leftAt: string;
  /** what they left in that cart */
  items: DraftItem[];
  itemCount: number;
  reason: PaidReason;
  /** the reminder email went out before they paid, and what happened to it */
  reminder?: { sentAt: string; opened: boolean; clicked: boolean };
  contacted?: { at: string; by?: string; note?: string };
}

const ms = (d: Date | string | undefined) => (d ? new Date(d).getTime() : 0);
const iso = (d: Date | string) => new Date(d).toISOString();

export function buildPaidRows(drafts: DraftDoc[], orders: PaidOrderRef[]): PaidRow[] {
  const quiet = QUIET_MINUTES * 60 * 1000;
  const byUser = new Map<string, DraftDoc[]>();
  for (const d of drafts) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);
  const ordersByUser = new Map<string, PaidOrderRef[]>();
  for (const o of orders) ordersByUser.set(o.user, [...(ordersByUser.get(o.user) ?? []), o]);

  const rows: PaidRow[] = [];
  for (const [userId, list] of byUser) {
    if (list.every((d) => d.dismissedAt)) continue;
    const mine = (ordersByUser.get(userId) ?? []).sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
    // the first paid order that came at least QUIET_MINUTES after some checkout of theirs went quiet
    let hit: { order: PaidOrderRef; left: DraftDoc } | null = null;
    for (const o of mine) {
      const left = list
        .filter((d) => d.status !== 'converted' && ms(d.createdAt) < ms(o.createdAt) && ms(d.lastActivityAt) + quiet <= ms(o.createdAt))
        .sort((a, b) => ms(b.lastActivityAt) - ms(a.lastActivityAt))[0];
      if (left) {
        hit = { order: o, left };
        break;
      }
    }
    if (!hit) continue;
    const { order, left } = hit;
    const paid = ms(order.createdAt);
    const c = left.customer ?? list.find((d) => d.customer)?.customer ?? {};

    let reminder: PaidRow['reminder'];
    for (const d of list) {
      const r = d.reminderEmail;
      if (!r?.sentAt || r.status === 'claimed' || r.status === 'failed' || ms(r.sentAt) >= paid) continue;
      const cur = {
        sentAt: ms(r.sentAt),
        opened: Boolean(r.firstOpenedAt) && ms(r.firstOpenedAt) < paid,
        clicked: Boolean(r.firstClickedAt) && ms(r.firstClickedAt) < paid,
      };
      if (!reminder) reminder = { sentAt: iso(new Date(cur.sentAt)), opened: cur.opened, clicked: cur.clicked };
      else reminder = { sentAt: reminder.sentAt, opened: reminder.opened || cur.opened, clicked: reminder.clicked || cur.clicked };
    }
    const contactedDraft = list.find((d) => d.contacted && ms(d.contacted.at) < paid);
    const contacted = contactedDraft?.contacted
      ? { at: iso(contactedDraft.contacted.at), ...(contactedDraft.contacted.by ? { by: contactedDraft.contacted.by } : {}), ...(contactedDraft.contacted.note ? { note: contactedDraft.contacted.note } : {}) }
      : undefined;

    const reason: PaidReason = reminder?.clicked ? 'reminder_click' : reminder ? 'reminder' : contacted ? 'contacted' : 'own';
    rows.push({
      orderId: order.orderId,
      userId,
      name: (c.name ?? '').trim() || (c.email ? c.email.split('@')[0] : 'Customer'),
      ...(c.email ? { email: c.email } : {}),
      ...(c.phone ? { phone: c.phone } : {}),
      amount: Math.round((Number(order.totalPaid) || 0) * 100 + 1e-9) / 100,
      paidAt: iso(order.createdAt),
      leftAt: iso(left.lastActivityAt),
      items: left.items ?? [],
      itemCount: left.itemCount ?? (left.items ?? []).reduce((s, i) => s + i.quantity, 0),
      reason,
      ...(reminder ? { reminder } : {}),
      ...(contacted ? { contacted } : {}),
    });
  }
  return rows.sort((a, b) => ms(b.paidAt) - ms(a.paidAt));
}
