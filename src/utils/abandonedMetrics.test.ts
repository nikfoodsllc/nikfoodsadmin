import { describe, expect, it } from 'vitest';
import { computeMetrics, type MetricsDraft } from './abandonedMetrics';

const at = (h: number) => new Date(Date.UTC(2026, 9, 10, h));
const d = (over: Partial<MetricsDraft> & { userId: string }): MetricsDraft => ({
  status: 'open', createdAt: at(1), lastActivityAt: at(1), total: 40, items: [{ name: 'Veg Combo', quantity: 2 }], ...over,
});

describe('abandoned metrics', () => {
  it('is all zeros and no rates when nobody opened checkout', () => {
    const m = computeMetrics([], []);
    expect(m).toMatchObject({ started: 0, completed: 0, abandoned: 0, conversionRate: null, cartValue: 0, averageCart: 0 });
    expect(m.reminders.sent).toBe(0);
    expect(m.reminders.recoveredRate).toBeNull();
    expect(m.topItems).toEqual([]);
  });

  it('counts people, not checkouts, and works out the conversion', () => {
    const m = computeMetrics([
      d({ userId: 'a' }), d({ userId: 'a', createdAt: at(2), lastActivityAt: at(2) }), // one person, two checkouts, never paid
      d({ userId: 'b', status: 'converted' }),
      d({ userId: 'c', status: 'superseded' }), d({ userId: 'c', status: 'converted' }), // paid with a later checkout
      d({ userId: 'e' }),
    ], []);
    expect(m).toMatchObject({ started: 4, completed: 2, abandoned: 2, conversionRate: 50 });
  });

  it('values the latest cart of each abandoned person', () => {
    const m = computeMetrics([
      d({ userId: 'a', total: 10, lastActivityAt: at(1) }),
      d({ userId: 'a', total: 30, createdAt: at(2), lastActivityAt: at(2) }),
      d({ userId: 'b', total: 20 }),
    ], []);
    expect(m.cartValue).toBe(50);
    expect(m.averageCart).toBe(25);
  });

  it('leaves out hidden people unless they paid, and counts people who pressed Pay or were contacted', () => {
    const m = computeMetrics([
      d({ userId: 'hidden', dismissedAt: at(3) }),
      d({ userId: 'paid', dismissedAt: at(3), status: 'converted' }),
      d({ userId: 'pay', orderId: 'ORD-1' }),
      d({ userId: 'call', contacted: { at: at(5) } }),
    ], []);
    expect(m).toMatchObject({ started: 3, completed: 1, abandoned: 2, triedToPay: 1, contacted: 1 });
  });

  it('lists the most abandoned items by units', () => {
    const m = computeMetrics([
      d({ userId: 'a', items: [{ name: 'Rajma', quantity: 3 }, { name: 'Dosa Batter', quantity: 1 }] }),
      d({ userId: 'b', items: [{ name: 'Rajma', quantity: 2 }, { name: 'Dosa Batter', quantity: 1 }, { name: 'Rajma', quantity: 1 }] }),
    ], []);
    expect(m.topItems[0]).toEqual({ name: 'Rajma', units: 6, people: 2 });
    expect(m.topItems[1]).toEqual({ name: 'Dosa Batter', units: 2, people: 2 });
  });

  it('builds the reminder funnel and the recovery', () => {
    const r = (over: object) => ({ status: 'delivered', sentAt: at(6), deliveredAt: at(6), ...over });
    const drafts = [
      d({ userId: 'a', reminderEmail: r({ firstOpenedAt: at(7), firstClickedAt: at(8) }) }),
      d({ userId: 'b', reminderEmail: r({ firstOpenedAt: at(7) }) }),
      d({ userId: 'c', reminderEmail: r({}) }),
      d({ userId: 'e', reminderEmail: { status: 'bounced', sentAt: at(6) } }),
      d({ userId: 'f', reminderEmail: { status: 'failed' } }), // never sent
      d({ userId: 'g' }),
    ];
    const orders = [
      { user: 'a', createdAt: at(9), totalPaid: 55.5 },        // ordered after the reminder: recovered
      { user: 'b', createdAt: at(5), totalPaid: 99 },           // ordered BEFORE the reminder: not recovered
      { user: 'c', createdAt: new Date(at(6).getTime() + 8 * 24 * 3600 * 1000), totalPaid: 70 }, // too late
    ];
    const m = computeMetrics(drafts, orders);
    expect(m.reminders).toMatchObject({ sent: 4, delivered: 3, opened: 2, clicked: 1, problems: 1, recovered: 1, recoveredRevenue: 55.5, deliveredRate: 75, openedRate: 50, clickedRate: 25, recoveredRate: 25 });
  });

  it('counts a person reminded twice once, and an admin resend does not double the funnel', () => {
    const m = computeMetrics([
      d({ userId: 'a', reminderEmail: { status: 'delivered', sentAt: at(6), deliveredAt: at(6) } }),
      d({ userId: 'a', createdAt: at(3), reminderEmail: { status: 'delivered', sentAt: at(9), deliveredAt: at(9), firstOpenedAt: at(10) } }),
    ], [{ user: 'a', createdAt: at(12), totalPaid: 20 }]);
    expect(m.reminders).toMatchObject({ sent: 1, delivered: 1, opened: 1, recovered: 1 });
  });

  it('counts someone as completed when a paid order of theirs is newer than their latest checkout (same rule as the list)', () => {
    const m = computeMetrics([
      d({ userId: 'a', createdAt: at(2) }),                 // ordered later, even though this checkout was never marked paid
      d({ userId: 'b', createdAt: at(8) }),                 // their only order was BEFORE this checkout: still abandoned
      d({ userId: 'c', createdAt: at(2) }),
      d({ userId: 'c', createdAt: at(9) }),                 // paid between their two checkouts: the latest one is abandoned
    ], [
      { user: 'a', createdAt: at(4), totalPaid: 10 },
      { user: 'b', createdAt: at(3), totalPaid: 10 },
      { user: 'c', createdAt: at(5), totalPaid: 10 },
    ]);
    expect(m).toMatchObject({ started: 3, completed: 1, abandoned: 2 });
  });

  it('lists who ordered after the email (successful) and who did not (unsuccessful), as shares of the people emailed', () => {
    const r = { status: 'delivered', sentAt: at(6), deliveredAt: at(6) };
    const m = computeMetrics(
      [
        d({ userId: 'a', customer: { name: 'Asha K', email: 'a@x.invalid' }, reminderEmail: r }),
        d({ userId: 'b', customer: { name: 'Bo L' }, total: 55, items: [{ name: 'Rajma', quantity: 2 }, { name: 'Chapati', quantity: 1 }], reminderEmail: r }),
        d({ userId: 'c', customer: { email: 'cat@x.invalid' }, reminderEmail: r }),
        d({ userId: 'e', customer: { name: 'Not emailed' } }),
      ],
      [{ orderId: 'ORD-1', user: 'a', createdAt: at(9), totalPaid: 41.25 }]
    );
    expect(m.conversions.successfulRate).toBe(33.3);
    expect(m.conversions.unsuccessfulRate).toBe(66.7);
    expect(m.conversions.successful).toHaveLength(1);
    expect(m.conversions.successful[0]).toMatchObject({ userId: 'a', name: 'Asha K', order: { orderId: 'ORD-1', amount: 41.25 } });
    expect(m.conversions.unsuccessful.map((p) => p.name).sort()).toEqual(['Bo L', 'cat']);
    expect(m.conversions.unsuccessful.find((p) => p.userId === 'b')?.cart).toEqual({ total: 55, itemCount: 3, items: [{ name: 'Rajma', quantity: 2 }, { name: 'Chapati', quantity: 1 }] });
  });

  it('has no conversion rates when nobody was emailed', () => {
    const m = computeMetrics([d({ userId: 'a' })], []);
    expect(m.conversions).toEqual({ successful: [], unsuccessful: [], successfulRate: null, unsuccessfulRate: null });
  });

  it('Most left behind lists people with the biggest carts, not items', () => {
    const m = computeMetrics(
      [
        d({ userId: 'a', customer: { name: 'Asha' }, total: 20 }),
        d({ userId: 'b', customer: { name: 'Bo' }, total: 90, items: [{ name: 'X', quantity: 2 }, { name: 'Y', quantity: 3 }] }),
        d({ userId: 'c', customer: { name: 'Cy' }, total: 40 }),
        d({ userId: 'p', customer: { name: 'Paid' }, total: 500 }),
      ],
      [{ user: 'p', createdAt: at(5), totalPaid: 500 }]
    );
    expect(m.topPeople.map((p) => [p.name, p.total, p.itemCount])).toEqual([['Bo', 90, 5], ['Cy', 40, 2], ['Asha', 20, 2]]);
    expect(m.topPeople[0].userId).toBe('b');
  });
});
