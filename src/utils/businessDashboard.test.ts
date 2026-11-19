import { describe, expect, it } from 'vitest';
import {
  bucketsFor,
  defaultGrouping,
  driverSummaries,
  itemSeries,
  itemTotals,
  lastYearRange,
  lossOrders,
  moneySeries,
  orderMoney,
  paidMinutes,
  percentChange,
  previousRange,
  quickPairs,
  resolveGrouping,
  routePay,
  sameDayLastYear,
  taxByMonth,
  totalsFor,
  typeSeries,
  typeShare,
  validateDashboardRange,
  type SaleLine,
  type SaleOrder,
} from './businessDashboard';

describe('dates', () => {
  it('compares with the period before and the year before', () => {
    expect(previousRange({ from: '2026-11-01', to: '2026-11-14' })).toEqual({ from: '2026-10-18', to: '2026-10-31' });
    expect(lastYearRange({ from: '2026-11-01', to: '2026-11-14' })).toEqual({ from: '2025-11-01', to: '2025-11-14' });
    expect(sameDayLastYear('2028-02-29')).toBe('2027-02-28');
  });

  it('builds fair "so far" pairs', () => {
    const q = quickPairs('2026-11-18'); // a Wednesday; the week started Saturday Nov 14
    expect(q.week.current).toEqual({ from: '2026-11-14', to: '2026-11-18' });
    expect(q.week.previous).toEqual({ from: '2026-11-07', to: '2026-11-11' });
    expect(q.month.current).toEqual({ from: '2026-11-01', to: '2026-11-18' });
    expect(q.month.previous).toEqual({ from: '2026-10-01', to: '2026-10-18' });
    expect(q.year.previous).toEqual({ from: '2025-01-01', to: '2025-11-18' });
    // Mar 31 compares with Feb 1..28, never into March
    expect(quickPairs('2026-03-31').month.previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('splits a range into Saturday weeks or months, clipped to the range', () => {
    const weeks = bucketsFor({ from: '2026-11-03', to: '2026-11-18' }, 'week');
    expect(weeks.map((b) => [b.key, b.from, b.to])).toEqual([
      ['2026-10-31', '2026-11-03', '2026-11-06'],
      ['2026-11-07', '2026-11-07', '2026-11-13'],
      ['2026-11-14', '2026-11-14', '2026-11-18'],
    ]);
    expect(bucketsFor({ from: '2026-09-15', to: '2026-11-02' }, 'month').map((b) => b.label)).toEqual(['Sep 2026', 'Oct 2026', 'Nov 2026']);
    expect(defaultGrouping({ from: '2026-08-01', to: '2026-11-18' })).toBe('week');
    expect(defaultGrouping({ from: '2026-01-01', to: '2026-11-18' })).toBe('month');
  });

  it('daily buckets: one per day; Daily only for ranges up to 92 days', () => {
    const days = bucketsFor({ from: '2026-11-16', to: '2026-11-18' }, 'day');
    expect(days.map((b) => [b.key, b.label])).toEqual([['2026-11-16', 'Nov 16'], ['2026-11-17', 'Nov 17'], ['2026-11-18', 'Nov 18']]);
    expect(resolveGrouping('day', { from: '2026-10-01', to: '2026-11-18' })).toBe('day');
    expect(resolveGrouping('day', { from: '2026-01-01', to: '2026-11-18' })).toBe('month');
    expect(resolveGrouping('junk', { from: '2026-11-01', to: '2026-11-18' })).toBe('day');
    expect(resolveGrouping(null, { from: '2026-11-14', to: '2026-11-18' })).toBe('day');
    expect(resolveGrouping(null, { from: '2026-09-01', to: '2026-11-18' })).toBe('week');
    const orders = [order({ day: '2026-11-16' }), order({ day: '2026-11-18', subtotal: 10 })];
    expect(moneySeries(orders, { from: '2026-11-16', to: '2026-11-18' }, 'day').map((b) => b.gross)).toEqual([40, 0, 10]);
  });

  it('refuses bad ranges', () => {
    expect(validateDashboardRange({ from: '2026-11-18', to: '2026-11-01' })).toMatch(/start/);
    expect(validateDashboardRange({ from: '2023-01-01', to: '2026-11-01' })).toMatch(/two years/);
    expect(validateDashboardRange({ from: '2026-02-30', to: '2026-03-01' })).toMatch(/Pick/);
    expect(validateDashboardRange({ from: '2025-01-01', to: '2026-11-18' })).toBeNull();
  });

  it('percent change', () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(90, 0)).toBeNull();
    expect(percentChange(0, 50)).toBe(-100);
  });
});

const order = (o: Partial<SaleOrder>): SaleOrder => ({ day: '2026-11-16', paymentStatus: 'paid', subtotal: 40, platformFee: 1.91, taxes: 4.32, tip: 4, totalPaid: 50.23, ...o });

describe('money', () => {
  it('takes refunds off food, fee and tax in the same share', () => {
    const m = orderMoney(order({ subtotal: 40, platformFee: 2, taxes: 4, tip: 4, totalPaid: 50, refundedAmount: 10 }));
    expect(m.refundShare).toBeCloseTo(0.2);
    expect(m.net).toBeCloseTo(32);
    expect(m.feeNet).toBeCloseTo(1.6);
    expect(m.taxNet).toBeCloseTo(3.2);
    expect(m.taxable).toBeCloseTo(33.6);
  });

  it('counts store credit given back as a refund, and a full refund as everything', () => {
    expect(orderMoney(order({ totalPaid: 50, creditsIssued: [{ amount: 25 }] })).refundShare).toBeCloseTo(0.5);
    expect(orderMoney(order({ paymentStatus: 'refunded' })).net).toBe(0);
    expect(orderMoney(order({ totalPaid: 50, refundedAmount: 40, creditsIssued: [{ amount: 30 }] })).refundShare).toBe(1);
  });

  it('only counts paid orders, inside the range, by the day placed', () => {
    const orders = [
      order({ subtotal: 40 }),
      order({ subtotal: 30, paymentStatus: 'unpaid' }),
      order({ subtotal: 20, paymentStatus: 'failed' }),
      order({ subtotal: 10, day: '2026-11-01' }),
      order({ subtotal: 50, paymentStatus: 'refunded', totalPaid: 60 }),
    ];
    const t = totalsFor(orders, { from: '2026-11-10', to: '2026-11-18' });
    expect(t.orders).toBe(2);
    expect(t.gross).toBe(90);
    expect(t.net).toBe(40);
    expect(t.refunds).toBe(50);
    expect(t.averageOrder).toBe(45);
  });

  it('compares Platform Fee with Stripe fee only where Stripe charged, and finds the losses', () => {
    const orders = [
      order({ orderId: 'A', platformFee: 1.2, stripeFee: 1.5 }),
      order({ orderId: 'B', platformFee: 2, stripeFee: 1.5 }),
      order({ orderId: 'C', platformFee: 3 }), // cash: no Stripe fee
    ];
    const t = totalsFor(orders, { from: '2026-11-01', to: '2026-11-30' });
    expect(t.cardOrders).toBe(2);
    expect(t.feeOnCard).toBe(3.2);
    expect(t.stripeFee).toBe(3);
    expect(t.lossOrders).toBe(1);
    expect(t.fee).toBe(6.2);
    expect(lossOrders(orders, { from: '2026-11-01', to: '2026-11-30' })).toEqual([{ orderId: 'A', day: '2026-11-16', fee: 1.2, stripeFee: 1.5, loss: 0.3 }]);
  });

  it('series and tax months add up to the totals', () => {
    const range = { from: '2026-10-20', to: '2026-11-18' };
    const orders = [order({ day: '2026-10-21' }), order({ day: '2026-11-02', refundedAmount: 5 }), order({ day: '2026-11-17' })];
    const total = totalsFor(orders, range);
    const weeks = moneySeries(orders, range, 'week');
    expect(weeks.reduce((s, b) => s + b.gross, 0)).toBeCloseTo(total.gross);
    expect(weeks.reduce((s, b) => s + b.net, 0)).toBeCloseTo(total.net);
    const months = taxByMonth(orders, range);
    expect(months.map((m) => m.month)).toEqual(['2026-10', '2026-11']);
    expect(months.reduce((s, m) => s + m.taxNet, 0)).toBeCloseTo(total.taxNet);
    expect(months.reduce((s, m) => s + m.taxable, 0)).toBeCloseTo(total.taxable);
  });
});

const line = (l: Partial<SaleLine>): SaleLine => ({ day: '2026-11-16', name: 'Aloo Parantha', quantity: 1, price: 6, ...l });
const types: Record<string, 'cooked' | 'ready_to_eat'> = { 'aloo parantha': 'cooked', 'mango pickle': 'ready_to_eat' };
const typeOf = (l: { name: string }) => types[l.name.trim().toLowerCase()] ?? 'not_set';

describe('items', () => {
  it('totals items by name regardless of case and spaces, biggest sales first', () => {
    const lines = [line({ quantity: 2 }), line({ name: 'aloo  parantha ', quantity: 1 }), line({ name: 'Mango Pickle', quantity: 5, price: 8 })];
    const totals = itemTotals(lines, { from: '2026-11-01', to: '2026-11-30' }, typeOf);
    expect(totals).toEqual([
      { key: 'mango pickle', name: 'Mango Pickle', type: 'ready_to_eat', quantity: 5, revenue: 40 },
      { key: 'aloo parantha', name: 'Aloo Parantha', type: 'cooked', quantity: 3, revenue: 18 },
    ]);
  });

  it('splits cooked and ready to eat; combos without a type count as cooked', () => {
    const lines = [line({ quantity: 2 }), line({ name: 'Mango Pickle', price: 8 }), line({ name: 'Veg Combo', price: 25, isCombo: true }), line({ name: 'Mystery', price: 5 })];
    const [week] = typeSeries(lines, { from: '2026-11-14', to: '2026-11-20' }, 'week', typeOf);
    expect([week.cooked, week.readyToEat, week.notSet]).toEqual([37, 8, 5]);
    expect(typeShare(65, 35)).toEqual({ cooked: 65, readyToEat: 35 });
    expect(typeShare(2, 1)).toEqual({ cooked: 67, readyToEat: 33 });
    expect(typeShare(0, 0)).toBeNull();
  });

  it('gives a point for every week for each chosen item, zero when not sold', () => {
    const lines = [line({ day: '2026-11-02' }), line({ day: '2026-11-16', quantity: 3 }), line({ name: 'Gobhi Parantha', day: '2026-11-16' })];
    const s = itemSeries(lines, { from: '2026-10-31', to: '2026-11-20' }, 'week', ['Aloo Parantha', 'Gobhi Parantha']);
    expect(s.buckets).toHaveLength(3);
    expect(s.items[0].points.map((p) => p.quantity)).toEqual([1, 0, 3]);
    expect(s.items[1].points.map((p) => p.revenue)).toEqual([0, 0, 6]);
  });
});

describe('driver pay', () => {
  it('adds 30 minutes and rounds up to 15 minutes', () => {
    expect(paidMinutes(300)).toBe(330); // 5h -> 5h 30m (the user's example)
    expect(paidMinutes(325)).toBe(360); // 5h 25m + 30m = 5h 55m -> 6h
    expect(paidMinutes(301)).toBe(345);
    expect(paidMinutes(0)).toBe(30);
  });

  it("pays the user's example: 5 hours and 25 deliveries", () => {
    expect(routePay(300, 25)).toEqual({ paidMinutes: 330, hourPay: 104.5, deliveryPay: 75, total: 179.5 });
  });

  it('averages per driver day and per delivery', () => {
    const { drivers, all } = driverSummaries([
      { date: '2026-11-17', driverName: 'Seattle', driverSerial: '001', plannedMinutes: 300, deliveries: 25 },
      { date: '2026-11-18', driverName: 'Seattle', driverSerial: '001', plannedMinutes: 300, deliveries: 25 },
      { date: '2026-11-17', driverName: 'Bellevue', driverSerial: '002', plannedMinutes: 240, deliveries: 20 },
      { date: '2026-11-19', driverName: 'Bellevue', driverSerial: '002', plannedMinutes: 100, deliveries: 0 }, // no deliveries: left out
    ]);
    expect(drivers.map((d) => [d.driver, d.days, d.payPerDay, d.costPerDelivery])).toEqual([
      ['Seattle', 2, 179.5, 7.18],
      ['Bellevue', 1, 145.5, 7.28],
    ]);
    expect(all.days).toBe(3);
    expect(all.pay).toBe(504.5);
    expect(all.costPerDelivery).toBe(7.21);
  });
});
