import { describe, expect, it } from 'vitest';
import { buildHeldReport, filterHeld } from './packingHeld';

const row = (over: Record<string, unknown> = {}) => ({ orderId: 'ORD-1', day: '2026-10-20', name: 'Rajma', quantity: 1, portion: '12Oz', spiceLevel: 'Medium Spice', isEco: false, customerName: 'Ann Lee', street: '1 Pine St, Seattle', deliveredOn: '2026-10-23', ...over }) as never;

describe('buildHeldReport', () => {
  it('lists a customer once with every held item and the day it goes out', () => {
    const r = buildHeldReport('2026-10-20', [row(), row({ name: 'Dal', quantity: 2 })], []);
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].lines.map((l) => l.name)).toEqual(['Dal', 'Rajma']);
    expect(r.customers[0].goesOutOn).toEqual(['2026-10-23']);
    expect(r.customers[0].alsoToday).toBe(false);
    expect(r.stats).toEqual({ customers: 1, units: 3 });
  });
  it('marks a customer who also has food going out today', () => {
    const today = [row({ orderId: 'ORD-9', day: '2026-10-20', deliveredOn: null })];
    expect(buildHeldReport('2026-10-20', [row()], today).customers[0].alsoToday).toBe(true);
    expect(buildHeldReport('2026-10-20', [row()], [row({ orderId: 'ORD-1' })]).customers[0].alsoToday).toBe(true);
  });
  it('tells a moved date from a combined day, and ignores lines that go out today or earlier', () => {
    const r = buildHeldReport('2026-10-20', [row({ movedByAdmin: true }), row({ orderId: 'ORD-2', customerName: 'Bo Kim', deliveredOn: '2026-10-20' }), row({ orderId: 'ORD-3', customerName: 'Cy Day', deliveredOn: '2026-10-19' })], []);
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].lines[0].reason).toBe('moved');
  });
  it('sorts by the day it goes out, then by name; two people with the same name on different streets stay apart', () => {
    const r = buildHeldReport('2026-10-20', [row({ customerName: 'Zed', deliveredOn: '2026-10-23', orderId: 'A' }), row({ customerName: 'Amy', deliveredOn: '2026-10-22', orderId: 'B' }), row({ customerName: 'Amy', street: '9 Oak Ave', deliveredOn: '2026-10-22', orderId: 'C' })], []);
    expect(r.customers.map((c) => `${c.customerName}|${c.goesOutOn[0]}`)).toEqual(['Amy|2026-10-22', 'Amy|2026-10-22', 'Zed|2026-10-23']);
  });
  it('a customer with items going out on two days shows both days', () => {
    const r = buildHeldReport('2026-10-20', [row(), row({ deliveredOn: '2026-10-24', orderId: 'ORD-1' })], []);
    expect(r.customers[0].goesOutOn).toEqual(['2026-10-23', '2026-10-24']);
  });
});

describe('filterHeld', () => {
  it('searches customer, item and order number', () => {
    const r = buildHeldReport('2026-10-20', [row(), row({ orderId: 'ORD-7', customerName: 'Bo Kim', name: 'Chole' })], []);
    expect(filterHeld(r, 'chole').customers).toHaveLength(1);
    expect(filterHeld(r, 'ann').customers).toHaveLength(1);
    expect(filterHeld(r, 'ord-7').customers).toHaveLength(1);
    expect(filterHeld(r, '').customers).toHaveLength(2);
  });
});
