/** The Notifications page's "App customers" list: the shape the customer site sends, and the search / filter / wording used on screen. */

export interface AppPhone {
  platform: string;
  deviceName: string;
  appVersion: string;
  lastSeenAt: string | null;
  firstSeenAt: string | null;
}

export interface AppCustomer {
  userId: string;
  name: string;
  email: string;
  phone: string;
  phones: AppPhone[];
  lastSeenAt: string | null;
  orders: boolean;
  menuSwitch: boolean;
  menuSubscribed: boolean;
  reminders: boolean;
}

export interface AppCounts {
  customers: number;
  phones: number;
  orders: number;
  menu: number;
  reminders: number;
  allOff: number;
}

export type AppFilter = 'all' | 'ordersOff' | 'menuOff' | 'remindersOn' | 'allOff';

export const APP_FILTERS: Array<{ key: AppFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ordersOff', label: 'Order updates off' },
  { key: 'menuOff', label: 'Menu alerts off' },
  { key: 'remindersOn', label: 'Cart reminders on' },
  { key: 'allOff', label: 'Everything off' },
];

/** Will a menu alert reach this customer? Both the app switch and the menu alerts email list (with consent) must say yes. */
export const getsMenuAlerts = (c: AppCustomer): boolean => c.menuSwitch && c.menuSubscribed;

/** What to show for the menu alerts: On, Off (switched off in the app) or Not subscribed (switch on, but not on the email list). */
export function menuStatus(c: AppCustomer): { label: 'On' | 'Off' | 'Not subscribed'; on: boolean } {
  if (!c.menuSwitch) return { label: 'Off', on: false };
  if (!c.menuSubscribed) return { label: 'Not subscribed', on: false };
  return { label: 'On', on: true };
}

const digits = (text: string) => text.replace(/\D/g, '');

/** Keeps the customers matching the search (name, email, phone number, phone model) and the chosen filter. */
export function filterAppCustomers(list: AppCustomer[], search: string, filter: AppFilter): AppCustomer[] {
  const q = search.trim().toLowerCase();
  const qDigits = digits(q);
  return list.filter((c) => {
    if (filter === 'ordersOff' && c.orders) return false;
    if (filter === 'menuOff' && getsMenuAlerts(c)) return false;
    if (filter === 'remindersOn' && !c.reminders) return false;
    if (filter === 'allOff' && (c.orders || getsMenuAlerts(c) || c.reminders)) return false;
    if (!q) return true;
    if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) return true;
    if (qDigits.length >= 3 && digits(c.phone).includes(qDigits)) return true;
    return c.phones.some((p) => p.deviceName.toLowerCase().includes(q));
  });
}

/** "iPhone of Amy · app 1.0.1", or "iPhone" when the phone sent no name. */
export function phoneText(p: AppPhone): string {
  const base = p.deviceName || (p.platform === 'ios' ? 'iPhone' : p.platform || 'Phone');
  return p.appVersion ? `${base} · app ${p.appVersion}` : base;
}

/** "Oct 21, 5:32 PM" in Pacific time, or a dash when we never heard from the phone. */
export function seenText(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
}
