/**
 * Abandoned checkouts: people who opened checkout but did not pay. The site keeps one draft per payment it prepared
 * (`checkoutDrafts`); this turns those into one row per person for the admin list.
 */

/** A checkout is only called abandoned once it has been quiet this long (the customer may still be shopping). */
export const QUIET_MINUTES = 30;

export interface DraftItem {
  date: string;
  day?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  portion?: string;
  spice?: string;
  eco?: boolean;
  choices?: string[];
  note?: string;
}

export interface DraftDoc {
  paymentIntentId: string;
  userId: string;
  customer?: { name?: string; email?: string; phone?: string };
  items?: DraftItem[];
  itemCount?: number;
  total: number;
  deliveryDates?: string[];
  zip?: string;
  status: string;
  orderId?: string;
  source?: string;
  createdAt: Date | string;
  lastActivityAt: Date | string;
  contacted?: { at: Date | string; by?: string; note?: string };
  dismissedAt?: Date | string;
}

export interface PaidOrderRef {
  user: string;
  createdAt: Date | string;
}

export interface OrderInfo {
  orderId: string;
  status?: string;
  paymentStatus?: string;
  paymentError?: { code?: string; declineCode?: string; message?: string };
}

export interface AbandonedRow {
  /** The payment id of the latest checkout of this person (what the actions use) */
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  total: number;
  itemCount: number;
  items: DraftItem[];
  deliveryDates: string[];
  zip?: string;
  lastActivityAt: string;
  /** More checkouts this person left behind before this one */
  earlierCheckouts: number;
  /** They pressed Pay (an order row exists) but the payment did not go through */
  triedToPay: boolean;
  /** Why it did not go through, in plain words (when we know) */
  problem?: string;
  /** Older checkouts that only have contact and totals (no item list) */
  noItemDetails: boolean;
  contacted?: { at: string; by?: string; note?: string };
  /** Contacted before, but they started a newer checkout since */
  previouslyContactedAt?: string;
}

export type View = 'to_contact' | 'contacted';

export interface AbandonedResult {
  rows: AbandonedRow[];
  counts: { to_contact: number; contacted: number };
  /** Money sitting in the carts of the people still to contact */
  valueToContact: number;
  /** People who left a checkout but have since ordered: they are not on the list */
  orderedSince: number;
}

const ms = (d: Date | string | undefined) => (d ? new Date(d).getTime() : 0);
const iso = (d: Date | string) => new Date(d).toISOString();

/** A payment problem in words a person can use when reaching out. */
export function problemText(info: OrderInfo | undefined): string | undefined {
  if (!info) return undefined;
  if (info.paymentStatus === 'paid') return undefined;
  const e = info.paymentError;
  if (!e) return 'The payment was started but not completed';
  const decline = e.declineCode ?? '';
  if (decline === 'insufficient_funds') return 'The card was declined: not enough funds';
  if (decline === 'incorrect_cvc' || e.code === 'incorrect_cvc') return 'The card security code (CVC) was wrong';
  if (e.code === 'expired_card') return 'The card has expired';
  if (e.code === 'card_declined') return 'The card was declined';
  if (e.code?.startsWith('canceled')) return 'The payment was canceled';
  if (e.code === 'payment_intent_authentication_failure') return 'The bank verification (3D Secure) did not go through';
  return e.message ? String(e.message).slice(0, 140) : 'The payment did not go through';
}

/**
 * One row per person from their open drafts:
 *  - drafts still active in the last QUIET_MINUTES are left out (still shopping), as are dismissed ones;
 *  - checkouts left BEFORE the person's last paid order do not count (they ordered since); a person is on the list only
 *    if they have a checkout newer than their last paid order;
 *  - several drafts of one person show as one row (the latest), noting how many came before.
 */
export function buildAbandonedRows(
  drafts: DraftDoc[],
  paidOrders: PaidOrderRef[],
  orderInfo: Map<string, OrderInfo>,
  now: Date = new Date()
): Record<View, AbandonedRow[]> & { orderedSince: number } {
  const quietBefore = now.getTime() - QUIET_MINUTES * 60 * 1000;
  const paidByUser = new Map<string, number[]>();
  for (const o of paidOrders) paidByUser.set(o.user, [...(paidByUser.get(o.user) ?? []), ms(o.createdAt)]);

  const byUser = new Map<string, DraftDoc[]>();
  for (const d of drafts) {
    if (d.status !== 'open' || d.dismissedAt) continue;
    byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);
  }

  const out: Record<View, AbandonedRow[]> & { orderedSince: number } = { to_contact: [], contacted: [], orderedSince: 0 };
  for (const [userId, all] of byUser) {
    // a checkout left before the person's last paid order is history: they ordered afterwards
    const lastPaid = Math.max(0, ...(paidByUser.get(userId) ?? []));
    const list = all.filter((d) => ms(d.createdAt) > lastPaid);
    if (list.length === 0) {
      out.orderedSince += 1;
      continue;
    }
    // newest activity first; on a tie the checkout that was started last (it is the one with the real cart)
    const sorted = [...list].sort((a, b) => ms(b.lastActivityAt) - ms(a.lastActivityAt) || ms(b.createdAt) - ms(a.createdAt));
    const latest = sorted[0];
    if (ms(latest.lastActivityAt) > quietBefore) continue;

    const info = latest.orderId ? orderInfo.get(latest.orderId) : undefined;
    const c = latest.customer ?? {};
    const contactedDraft = sorted.find((d) => d.contacted);
    const contactedAt = contactedDraft?.contacted ? ms(contactedDraft.contacted.at) : 0;
    const stillContacted = Boolean(contactedDraft?.contacted) && contactedAt >= ms(latest.createdAt);
    const row: AbandonedRow = {
      id: latest.paymentIntentId,
      userId,
      name: (c.name ?? '').trim() || (c.email ? c.email.split('@')[0] : 'Customer'),
      ...(c.email ? { email: c.email } : {}),
      ...(c.phone ? { phone: c.phone } : {}),
      total: Number(latest.total) || 0,
      itemCount: latest.itemCount ?? (latest.items ?? []).reduce((s, i) => s + i.quantity, 0),
      items: latest.items ?? [],
      deliveryDates: latest.deliveryDates ?? [],
      ...(latest.zip ? { zip: latest.zip } : {}),
      lastActivityAt: iso(latest.lastActivityAt),
      earlierCheckouts: sorted.length - 1,
      triedToPay: Boolean(latest.orderId),
      ...(problemText(info) && latest.orderId ? { problem: problemText(info) } : {}),
      noItemDetails: (latest.items ?? []).length === 0,
      ...(stillContacted && contactedDraft?.contacted
        ? { contacted: { at: iso(contactedDraft.contacted.at), ...(contactedDraft.contacted.by ? { by: contactedDraft.contacted.by } : {}), ...(contactedDraft.contacted.note ? { note: contactedDraft.contacted.note } : {}) } }
        : {}),
      ...(!stillContacted && contactedDraft?.contacted ? { previouslyContactedAt: iso(contactedDraft.contacted.at) } : {}),
    };
    out[row.contacted ? 'contacted' : 'to_contact'].push(row);
  }
  const newest = (a: AbandonedRow, b: AbandonedRow) => ms(b.lastActivityAt) - ms(a.lastActivityAt);
  out.to_contact.sort(newest);
  out.contacted.sort((a, b) => ms(b.contacted?.at) - ms(a.contacted?.at));
  return out;
}

/** Totals for the tabs and the headline. */
export function summarize(result: Record<View, AbandonedRow[]> & { orderedSince: number }): AbandonedResult['counts'] & { valueToContact: number } {
  return {
    to_contact: result.to_contact.length,
    contacted: result.contacted.length,
    valueToContact: Math.round(result.to_contact.reduce((s, r) => s + r.total, 0) * 100) / 100,
  };
}

const dayText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** A short, friendly email the admin can send as is (opened in their mail app). */
export function reachOutEmail(row: AbandonedRow): { subject: string; body: string } {
  const first = row.name.split(/\s+/)[0] || 'there';
  const names = [...new Set(row.items.map((i) => i.name))].slice(0, 4);
  const cart = names.length > 0 ? ` (${names.join(', ')}${row.items.length > names.length ? ' and more' : ''})` : '';
  const when = row.deliveryDates.length > 0 ? ` for ${row.deliveryDates.map(dayText).join(' and ')}` : '';
  return {
    subject: 'Your NikFoods order is waiting for you',
    body: `Hi ${first},\n\nWe noticed you started an order${when}${cart} but it wasn't completed. If something went wrong or you need help, just reply to this email and we'll sort it out.\n\nThank you,\nNikFoods`,
  };
}

/** Quick notes for the "Mark contacted" dialog. */
export const CONTACT_NOTES = ['Called, no answer', 'Left a voicemail', 'Texted', 'Emailed', 'Spoke with them', 'Will order later'];
