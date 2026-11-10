/** Words and numbers for the "Opened" list on the Push Notification page. */

export interface SendRow {
  pushId: string;
  kind: string;
  event: string;
  title: string;
  sentAt: string;
  sent: number;
  customers: number;
  /** customers the message reached; null for messages sent before the list was kept */
  reached?: number | null;
  openedBy: number;
}

/** One customer in the list of who got a message. */
export interface Person {
  userId: string;
  name: string;
  email: string;
  opened: boolean;
  firstOpenedAt: string | null;
  openCount: number;
}

export interface AudienceData {
  /** false for messages sent before the list of recipients was kept: then only the openers are listed */
  recipientsKnown: boolean;
  people: Person[];
}

/** How many customers got it / opened it / did not, from the list. */
export function audienceCounts(people: Person[]): { total: number; opened: number; notOpened: number } {
  const opened = people.filter((p) => p.opened).length;
  return { total: people.length, opened, notOpened: people.length - opened };
}

/** The customers who got it: the people to show under "Opened" and under "Not opened" (the server sends openers first). */
export function splitPeople(people: Person[]): { opened: Person[]; notOpened: Person[] } {
  return { opened: people.filter((p) => p.opened), notOpened: people.filter((p) => !p.opened) };
}

/** The number a message went to, for "x of y opened": who it reached when that is known, else who it was meant for. */
export function sentTo(row: Pick<SendRow, 'reached' | 'customers'>): number {
  return typeof row.reached === 'number' ? row.reached : row.customers;
}

export interface Opener {
  userId: string;
  name: string;
  email: string;
  firstOpenedAt: string;
  openCount: number;
}

const KINDS: Record<string, string> = { menu: 'Menu alert', orders: 'Order update', reminders: 'Cart reminder', updates: 'App update' };

const EVENTS: Record<string, string> = {
  confirmed: 'Order confirmed',
  payment_failed: "Payment didn't go through",
  on_the_way: 'Out for delivery',
  delivered: 'Delivered',
  rescheduled: 'Delivery date changed',
  payment_link: 'Payment link',
  cart_reminder: 'Cart reminder',
};

/** What the message was: the automatic event when there is one, else its kind. */
export function sendLabel(row: Pick<SendRow, 'kind' | 'event'>): string {
  return EVENTS[row.event] ?? KINDS[row.kind] ?? 'Message';
}

/** "3 of 12 opened (25%)": customers who tapped out of the customers it went to. Nothing sent = a dash. */
export function openedText(openedBy: number, customers: number): string {
  if (customers <= 0 && openedBy <= 0) return '–';
  const base = Math.max(customers, openedBy);
  return `${openedBy} of ${base} opened (${Math.round((openedBy / base) * 100)}%)`;
}

/** Messages that really went to phones (a dry run or nobody allowed it has no one to open it). */
export function hasRecipients(row: Pick<SendRow, 'sent' | 'customers'>): boolean {
  return row.sent > 0 || row.customers > 0;
}

/** Automatic messages (one per order or cart): these are rolled into one row per type per day. Manual sends stay on their own. */
const AUTOMATIC = new Set(['confirmed', 'payment_failed', 'on_the_way', 'delivered', 'rescheduled', 'payment_link', 'cart_reminder']);

export interface SendGroup extends SendRow {
  /** every message rolled into this row (one for a manual send) */
  pushIds: string[];
}

function pacificDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * One row per automatic event per Pacific day ("Order confirmed, Nov 9": 24 sent, 3 opened). Numbers are added up; the newest send
 * gives the time. Manual messages (menu alerts, app updates) are left as they are. Newest first.
 */
export function groupSends(rows: SendRow[]): SendGroup[] {
  const out: SendGroup[] = [];
  const byKey = new Map<string, SendGroup>();
  for (const r of rows) {
    if (!AUTOMATIC.has(r.event)) {
      out.push({ ...r, pushIds: [r.pushId] });
      continue;
    }
    const key = `${r.event}|${pacificDay(r.sentAt)}`;
    const g = byKey.get(key);
    if (!g) {
      const fresh: SendGroup = { ...r, pushIds: [r.pushId] };
      byKey.set(key, fresh);
      out.push(fresh);
      continue;
    }
    g.pushIds.push(r.pushId);
    g.sent += r.sent;
    g.customers += r.customers;
    g.openedBy += r.openedBy;
    g.reached = typeof g.reached === 'number' || typeof r.reached === 'number' ? (g.reached ?? 0) + (r.reached ?? r.customers) : null;
    if (r.sentAt > g.sentAt) g.sentAt = r.sentAt;
  }
  return out.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

/** How many messages a row stands for, as a short note ("12 sent"); empty for a single message. */
export function groupNote(g: Pick<SendGroup, 'pushIds'>): string {
  return g.pushIds.length > 1 ? `${g.pushIds.length} sent` : '';
}

/** Merge the people of several messages: opened if they opened any, open counts added, earliest first open kept. */
export function mergePeople(lists: Person[][]): Person[] {
  const by = new Map<string, Person>();
  for (const list of lists) {
    for (const p of list) {
      const m = by.get(p.userId);
      if (!m) {
        by.set(p.userId, { ...p });
        continue;
      }
      m.opened = m.opened || p.opened;
      m.openCount += p.openCount;
      if (p.firstOpenedAt && (!m.firstOpenedAt || p.firstOpenedAt < m.firstOpenedAt)) m.firstOpenedAt = p.firstOpenedAt;
    }
  }
  return [...by.values()].sort((a, b) => Number(b.opened) - Number(a.opened) || a.name.localeCompare(b.name));
}
