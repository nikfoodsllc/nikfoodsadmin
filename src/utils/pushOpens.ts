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
