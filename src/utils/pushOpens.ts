/** Words and numbers for the "Opened" list on the Push Notification page. */

export interface SendRow {
  pushId: string;
  kind: string;
  event: string;
  title: string;
  sentAt: string;
  sent: number;
  customers: number;
  openedBy: number;
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
