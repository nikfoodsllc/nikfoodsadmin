/**
 * What changed in a packing list since it was opened: orders that came in, orders that changed and orders that went away,
 * plus whether the drivers' routes were rearranged. Pack live uses it to tell the packers about new orders without ever
 * changing the list under them mid-customer. Pure functions (no browser, no network).
 */
import type { PackingReport, PackStop } from './packingReport';

interface OrderInfo {
  units: number;
  lines: number;
}

export interface PackingChanges {
  newOrders: string[];
  changedOrders: string[];
  removedOrders: string[];
  /** The drivers' routes or the order of their stops are different (an order itself may be the same) */
  layoutChanged: boolean;
  same: boolean;
}

const stopsOf = (report: PackingReport): PackStop[] => [...report.routes.flatMap((r) => r.stops), ...report.unrouted];

function ordersOf(report: PackingReport): Map<string, OrderInfo> {
  const map = new Map<string, OrderInfo>();
  for (const stop of stopsOf(report)) {
    for (const line of stop.lines) {
      const info = map.get(line.orderId) ?? { units: 0, lines: 0 };
      info.units += line.quantity;
      info.lines += 1;
      map.set(line.orderId, info);
    }
  }
  return map;
}

/** Which order sits in which stop of which route, in route order. */
function layoutOf(report: PackingReport): string {
  return JSON.stringify([report.routes.map((r) => [r.key, r.stops.map((s) => [s.number, [...s.orderIds].sort()])]), report.unrouted.map((s) => [...s.orderIds].sort())]);
}

export function comparePackingReports(before: PackingReport, after: PackingReport): PackingChanges {
  const a = ordersOf(before);
  const b = ordersOf(after);
  const newOrders: string[] = [];
  const changedOrders: string[] = [];
  const removedOrders: string[] = [];
  for (const [id, info] of b) {
    const old = a.get(id);
    if (!old) newOrders.push(id);
    else if (old.units !== info.units || old.lines !== info.lines) changedOrders.push(id);
  }
  for (const id of a.keys()) if (!b.has(id)) removedOrders.push(id);
  const layoutChanged = layoutOf(before) !== layoutOf(after);
  return { newOrders: newOrders.sort(), changedOrders: changedOrders.sort(), removedOrders: removedOrders.sort(), layoutChanged, same: !newOrders.length && !changedOrders.length && !removedOrders.length && !layoutChanged };
}

/** "2 new orders and 1 changed order" for the banner. */
export function describeChanges(changes: PackingChanges): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (changes.newOrders.length) parts.push(`${plural(changes.newOrders.length, 'new order')}`);
  if (changes.changedOrders.length) parts.push(`${plural(changes.changedOrders.length, 'changed order')}`);
  if (changes.removedOrders.length) parts.push(`${plural(changes.removedOrders.length, 'cancelled or moved order')}`);
  if (!parts.length && changes.layoutChanged) return 'The routes were rearranged';
  return parts.join(', ');
}
