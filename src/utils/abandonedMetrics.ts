import type { DraftDoc } from '@/utils/abandonedCheckouts';

/**
 * The numbers at the top of Abandoned Checkout, for the chosen days. Everything counts PEOPLE (one person with several
 * checkouts is one), taken from the checkouts opened in the range:
 *  - started    people who opened checkout
 *  - completed  people who paid: one of those checkouts was paid or superseded by a later payment, or a paid order of theirs
 *               (the website's or one an admin entered) is newer than their latest checkout, the same rule as the list below
 *  - abandoned  started minus completed. People you hid (tests, or people you do not want to contact) are left out of everything.
 * The reminder funnel counts the automatic and manual cart reminder emails sent for those checkouts; a person is "recovered" when
 * they paid for an order within RECOVERY_DAYS after the reminder was sent.
 */

export const RECOVERY_DAYS = 7;

export interface MetricsDraft extends Pick<DraftDoc, 'userId' | 'status' | 'orderId' | 'createdAt' | 'lastActivityAt' | 'dismissedAt' | 'contacted' | 'reminderEmail'> {
  total?: number;
  items?: Array<{ name: string; quantity: number }>;
}

export interface PaidOrderForMetrics {
  user: string;
  createdAt: Date | string;
  totalPaid?: number;
}

export interface AbandonedMetrics {
  started: number;
  completed: number;
  abandoned: number;
  /** completed / started, 0-100, one decimal; null when nobody started */
  conversionRate: number | null;
  /** abandoned people who pressed Pay but the payment did not go through */
  triedToPay: number;
  contacted: number;
  /** money sitting in the latest cart of each abandoned person */
  cartValue: number;
  averageCart: number;
  reminders: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    problems: number;
    recovered: number;
    recoveredRevenue: number;
    /** each as a share of the people reminded, 0-100; null when none were reminded */
    deliveredRate: number | null;
    openedRate: number | null;
    clickedRate: number | null;
    recoveredRate: number | null;
  };
  topItems: Array<{ name: string; units: number; people: number }>;
}

const ms = (d: Date | string | undefined) => (d ? new Date(d).getTime() : 0);
const pct = (n: number, of: number): number | null => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);
const cents = (n: number) => Math.round(n * 100 + 1e-9) / 100;

export function computeMetrics(drafts: MetricsDraft[], paidOrders: PaidOrderForMetrics[]): AbandonedMetrics {
  const lastPaid = new Map<string, number>();
  for (const o of paidOrders) lastPaid.set(o.user, Math.max(lastPaid.get(o.user) ?? 0, ms(o.createdAt)));
  const byUser = new Map<string, MetricsDraft[]>();
  for (const d of drafts) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);

  let started = 0;
  let completed = 0;
  let triedToPay = 0;
  let contacted = 0;
  let cartValue = 0;
  const items = new Map<string, { units: number; people: number }>();
  const reminded: Array<{ userId: string; sentAt: number; delivered: boolean; opened: boolean; clicked: boolean; problem: boolean }> = [];

  for (const [userId, list] of byUser) {
    const latestStarted = Math.max(...list.map((d) => ms(d.createdAt)));
    const done = list.some((d) => d.status === 'converted' || d.status === 'superseded') || (lastPaid.get(userId) ?? 0) >= latestStarted;
    // people you hid and who never paid are left out (they are tests or people you do not want counted)
    if (!done && list.every((d) => d.dismissedAt)) continue;
    started += 1;
    for (const d of list) {
      const r = d.reminderEmail;
      if (r?.sentAt && r.status !== 'claimed' && r.status !== 'failed') {
        reminded.push({
          userId,
          sentAt: ms(r.sentAt),
          delivered: Boolean(r.deliveredAt) || r.status === 'delivered' || Boolean(r.firstOpenedAt),
          opened: Boolean(r.firstOpenedAt),
          clicked: Boolean(r.firstClickedAt),
          problem: r.status === 'bounced' || r.status === 'complained',
        });
      }
    }
    if (done) {
      completed += 1;
      continue;
    }
    const latest = [...list].sort((a, b) => ms(b.lastActivityAt) - ms(a.lastActivityAt) || ms(b.createdAt) - ms(a.createdAt))[0];
    cartValue += Number(latest.total) || 0;
    if (latest.orderId) triedToPay += 1;
    if (list.some((d) => d.contacted)) contacted += 1;
    const seen = new Set<string>();
    for (const it of latest.items ?? []) {
      const name = String(it.name ?? '').trim();
      if (!name) continue;
      const e = items.get(name) ?? { units: 0, people: 0 };
      e.units += Math.max(1, Number(it.quantity) || 1);
      if (!seen.has(name)) e.people += 1;
      seen.add(name);
      items.set(name, e);
    }
  }

  // one person counts once in the funnel: the first reminder sets the time; delivered, opened and clicked are "ever"
  const firstByUser = new Map<string, (typeof reminded)[number]>();
  for (const r of reminded) {
    const seen = firstByUser.get(r.userId);
    if (!seen) {
      firstByUser.set(r.userId, { ...r });
      continue;
    }
    seen.sentAt = Math.min(seen.sentAt, r.sentAt);
    seen.delivered = seen.delivered || r.delivered;
    seen.opened = seen.opened || r.opened;
    seen.clicked = seen.clicked || r.clicked;
    seen.problem = seen.problem || r.problem;
  }
  const people = [...firstByUser.values()];
  let recovered = 0;
  let recoveredRevenue = 0;
  for (const p of people) {
    const order = paidOrders
      .filter((o) => o.user === p.userId && ms(o.createdAt) > p.sentAt && ms(o.createdAt) <= p.sentAt + RECOVERY_DAYS * 24 * 3600 * 1000)
      .sort((a, b) => ms(a.createdAt) - ms(b.createdAt))[0];
    if (order) {
      recovered += 1;
      recoveredRevenue += Number(order.totalPaid) || 0;
    }
  }
  const sent = people.length;
  const delivered = people.filter((p) => p.delivered).length;
  const opened = people.filter((p) => p.opened).length;
  const clicked = people.filter((p) => p.clicked).length;
  const abandoned = started - completed;

  return {
    started,
    completed,
    abandoned,
    conversionRate: pct(completed, started),
    triedToPay,
    contacted,
    cartValue: cents(cartValue),
    averageCart: abandoned > 0 ? cents(cartValue / abandoned) : 0,
    reminders: {
      sent,
      delivered,
      opened,
      clicked,
      problems: people.filter((p) => p.problem && !p.delivered).length,
      recovered,
      recoveredRevenue: cents(recoveredRevenue),
      deliveredRate: pct(delivered, sent),
      openedRate: pct(opened, sent),
      clickedRate: pct(clicked, sent),
      recoveredRate: pct(recovered, sent),
    },
    topItems: [...items.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.units - a.units || b.people - a.people || a.name.localeCompare(b.name))
      .slice(0, 5),
  };
}
