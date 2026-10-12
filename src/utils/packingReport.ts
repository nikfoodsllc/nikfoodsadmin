/**
 * The Packing Report: what to pack for each delivery stop, in the order of the drivers' routes, for ONE delivery date.
 * The kitchen day does not matter here (the food is already made): only what goes out on that date does.
 *
 * Pure functions, no database and no network. The inputs are the order lines delivered that day, the roster (drivers and
 * their stops, copied from OptimoRoute once it has planned the routes) and our record of which orders sit in which stop.
 */
import { comboChoiceLines, type KitchenRow } from './kitchenDashboard';

/** One ordered line delivered on the report's date. */
export interface PackingRow extends KitchenRow {
  /** Street of the delivery address (to match a stop that the team entered by hand) */
  street?: string | null;
}

export interface RosterStopInput {
  number: number;
  id: string;
  orderNo: string;
  name: string;
  address: string;
  scheduledAt: string;
}

export interface RosterRouteInput {
  driverSerial: string;
  driverName: string;
  vehicle: string;
  stops: RosterStopInput[];
}

export interface StopRecord {
  orderIds: string[];
  optimoId?: string;
  optimoOrderNo?: string;
}

export interface PackLine {
  orderId: string;
  name: string;
  quantity: number;
  portion: string | null;
  spice: string | null;
  isEco: boolean;
  /** A combo's picks, one line per section ("Veg Curry of the Day: Kale Chane (12Oz)"); empty for a plain item */
  choices: string[];
  /** The menu day it was picked for, when that is not the delivery date (cart clubbing or a moved date) */
  pickedFor: string | null;
}

export interface PackStop {
  /** Position on the route (1, 2, 3 ...); 0 for a customer who is not on a route */
  number: number;
  customerName: string;
  address: string;
  /** Planned arrival 'HH:MM' ('' when unknown) */
  scheduledAt: string;
  orderIds: string[];
  lines: PackLine[];
  /** The stop is on a route but nothing of ours is delivered on this date for it */
  empty: boolean;
}

export interface PackRoute {
  key: string;
  /** "Route 1" ... in driver order */
  title: string;
  driverName: string;
  vehicle: string;
  stops: PackStop[];
}

export interface PackTotal {
  name: string;
  quantity: number;
  /** e.g. "12Oz x 3" */
  sizes: Array<{ label: string; quantity: number }>;
  eco: number;
  isCombo: boolean;
}

export interface PackingReport {
  date: string;
  routes: PackRoute[];
  /** Customers with something to deliver on this date who are not on any route */
  unrouted: PackStop[];
  totals: PackTotal[];
  stats: { stops: number; orders: number; units: number; eco: number; unroutedStops: number };
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const streetKey = (v: unknown) => norm(clean(v).split(',')[0]);

function toLine(row: PackingRow, date: string): PackLine {
  const choices = comboChoiceLines(row);
  return {
    orderId: row.orderId,
    name: clean(row.name),
    quantity: row.quantity,
    portion: clean(row.portion) || null,
    spice: clean(row.spiceLevel) || null,
    isEco: Boolean(row.isEco),
    choices,
    pickedFor: row.day && row.day !== date ? row.day : null,
  };
}

/** Which orders sit in a roster stop: our own record first (by OptimoRoute id or order number), then the customer's name and street. */
function ordersOfStop(stop: RosterStopInput, records: StopRecord[], rows: PackingRow[], claimed: Set<string>): string[] {
  const rec = records.find((r) => (stop.id && r.optimoId === stop.id) || (stop.orderNo && r.optimoOrderNo === stop.orderNo));
  if (rec && rec.orderIds.length > 0) return rec.orderIds.filter((id) => !claimed.has(id));
  const name = norm(stop.name);
  if (!name) return [];
  const byName = new Map<string, PackingRow[]>();
  for (const r of rows) {
    if (claimed.has(r.orderId) || norm(r.customerName) !== name) continue;
    byName.set(r.orderId, [...(byName.get(r.orderId) ?? []), r]);
  }
  if (byName.size === 0) return [];
  const street = streetKey(stop.address);
  const sameStreet = [...byName.entries()].filter(([, rs]) => street && rs.some((r) => streetKey(r.street) === street));
  // one customer with that name: take it. Several: only the ones on the same street.
  if (byName.size === 1) return [...byName.keys()];
  return sameStreet.map(([id]) => id);
}

function sortLines(lines: PackLine[]): PackLine[] {
  // keep the order of the order itself, orders by number
  return [...lines].sort((a, b) => a.orderId.localeCompare(b.orderId));
}

export function buildPackingReport(date: string, rows: PackingRow[], roster: RosterRouteInput[], records: StopRecord[]): PackingReport {
  const claimed = new Set<string>();
  const customerOf = new Map<string, string>();
  const addressOf = new Map<string, string>();
  for (const r of rows) {
    if (r.customerName) customerOf.set(r.orderId, clean(r.customerName));
    if (r.street) addressOf.set(r.orderId, clean(r.street));
  }
  const linesOf = (ids: string[]) => sortLines(rows.filter((r) => ids.includes(r.orderId)).map((r) => toLine(r, date)));

  const routes: PackRoute[] = roster.map((route, index) => ({
    key: route.driverSerial || String(index + 1),
    title: `Route ${index + 1}`,
    driverName: route.driverName,
    vehicle: route.vehicle,
    stops: route.stops.map((stop) => {
      const ids = ordersOfStop(stop, records, rows, claimed);
      ids.forEach((id) => claimed.add(id));
      const lines = linesOf(ids);
      return { number: stop.number, customerName: clean(stop.name) || customerOf.get(ids[0]) || '', address: clean(stop.address), scheduledAt: stop.scheduledAt, orderIds: ids, lines, empty: lines.length === 0 };
    }),
  }));

  // what is delivered on this date but sits in no stop (an order that came in after the routes were planned, or a day without routes)
  const leftOver = new Map<string, PackingRow[]>();
  for (const r of rows) {
    if (claimed.has(r.orderId)) continue;
    const key = `${norm(r.customerName)}|${streetKey(r.street)}`;
    leftOver.set(key, [...(leftOver.get(key) ?? []), r]);
  }
  const unrouted: PackStop[] = [...leftOver.values()]
    .map((list) => {
      const ids = [...new Set(list.map((r) => r.orderId))].sort();
      return { number: 0, customerName: clean(list[0].customerName), address: clean(list[0].street), scheduledAt: '', orderIds: ids, lines: linesOf(ids), empty: false };
    })
    .sort((a, b) => a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }));

  const totalsMap = new Map<string, PackTotal & { sizeMap: Map<string, number> }>();
  for (const r of rows) {
    const isCombo = comboChoiceLines(r).length > 0;
    const name = clean(r.name);
    const key = `${isCombo ? 'c' : 'i'}|${name}`;
    const t = totalsMap.get(key) ?? { name, quantity: 0, sizes: [], eco: 0, isCombo, sizeMap: new Map() };
    t.quantity += r.quantity;
    if (r.isEco) t.eco += r.quantity;
    const size = clean(r.portion);
    if (size) t.sizeMap.set(size, (t.sizeMap.get(size) ?? 0) + r.quantity);
    totalsMap.set(key, t);
  }
  const totals: PackTotal[] = [...totalsMap.values()]
    .map(({ sizeMap, ...t }) => ({ ...t, sizes: [...sizeMap.entries()].map(([label, quantity]) => ({ label, quantity })).sort((a, b) => b.label.localeCompare(a.label, undefined, { numeric: true })) }))
    .sort((a, b) => Number(a.isCombo) - Number(b.isCombo) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const orders = new Set(rows.map((r) => r.orderId));
  return {
    date,
    routes,
    unrouted,
    totals,
    stats: { stops: routes.reduce((n, r) => n + r.stops.length, 0), orders: orders.size, units: rows.reduce((n, r) => n + r.quantity, 0), eco: rows.reduce((n, r) => n + (r.isEco ? r.quantity : 0), 0), unroutedStops: unrouted.length },
  };
}

/** The search box: a customer, an item, an order number or a driver. Routes and stops that do not match are dropped. */
export function filterPackingReport(report: PackingReport, query: string): PackingReport {
  const q = clean(query).toLowerCase();
  if (!q) return report;
  const hit = (text: string) => text.toLowerCase().includes(q);
  const stopHits = (s: PackStop) => hit(s.customerName) || s.orderIds.some(hit) || s.lines.some((l) => hit(l.name) || l.choices.some(hit));
  const routes = report.routes
    .map((route) => ({ ...route, stops: route.stops.filter((s) => hit(route.driverName) || hit(route.title) || stopHits(s)) }))
    .filter((route) => route.stops.length > 0);
  return { ...report, routes, unrouted: report.unrouted.filter(stopHits), totals: report.totals.filter((t) => hit(t.name)) };
}
