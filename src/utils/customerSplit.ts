import { bucketKeyOf, type Bucket, type Grouping } from './businessDashboard';

/**
 * New vs existing customers among paid orders. An order counts as "new" when it is that customer's first paid order ever
 * (any date, not only inside the chosen range); every later order of the same customer is "existing".
 */
export interface SplitOrder {
  orderId: string;
  day: string;
  /** who placed it: the account id, or the email when there is no account */
  customerKey: string | null;
  name: string;
  total: number;
}

export interface SplitLine {
  orderId: string;
  day: string;
  name: string;
  total: number;
  isNew: boolean;
}

export interface CustomerSplit {
  orders: number;
  newOrders: number;
  existingOrders: number;
  /** people whose first order ever is in the period */
  newCustomers: number;
  /** people with at least one repeat order in the period (a new customer who ordered again counts here too) */
  existingCustomers: number;
  /** different people in the period */
  customers: number;
  series: Array<Bucket & { newOrders: number; existingOrders: number }>;
  lines: SplitLine[];
}

/** The key that ties orders of one customer together: account id first, else the email in lower case */
export function customerKeyOf(user: unknown, email: unknown): string | null {
  const id = user == null ? '' : String(user).trim();
  if (id) return `u:${id}`;
  const mail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return mail ? `e:${mail}` : null;
}

/** `firstOrderOf` maps a customer key to the orderId of that customer's first paid order ever */
export function splitNewExisting(orders: SplitOrder[], firstOrderOf: Map<string, string>, buckets: Bucket[], grouping: Grouping): CustomerSplit {
  const series = buckets.map((b) => ({ ...b, newOrders: 0, existingOrders: 0 }));
  const index = new Map(series.map((b, i) => [b.key, i]));
  const newPeople = new Set<string>();
  const existingPeople = new Set<string>();
  const lines: SplitLine[] = [];
  let newOrders = 0;
  for (const o of orders) {
    // no way to tell who it was: it cannot be shown to be a first order, so it counts as existing
    const isNew = o.customerKey !== null && firstOrderOf.get(o.customerKey) === o.orderId;
    if (isNew) newOrders += 1;
    if (o.customerKey) (isNew ? newPeople : existingPeople).add(o.customerKey);
    const i = index.get(bucketKeyOf(o.day, grouping));
    if (i !== undefined) series[i][isNew ? 'newOrders' : 'existingOrders'] += 1;
    lines.push({ orderId: o.orderId, day: o.day, name: o.name, total: o.total, isNew });
  }
  const everyone = new Set([...newPeople, ...existingPeople]);
  lines.sort((a, b) => (a.day === b.day ? a.orderId.localeCompare(b.orderId) : b.day.localeCompare(a.day)));
  return {
    orders: orders.length,
    newOrders,
    existingOrders: orders.length - newOrders,
    newCustomers: newPeople.size,
    existingCustomers: existingPeople.size,
    customers: everyone.size,
    series,
    lines,
  };
}
