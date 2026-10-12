import { describe, it, expect } from 'vitest';
import { buildPackingReport, filterPackingReport, type PackingRow, type RosterRouteInput } from './packingReport';

const DATE = '2026-10-13';
const row = (o: Partial<PackingRow>): PackingRow => ({ orderId: 'ORD-1', day: DATE, name: 'Rajma', quantity: 1, customerName: 'Asha Rao', street: '12 Pine St, Seattle', ...o });
const stop = (number: number, name: string, o: Partial<RosterRouteInput['stops'][0]> = {}) => ({ number, id: `id${number}`, orderNo: '', name, address: '', scheduledAt: '', ...o });

const rows: PackingRow[] = [
  row({ orderId: 'ORD-1', customerName: 'Asha Rao', name: 'Rajma', portion: '12Oz', spiceLevel: 'Hot', isEco: true }),
  row({ orderId: 'ORD-1', customerName: 'Asha Rao', name: 'Chapati', quantity: 4 }),
  row({ orderId: 'ORD-2', customerName: 'Bob Smith', name: 'Rajma', portion: '12Oz', street: '5 Oak Ave' }),
  row({ orderId: 'ORD-3', customerName: 'Chitra Menon', name: 'Pickle', day: '2026-10-07', street: '9 Elm' }),
  row({ orderId: 'ORD-4', customerName: 'Late Customer', name: 'Samosa', quantity: 2, street: '1 Late Rd' }),
  row({
    orderId: 'ORD-5', customerName: 'Dev Patel', name: 'Veg Combo', street: '3 Fir',
    sections: [{ _id: 's1', title: 'Curry', selectedItems: [{ _id: 'o1', portion: '12Oz', item: { _id: 'f1', name: 'Kale Chane' } }] }],
    comboSelections: { s1: ['o1'] },
  }),
];
const roster: RosterRouteInput[] = [
  { driverSerial: '002', driverName: 'Driver B', vehicle: 'V2', stops: [stop(1, 'Bob Smith'), stop(2, 'Dev Patel', { id: 'z9' })] },
  { driverSerial: '001', driverName: 'Driver A', vehicle: 'V1', stops: [stop(1, 'Asha Rao', { id: 'a1' }), stop(2, 'Chitra Menon', { id: 'a2' }), stop(3, 'Nobody Here', { id: 'a3' })] },
];
// our own record ties a stop to its orders (the stop of Asha has two orders under one record)
const records = [{ orderIds: ['ORD-1'], optimoId: 'a1' }, { orderIds: ['ORD-3'], optimoOrderNo: '' , optimoId: 'a2' }];

describe('buildPackingReport', () => {
  const report = buildPackingReport(DATE, rows, roster, records);
  it('routes keep the roster order they come in, titled Route 1, 2 ...', () => {
    expect(report.routes.map((r) => [r.title, r.driverName])).toEqual([['Route 1', 'Driver B'], ['Route 2', 'Driver A']]);
  });
  it('a stop gets the lines of its orders, found through our record', () => {
    const asha = report.routes[1].stops[0];
    expect(asha.orderIds).toEqual(['ORD-1']);
    expect(asha.lines.map((l) => l.name)).toEqual(['Rajma', 'Chapati']);
    expect(asha.lines[0]).toMatchObject({ portion: '12Oz', spice: 'Hot', isEco: true });
  });
  it('a stop the team entered by hand is found by the customer name', () => {
    expect(report.routes[0].stops[0].lines.map((l) => l.name)).toEqual(['Rajma']); // Bob Smith
  });
  it('a combo carries its picks', () => {
    expect(report.routes[0].stops[1].lines[0].choices).toEqual(['Curry: Kale Chane (12Oz)']);
  });
  it('items picked for another menu day say so', () => {
    expect(report.routes[1].stops[1].lines[0].pickedFor).toBe('2026-10-07');
    expect(report.routes[1].stops[0].lines[0].pickedFor).toBeNull();
  });
  it('a stop with nothing to deliver that day is marked empty, not dropped', () => {
    const nobody = report.routes[1].stops[2];
    expect(nobody.empty).toBe(true);
    expect(nobody.lines).toEqual([]);
  });
  it('orders that sit in no stop are listed separately, nothing is lost', () => {
    expect(report.unrouted.map((s) => [s.customerName, s.orderIds])).toEqual([['Late Customer', ['ORD-4']]]);
    expect(report.stats.unroutedStops).toBe(1);
    const all = [...report.routes.flatMap((r) => r.stops), ...report.unrouted].flatMap((s) => s.orderIds);
    expect(new Set(all)).toEqual(new Set(rows.map((r) => r.orderId)));
  });
  it('an order is never in two stops', () => {
    const ids = report.routes.flatMap((r) => r.stops).flatMap((s) => s.orderIds);
    expect(ids.length).toBe(new Set(ids).size);
  });
  it('totals add the same item over every stop, sizes biggest first, eco counted, combos last', () => {
    const rajma = report.totals.find((t) => t.name === 'Rajma')!;
    expect(rajma.quantity).toBe(2);
    expect(rajma.sizes).toEqual([{ label: '12Oz', quantity: 2 }]);
    expect(rajma.eco).toBe(1);
    expect(report.totals[report.totals.length - 1]).toMatchObject({ name: 'Veg Combo', isCombo: true });
    expect(report.stats).toMatchObject({ orders: 5, units: 10, eco: 1, stops: 5 });
  });
  it('without any roster every customer is "not on a route yet"', () => {
    const none = buildPackingReport(DATE, rows, [], []);
    expect(none.routes).toEqual([]);
    expect(none.unrouted).toHaveLength(5);
  });
  it('two customers with the same name are told apart by their street', () => {
    const twins = [row({ orderId: 'A', customerName: 'Sam Lee', street: '1 First St' }), row({ orderId: 'B', customerName: 'Sam Lee', street: '2 Second St' })];
    const r = buildPackingReport(DATE, twins, [{ driverSerial: '1', driverName: '', vehicle: '', stops: [stop(1, 'Sam Lee', { address: '2 Second St, Seattle, WA, USA' })] }], []);
    expect(r.routes[0].stops[0].orderIds).toEqual(['B']);
    expect(r.unrouted[0].orderIds).toEqual(['A']);
  });
});

describe('filterPackingReport', () => {
  const report = buildPackingReport(DATE, rows, roster, records);
  it('finds a customer, an item, an order number or a driver', () => {
    expect(filterPackingReport(report, 'bob').routes.flatMap((r) => r.stops).map((s) => s.customerName)).toEqual(['Bob Smith']);
    expect(filterPackingReport(report, 'chapati').routes.flatMap((r) => r.stops).map((s) => s.customerName)).toEqual(['Asha Rao']);
    expect(filterPackingReport(report, 'ORD-5').routes.flatMap((r) => r.stops).map((s) => s.customerName)).toEqual(['Dev Patel']);
    expect(filterPackingReport(report, 'driver a').routes).toHaveLength(1);
    expect(filterPackingReport(report, 'kale').routes.flatMap((r) => r.stops)).toHaveLength(1);
  });
  it('an empty search keeps everything and routes without a match are dropped', () => {
    expect(filterPackingReport(report, '  ')).toBe(report);
    expect(filterPackingReport(report, 'zzz').routes).toEqual([]);
  });
});

describe('combo parts', () => {
  const eveRows: PackingRow[] = [
  row({
    orderId: 'ORD-6', customerName: 'Eve Combo', name: 'Veg Combo', quantity: 2, spiceLevel: 'Medium', isEco: true, street: '4 Fir',
    sections: [
      { _id: 'c1', title: 'Veg Curry of the Day', selectedItems: [{ _id: 'a', portion: '12Oz', item: { _id: 'f1', name: 'Kale Chane' } }] },
      { _id: 'c2', title: 'Choice of Staple', selectedItems: [{ _id: 'b', portion: '', item: { _id: 'f2', name: 'Chapati' } }, { _id: 'd', portion: '16Oz', item: { _id: 'f3', name: 'Jeera Rice' } }] },
    ],
    comboSelections: { c1: ['a'], c2: ['b', 'd'] },
  }),
  ];
  const report = buildPackingReport(DATE, [...rows, ...eveRows], [], []);
  const eve = report.unrouted.find((s) => s.customerName === 'Eve Combo')!;
  it('a combo line carries its picked options as parts, with the combo spice on the curry only and eco never on bread', () => {
    const parts = eve.lines[0].parts!;
    expect(parts.map((p) => p.name)).toEqual(['Kale Chane', 'Chapati', 'Jeera Rice']);
    expect(parts[0]).toMatchObject({ portion: '12Oz', spice: 'Medium', isEco: true });
    expect(parts[1]).toMatchObject({ portion: null, spice: null, isEco: false });
    expect(parts[2]).toMatchObject({ portion: '16Oz', spice: null, isEco: true });
    expect(eve.lines[0].choices.length).toBe(2); // the old text lines stay for the report
  });
  it('a plain item has no parts', () => {
    const asha = buildPackingReport(DATE, rows, [], []).unrouted.find((s) => s.customerName === 'Asha Rao')!;
    expect(asha.lines.every((l) => l.parts === undefined)).toBe(true);
  });
});
