/**
 * "Not going out today": the customers whose food is MADE on a date but goes out on a LATER date. They are not on that day's
 * routes, so the packing team needs to see who they are, what they ordered and when it goes out (the food waits in the fridge
 * and the packers take out everything that goes out when they pack that later day).
 *
 * Pure functions, no database.
 */
import { toLine, type PackLine, type PackingRow } from './packingReport';

export interface HeldRowInput extends PackingRow {
  /** An admin moved the delivery date (otherwise the day was combined into a later delivery day) */
  movedByAdmin?: boolean;
}

export type HeldReason = 'combined' | 'moved';

export interface HeldLine extends PackLine {
  /** The day it goes out, 'YYYY-MM-DD' */
  goesOutOn: string;
  reason: HeldReason;
}

export interface HeldCustomer {
  customerName: string;
  address: string;
  orderIds: string[];
  /** The days their held food goes out, earliest first */
  goesOutOn: string[];
  /** The same customer also has something going out on this date (so they ARE on a route today, for other items) */
  alsoToday: boolean;
  lines: HeldLine[];
}

export interface HeldReport {
  date: string;
  customers: HeldCustomer[];
  stats: { customers: number; units: number };
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const streetKey = (v: unknown) => norm(clean(v).split(',')[0]);
const customerKey = (r: { customerName?: string | null; street?: string | null }) => `${norm(r.customerName)}|${streetKey(r.street)}`;

export function buildHeldReport(date: string, held: HeldRowInput[], todayRows: PackingRow[]): HeldReport {
  const todayOrders = new Set(todayRows.map((r) => r.orderId));
  const todayCustomers = new Set(todayRows.map(customerKey));
  const groups = new Map<string, HeldRowInput[]>();
  for (const row of held) {
    if (!row.deliveredOn || row.deliveredOn <= date) continue;
    const key = customerKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const customers: HeldCustomer[] = [...groups.entries()].map(([key, rows]) => {
    const lines: HeldLine[] = rows
      .map((r) => ({ ...toLine(r, date), goesOutOn: r.deliveredOn as string, reason: (r.movedByAdmin ? 'moved' : 'combined') as HeldReason }))
      .sort((a, b) => a.goesOutOn.localeCompare(b.goesOutOn) || a.orderId.localeCompare(b.orderId) || a.name.localeCompare(b.name));
    const orderIds = [...new Set(rows.map((r) => r.orderId))].sort();
    return {
      customerName: clean(rows[0].customerName),
      address: clean(rows[0].street),
      orderIds,
      goesOutOn: [...new Set(lines.map((l) => l.goesOutOn))].sort(),
      alsoToday: todayCustomers.has(key) || orderIds.some((id) => todayOrders.has(id)),
      lines,
    };
  });
  customers.sort((a, b) => a.goesOutOn[0].localeCompare(b.goesOutOn[0]) || a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }));
  return { date, customers, stats: { customers: customers.length, units: customers.reduce((n, c) => n + c.lines.reduce((m, l) => m + l.quantity, 0), 0) } };
}

/** The search box (query already lower case): a customer, an item, an order number. */
export function filterHeld(report: HeldReport, query: string): HeldReport {
  const q = clean(query).toLowerCase();
  if (!q) return report;
  const hit = (text: string) => text.toLowerCase().includes(q);
  const customers = report.customers.filter((c) => hit(c.customerName) || c.orderIds.some(hit) || c.lines.some((l) => hit(l.name) || l.choices.some(hit)));
  return { ...report, customers, stats: { customers: customers.length, units: customers.reduce((n, c) => n + c.lines.reduce((m, l) => m + l.quantity, 0), 0) } };
}

export function heldReasonText(reason: HeldReason): string {
  return reason === 'moved' ? 'Delivery date moved by an admin' : 'Combined into a later delivery day';
}
