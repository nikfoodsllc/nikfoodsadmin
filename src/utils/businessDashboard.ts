/**
 * The business Dashboard (Reporting > Dashboard): money, items, visitors and driver pay. Pure helpers only (no database,
 * no network) so every number can be checked on its own.
 *
 * Rules used everywhere on the page:
 *  - A sale is an order that was paid (payment status paid, or refunded later). Unpaid, failed and never-paid checkouts are not sales.
 *  - A sale belongs to the day it was placed (Pacific time), not the delivery day.
 *  - Gross sales = the food subtotal (what the items cost). Tip, Platform Fee and tax are not sales.
 *  - Net sales = gross sales minus refunds (Stripe refunds and store credit given back). A refund covers the food, fee and tax in the same
 *    share as the order total, so a $10 refund on a $50 order takes 20% off each of them.
 *  - Taxable sales = net sales + net Platform Fee (the user's definition). Tax collected = tax after refunds.
 *  - Weeks run Saturday to Friday, like the kitchen weeks (the menu goes out on Friday night).
 */
import { addDays, isDayString, weekStartOf } from './kitchenDashboard';

export type Grouping = 'day' | 'week' | 'month';
export type ItemType = 'cooked' | 'ready_to_eat' | 'not_set';

export interface DayRange {
  from: string;
  to: string;
}

/** The longest range the dashboard reads at once (two years) */
export const MAX_DASHBOARD_DAYS = 731;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

export function daysBetween(range: DayRange): number {
  return Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Why a range cannot be used, or null when it is fine */
export function validateDashboardRange(range: DayRange): string | null {
  if (!isDayString(range.from) || !isDayString(range.to)) return 'Pick a start and an end date.';
  if (range.from > range.to) return 'The start date must not be after the end date.';
  if (daysBetween(range) > MAX_DASHBOARD_DAYS) return 'Pick at most two years at a time.';
  return null;
}

/** The same calendar day one year earlier (Feb 29 becomes Feb 28) */
export function sameDayLastYear(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

/** The period of the same length right before the range */
export function previousRange(range: DayRange): DayRange {
  const length = daysBetween(range);
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

export function lastYearRange(range: DayRange): DayRange {
  return { from: sameDayLastYear(range.from), to: sameDayLastYear(range.to) };
}

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
function monthEnd(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return `${day.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}
function shiftMonth(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.toISOString().slice(0, 7)}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

export interface QuickPair {
  label: string;
  current: DayRange;
  previous: DayRange;
  /** 'vs last week' */
  compareLabel: string;
}

/**
 * This week / month / year SO FAR against the same number of days before: week to date vs last week to the same weekday,
 * month to date vs last month to the same day, year to date vs last year to the same date. Fair because both sides are equally long.
 */
export function quickPairs(today: string): { week: QuickPair; month: QuickPair; year: QuickPair } {
  const weekFrom = weekStartOf(today);
  const monthFrom = monthStart(today);
  const lastMonthFrom = shiftMonth(monthFrom, -1);
  const lastMonthTo = shiftMonth(today, -1) < lastMonthFrom ? lastMonthFrom : shiftMonth(today, -1);
  return {
    week: { label: 'This week', current: { from: weekFrom, to: today }, previous: { from: addDays(weekFrom, -7), to: addDays(today, -7) }, compareLabel: 'vs last week' },
    month: { label: 'This month', current: { from: monthFrom, to: today }, previous: { from: lastMonthFrom, to: lastMonthTo }, compareLabel: 'vs last month' },
    year: { label: 'This year', current: { from: `${today.slice(0, 4)}-01-01`, to: today }, previous: { from: sameDayLastYear(`${today.slice(0, 4)}-01-01`), to: sameDayLastYear(today) }, compareLabel: 'vs last year' },
  };
}

export interface Bucket {
  key: string;
  from: string;
  to: string;
  /** 'Nov 15' for a week (its first day inside the range), 'Nov 2026' for a month */
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDay(day: string): string {
  return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

/** Daily charts are offered for ranges up to this many days (longer ones would be too crowded to read) */
export const MAX_DAILY_DAYS = 92;

/** The grouping to use: what was asked when it is allowed, otherwise the default for the range */
export function resolveGrouping(asked: string | null, range: DayRange): Grouping {
  if (asked === 'week' || asked === 'month') return asked;
  if (asked === 'day' && daysBetween(range) <= MAX_DAILY_DAYS) return 'day';
  return defaultGrouping(range);
}

/** Each day, or the week (Saturday start) or month a day falls in, clipped to the range */
export function bucketsFor(range: DayRange, grouping: Grouping): Bucket[] {
  const buckets: Bucket[] = [];
  if (grouping === 'day') {
    for (let d = range.from; d <= range.to && buckets.length < MAX_DASHBOARD_DAYS; d = addDays(d, 1)) buckets.push({ key: d, from: d, to: d, label: shortDay(d) });
    return buckets;
  }
  let start = grouping === 'week' ? weekStartOf(range.from) : monthStart(range.from);
  while (start <= range.to && buckets.length < 200) {
    const end = grouping === 'week' ? addDays(start, 6) : monthEnd(start);
    const from = start < range.from ? range.from : start;
    const to = end > range.to ? range.to : end;
    const label = grouping === 'week' ? shortDay(from) : `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;
    buckets.push({ key: start, from, to, label });
    start = addDays(end, 1);
  }
  return buckets;
}

export function bucketKeyOf(day: string, grouping: Grouping): string {
  return grouping === 'day' ? day : grouping === 'week' ? weekStartOf(day) : monthStart(day);
}

/** Daily up to a month (a single week shows its days), weekly up to about four months, monthly beyond */
export function defaultGrouping(range: DayRange): Grouping {
  const days = daysBetween(range);
  if (days <= 31) return 'day';
  return days > 120 ? 'month' : 'week';
}

/** Percent change from `before` to `now`; null when there is nothing to compare with */
export function percentChange(now: number, before: number): number | null {
  if (!(before > 0)) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

// ---------------------------------------------------------------------------------------------
// Money of one order
// ---------------------------------------------------------------------------------------------

export interface SaleOrder {
  orderId?: string;
  /** Pacific day the order was placed */
  day: string;
  subtotal?: number;
  platformFee?: number;
  deliveryFee?: number;
  taxes?: number;
  tip?: number;
  totalPaid?: number;
  paymentStatus?: string;
  refundedAmount?: number;
  creditsIssued?: Array<{ amount?: number }>;
  stripeFee?: number;
}

export interface OrderMoney {
  gross: number;
  /** Share of the order given back (0..1) */
  refundShare: number;
  refunds: number;
  net: number;
  fee: number;
  feeNet: number;
  tax: number;
  taxNet: number;
  taxable: number;
  /** What Stripe charged for the payment; null when not recorded (older orders, cash, Zelle) */
  stripeFee: number | null;
}

/** A sale = a paid order (refunded later still counts as a sale, with its refund taken off) */
export function isSale(order: { paymentStatus?: string }): boolean {
  return order.paymentStatus === 'paid' || order.paymentStatus === 'refunded';
}

export function orderMoney(order: SaleOrder): OrderMoney {
  const total = num(order.totalPaid);
  const credits = (order.creditsIssued ?? []).reduce((sum, c) => sum + num(c?.amount), 0);
  const refunded = order.paymentStatus === 'refunded' ? total : num(order.refundedAmount);
  const refundShare = total > 0 ? Math.min(1, Math.max(0, (refunded + credits) / total)) : 0;
  const gross = num(order.subtotal);
  const fee = num(order.platformFee);
  const tax = num(order.taxes);
  const net = gross * (1 - refundShare);
  const feeNet = fee * (1 - refundShare);
  return {
    gross,
    refundShare,
    refunds: gross * refundShare,
    net,
    fee,
    feeNet,
    tax,
    taxNet: tax * (1 - refundShare),
    taxable: net + feeNet,
    stripeFee: typeof order.stripeFee === 'number' && order.stripeFee > 0 ? order.stripeFee : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Totals of many orders
// ---------------------------------------------------------------------------------------------

export interface MoneyTotals {
  orders: number;
  gross: number;
  refunds: number;
  net: number;
  fee: number;
  feeNet: number;
  tax: number;
  taxNet: number;
  taxable: number;
  /** Platform Fee of the orders that have a Stripe fee recorded (to compare like with like) */
  feeOnCard: number;
  stripeFee: number;
  /** Orders with a Stripe fee recorded */
  cardOrders: number;
  /** Orders where Stripe charged more than the Platform Fee */
  lossOrders: number;
  averageOrder: number;
}

export const emptyTotals = (): MoneyTotals => ({
  orders: 0, gross: 0, refunds: 0, net: 0, fee: 0, feeNet: 0, tax: 0, taxNet: 0, taxable: 0, feeOnCard: 0, stripeFee: 0, cardOrders: 0, lossOrders: 0, averageOrder: 0,
});

function addOrder(into: MoneyTotals, money: OrderMoney): void {
  into.orders += 1;
  into.gross += money.gross;
  into.refunds += money.refunds;
  into.net += money.net;
  into.fee += money.fee;
  into.feeNet += money.feeNet;
  into.tax += money.tax;
  into.taxNet += money.taxNet;
  into.taxable += money.taxable;
  if (money.stripeFee !== null) {
    into.cardOrders += 1;
    into.stripeFee += money.stripeFee;
    into.feeOnCard += money.fee;
    if (money.stripeFee > money.fee + 0.0001) into.lossOrders += 1;
  }
}

function finish(t: MoneyTotals): MoneyTotals {
  const out = { ...t };
  for (const k of ['gross', 'refunds', 'net', 'fee', 'feeNet', 'tax', 'taxNet', 'taxable', 'feeOnCard', 'stripeFee'] as const) out[k] = round2(out[k]);
  out.averageOrder = out.orders > 0 ? round2(t.gross / out.orders) : 0;
  return out;
}

const inRange = (day: string, range: DayRange) => day >= range.from && day <= range.to;

/** Totals of the sales placed within the range */
export function totalsFor(orders: SaleOrder[], range: DayRange): MoneyTotals {
  const totals = emptyTotals();
  for (const order of orders) if (isSale(order) && inRange(order.day, range)) addOrder(totals, orderMoney(order));
  return finish(totals);
}

export interface MoneyBucket extends Bucket, MoneyTotals {}

export function moneySeries(orders: SaleOrder[], range: DayRange, grouping: Grouping): MoneyBucket[] {
  const buckets = bucketsFor(range, grouping);
  const sums = new Map(buckets.map((b) => [b.key, emptyTotals()]));
  for (const order of orders) {
    if (!isSale(order) || !inRange(order.day, range)) continue;
    const t = sums.get(bucketKeyOf(order.day, grouping));
    if (t) addOrder(t, orderMoney(order));
  }
  return buckets.map((b) => ({ ...b, ...finish(sums.get(b.key) ?? emptyTotals()) }));
}

/** The orders where Stripe's fee was bigger than the Platform Fee the customer paid, biggest loss first */
export function lossOrders(orders: SaleOrder[], range: DayRange, limit = 50): Array<{ orderId: string; day: string; fee: number; stripeFee: number; loss: number }> {
  const found: Array<{ orderId: string; day: string; fee: number; stripeFee: number; loss: number }> = [];
  for (const order of orders) {
    if (!isSale(order) || !inRange(order.day, range)) continue;
    const m = orderMoney(order);
    if (m.stripeFee !== null && m.stripeFee > m.fee + 0.0001) found.push({ orderId: order.orderId ?? '', day: order.day, fee: round2(m.fee), stripeFee: round2(m.stripeFee), loss: round2(m.stripeFee - m.fee) });
  }
  return found.sort((a, b) => b.loss - a.loss || b.day.localeCompare(a.day)).slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

export interface SaleLine {
  day: string;
  name: string;
  foodId?: string;
  quantity: number;
  /** Price of ONE (portion and eco container included) */
  price: number;
  isCombo?: boolean;
}

/** The key an item is grouped by: its name without case or extra spaces ('Aloo  Parantha' = 'aloo parantha') */
export function itemKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Combos are made fresh, so a combo without a type counts as cooked */
export function lineType(line: Pick<SaleLine, 'isCombo' | 'foodId' | 'name'>, typeOf: (line: Pick<SaleLine, 'foodId' | 'name'>) => ItemType): ItemType {
  const found = typeOf(line);
  if (found === 'not_set' && line.isCombo) return 'cooked';
  return found;
}

export interface ItemTotal {
  key: string;
  name: string;
  type: ItemType;
  quantity: number;
  revenue: number;
}

/** Every item sold in the range with its quantity and sales (price x quantity, before refunds), biggest sales first */
export function itemTotals(lines: SaleLine[], range: DayRange, typeOf: (line: Pick<SaleLine, 'foodId' | 'name'>) => ItemType): ItemTotal[] {
  const map = new Map<string, ItemTotal & { names: Map<string, number> }>();
  for (const line of lines) {
    if (!inRange(line.day, range) || !line.name.trim()) continue;
    const key = itemKey(line.name);
    const entry = map.get(key) ?? { key, name: line.name.trim(), type: lineType(line, typeOf), quantity: 0, revenue: 0, names: new Map() };
    entry.quantity += num(line.quantity);
    entry.revenue += num(line.price) * num(line.quantity);
    entry.names.set(line.name.trim(), (entry.names.get(line.name.trim()) ?? 0) + 1);
    map.set(key, entry);
  }
  return [...map.values()]
    .map(({ names, ...rest }) => ({ ...rest, name: [...names].sort((a, b) => b[1] - a[1])[0]?.[0] ?? rest.name, revenue: round2(rest.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export interface TypeBucket extends Bucket {
  cooked: number;
  readyToEat: number;
  notSet: number;
}

/** Item sales per week or month split into Cooked, Ready to eat and Not set */
export function typeSeries(lines: SaleLine[], range: DayRange, grouping: Grouping, typeOf: (line: Pick<SaleLine, 'foodId' | 'name'>) => ItemType): TypeBucket[] {
  const buckets = bucketsFor(range, grouping);
  const sums = new Map(buckets.map((b) => [b.key, { cooked: 0, readyToEat: 0, notSet: 0 }]));
  for (const line of lines) {
    if (!inRange(line.day, range)) continue;
    const s = sums.get(bucketKeyOf(line.day, grouping));
    if (!s) continue;
    const value = num(line.price) * num(line.quantity);
    const type = lineType(line, typeOf);
    if (type === 'cooked') s.cooked += value;
    else if (type === 'ready_to_eat') s.readyToEat += value;
    else s.notSet += value;
  }
  return buckets.map((b) => {
    const s = sums.get(b.key)!;
    return { ...b, cooked: round2(s.cooked), readyToEat: round2(s.readyToEat), notSet: round2(s.notSet) };
  });
}

/** Cooked and Ready to eat as percentages of their sum (Not set left out), rounded so they add to 100 */
export function typeShare(cooked: number, readyToEat: number): { cooked: number; readyToEat: number } | null {
  const sum = cooked + readyToEat;
  if (!(sum > 0)) return null;
  const c = Math.round((cooked / sum) * 100);
  return { cooked: c, readyToEat: 100 - c };
}

export interface ItemSeries {
  key: string;
  name: string;
  points: Array<{ quantity: number; revenue: number }>;
}

/** Quantity and sales per week or month of the chosen items (by item key), in the order asked */
export function itemSeries(lines: SaleLine[], range: DayRange, grouping: Grouping, keys: string[]): { buckets: Bucket[]; items: ItemSeries[] } {
  const buckets = bucketsFor(range, grouping);
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const wanted = new Map(keys.map((k) => [itemKey(k), { key: itemKey(k), name: k, points: buckets.map(() => ({ quantity: 0, revenue: 0 })), seen: new Map<string, number>() }]));
  for (const line of lines) {
    if (!inRange(line.day, range)) continue;
    const entry = wanted.get(itemKey(line.name));
    const i = index.get(bucketKeyOf(line.day, grouping));
    if (!entry || i === undefined) continue;
    entry.points[i].quantity += num(line.quantity);
    entry.points[i].revenue += num(line.price) * num(line.quantity);
    entry.seen.set(line.name.trim(), (entry.seen.get(line.name.trim()) ?? 0) + 1);
  }
  return {
    buckets,
    items: [...wanted.values()].map((e) => ({
      key: e.key,
      name: [...e.seen].sort((a, b) => b[1] - a[1])[0]?.[0] ?? e.name,
      points: e.points.map((p) => ({ quantity: p.quantity, revenue: round2(p.revenue) })),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Tax by month (for filing)
// ---------------------------------------------------------------------------------------------

export function taxByMonth(orders: SaleOrder[], range: DayRange): Array<{ month: string; label: string; net: number; feeNet: number; taxable: number; taxNet: number; orders: number }> {
  return moneySeries(orders, range, 'month').map((b) => ({ month: b.key.slice(0, 7), label: b.label, net: b.net, feeNet: b.feeNet, taxable: b.taxable, taxNet: b.taxNet, orders: b.orders }));
}

// ---------------------------------------------------------------------------------------------
// Driver pay
// ---------------------------------------------------------------------------------------------

/** Pay rule: planned route time + 30 minutes, rounded UP to the next 15 minutes, at $19 an hour, plus $3 for each delivery */
export const DRIVER_PAY = { hourlyRate: 19, bufferMinutes: 30, roundToMinutes: 15, perDelivery: 3 } as const;

export function paidMinutes(plannedMinutes: number): number {
  const minutes = Math.max(0, num(plannedMinutes)) + DRIVER_PAY.bufferMinutes;
  return Math.ceil(minutes / DRIVER_PAY.roundToMinutes) * DRIVER_PAY.roundToMinutes;
}

export function routePay(plannedMinutes: number, deliveries: number): { paidMinutes: number; hourPay: number; deliveryPay: number; total: number } {
  const minutes = paidMinutes(plannedMinutes);
  const hourPay = round2((minutes / 60) * DRIVER_PAY.hourlyRate);
  const deliveryPay = round2(Math.max(0, num(deliveries)) * DRIVER_PAY.perDelivery);
  return { paidMinutes: minutes, hourPay, deliveryPay, total: round2(hourPay + deliveryPay) };
}

/** '5h 25m' */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

export interface DriverRoute {
  date: string;
  driverName: string;
  driverSerial: string;
  plannedMinutes: number;
  deliveries: number;
}

export interface DriverSummary {
  driver: string;
  days: number;
  deliveries: number;
  plannedMinutes: number;
  paidMinutes: number;
  pay: number;
  /** Average pay for one day of driving */
  payPerDay: number;
  /** Pay divided by deliveries */
  costPerDelivery: number;
  deliveriesPerDay: number;
}

const driverOf = (r: Pick<DriverRoute, 'driverName' | 'driverSerial'>) => r.driverName.trim() || (r.driverSerial ? `Driver ${r.driverSerial}` : 'Driver');

/** One line per driver (by the name in OptimoRoute) plus 'All drivers'; routes without deliveries are left out */
export function driverSummaries(routes: DriverRoute[]): { drivers: DriverSummary[]; all: DriverSummary } {
  const map = new Map<string, { days: Set<string>; deliveries: number; planned: number; paid: number; pay: number }>();
  const all = { days: new Set<string>(), routes: 0, deliveries: 0, planned: 0, paid: 0, pay: 0 };
  for (const r of routes) {
    if (!(r.deliveries > 0)) continue;
    const pay = routePay(r.plannedMinutes, r.deliveries);
    const name = driverOf(r);
    const entry = map.get(name) ?? { days: new Set<string>(), deliveries: 0, planned: 0, paid: 0, pay: 0 };
    entry.days.add(r.date);
    entry.deliveries += r.deliveries;
    entry.planned += r.plannedMinutes;
    entry.paid += pay.paidMinutes;
    entry.pay += pay.total;
    map.set(name, entry);
    all.routes += 1;
    all.deliveries += r.deliveries;
    all.planned += r.plannedMinutes;
    all.paid += pay.paidMinutes;
    all.pay += pay.total;
  }
  const summary = (driver: string, days: number, e: { deliveries: number; planned: number; paid: number; pay: number }): DriverSummary => ({
    driver,
    days,
    deliveries: e.deliveries,
    plannedMinutes: e.planned,
    paidMinutes: e.paid,
    pay: round2(e.pay),
    payPerDay: days > 0 ? round2(e.pay / days) : 0,
    costPerDelivery: e.deliveries > 0 ? round2(e.pay / e.deliveries) : 0,
    deliveriesPerDay: days > 0 ? Math.round((e.deliveries / days) * 10) / 10 : 0,
  });
  const drivers = [...map].map(([name, e]) => summary(name, e.days.size, e)).sort((a, b) => b.deliveries - a.deliveries || a.driver.localeCompare(b.driver));
  // 'All drivers': per driver-day, so the average day is one driver's day, not the whole team's
  return { drivers, all: summary('All drivers', all.routes, all) };
}
