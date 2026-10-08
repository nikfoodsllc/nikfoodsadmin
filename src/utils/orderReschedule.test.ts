import { describe, it, expect } from 'vitest';
import { addDays, deliversBeforeKitchen, pacificToday, pickableRange, rescheduledFilterFor, rescheduleView, selectionKey, selectionList, whyNotReschedulable } from './orderReschedule';

const item = (name: string, quantity = 1, original?: string) => ({ quantity, originalDeliveryDate: original, food: { name } });
const order = (over: Record<string, unknown> = {}) => ({
  status: 'confirmed', paymentStatus: 'paid',
  items: [
    { day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-12', items: [item('Batter', 2), item('Sweets')] },
    { day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-15', items: [item('Pickle', 1, '2026-10-12')] },
  ],
  ...over,
});
const history = (at: string, by = 'Kunal') => ({ at, by: { name: by } });

describe('whyNotReschedulable', () => {
  it('allows paid confirmed / preparing / ready orders', () => {
    for (const s of ['confirmed', 'preparing', 'ready']) expect(whyNotReschedulable(order({ status: s }))).toBeNull();
  });
  it('refuses unpaid, refunded, failed, cancelled, out for delivery, delivered, no days', () => {
    for (const p of ['unpaid', 'refunded', 'failed']) expect(whyNotReschedulable(order({ paymentStatus: p }))).not.toBeNull();
    for (const s of ['pending', 'cancelled', 'out_for_delivery', 'delivered']) expect(whyNotReschedulable(order({ status: s }))).not.toBeNull();
    expect(whyNotReschedulable(order({ items: [] }))).not.toBeNull();
  });
});

describe('dates', () => {
  it('pacific today is the Pacific calendar day', () => {
    expect(pacificToday(new Date('2026-10-09T05:00:00Z'))).toBe('2026-10-08');
    expect(pacificToday(new Date('2026-10-09T08:00:00Z'))).toBe('2026-10-09');
  });
  it('range is today to 120 days ahead', () => {
    const r = pickableRange(new Date('2026-10-08T17:00:00Z'));
    expect(r.min).toBe('2026-10-08'); expect(r.max).toBe(addDays('2026-10-08', 120));
  });
  it('addDays crosses month and year ends', () => { expect(addDays('2026-12-31', 1)).toBe('2027-01-01'); expect(addDays('2026-10-31', 1)).toBe('2026-11-01'); });
});

describe('rescheduleView', () => {
  it('is not rescheduled without history', () => {
    expect(rescheduleView(order()).rescheduled).toBe(false);
    expect(rescheduleView(null).rescheduled).toBe(false);
    expect(rescheduleView(order({ reschedules: [] })).email).toBe('none');
  });
  it('groups the moved items by where they started and where they are now, and the email is pending', () => {
    const v = rescheduleView(order({ reschedules: [history('2026-10-08T17:00:00Z')] }));
    expect(v.rescheduled).toBe(true);
    expect(v.groups).toEqual([{ from: '2026-10-12', to: '2026-10-15', items: ['Pickle'] }]);
    expect(v.email).toBe('pending'); expect(v.lastBy).toBe('Kunal'); expect(v.summary).toContain('Mon, Oct 12'); expect(v.summary).toContain('Thu, Oct 15');
  });
  it('items that moved together are listed together, with quantities', () => {
    const o = order({ items: [{ day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-20', items: [item('Pickle', 3, '2026-10-12'), item('Batter', 1, '2026-10-12')] }], reschedules: [history('2026-10-08T17:00:00Z')] });
    expect(rescheduleView(o).groups).toEqual([{ from: '2026-10-12', to: '2026-10-20', items: ['3 x Pickle', 'Batter'] }]);
  });
  it('different starting dates make different groups', () => {
    const o = order({ items: [
      { day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-20', items: [item('A', 1, '2026-10-12')] },
      { day: 'Wednesday', deliveryDate: '2026-10-14', actualDeliveryDate: '2026-10-20', items: [item('B', 1, '2026-10-16')] },
    ], reschedules: [history('2026-10-08T17:00:00Z')] });
    expect(rescheduleView(o).groups.map((g) => `${g.from}>${g.to}`)).toEqual(['2026-10-12>2026-10-20', '2026-10-16>2026-10-20']);
  });
  it('email sent after the last move = sent; a later move makes it pending again', () => {
    const base = history('2026-10-08T17:00:00Z');
    const sent = rescheduleView(order({ reschedules: [base], rescheduleEmail: { sentAt: '2026-10-08T17:05:00Z', count: 1 } }));
    expect(sent.email).toBe('sent'); expect(sent.emailCount).toBe(1);
    const again = rescheduleView(order({ reschedules: [base, history('2026-10-08T18:00:00Z')], rescheduleEmail: { sentAt: '2026-10-08T17:05:00Z', count: 1 } }));
    expect(again.email).toBe('pending'); expect(again.moves).toBe(2);
  });
  it('everything back on its original date: still rescheduled (history) but no email is needed', () => {
    const back = rescheduleView(order({ items: [{ day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-12', items: [item('Pickle', 1, '2026-10-12')] }], reschedules: [history('2026-10-08T17:00:00Z'), history('2026-10-08T18:00:00Z')] }));
    expect(back.rescheduled).toBe(true); expect(back.groups).toEqual([]); expect(back.email).toBe('none'); expect(back.summary).toMatch(/original/);
  });
  it('copes with missing fields', () => {
    expect(rescheduleView({ reschedules: [{}] }).groups).toEqual([]);
    expect(rescheduleView({ items: [{ items: null }], reschedules: [{ at: 'bad' }] }).email).toBe('none');
  });
});

describe('selection helpers', () => {
  it('keys and lists round trip, sorted', () => {
    const keys = [selectionKey(1, 0), selectionKey(0, 2), selectionKey(0, 1)];
    expect(selectionList(keys)).toEqual([{ line: 0, item: 1 }, { line: 0, item: 2 }, { line: 1, item: 0 }]);
    expect(selectionList(['x:y', '1:'])).toEqual([]);
  });
  it('warns only when a picked item would arrive before its kitchen day', () => {
    const o = order();
    expect(deliversBeforeKitchen(o, [selectionKey(0, 0)], '2026-10-11')).toBe(true);
    expect(deliversBeforeKitchen(o, [selectionKey(0, 0)], '2026-10-12')).toBe(false);
    expect(deliversBeforeKitchen(o, [selectionKey(0, 0)], '2026-10-20')).toBe(false);
    expect(deliversBeforeKitchen(o, [], '2026-10-01')).toBe(false);
  });
});

describe('rescheduledFilterFor', () => {
  it('yes / no filter, anything else none', () => {
    expect(rescheduledFilterFor('yes')).toEqual({ 'reschedules.0': { $exists: true } });
    expect(rescheduledFilterFor('no')).toEqual({ 'reschedules.0': { $exists: false } });
    for (const v of ['all', '', null, undefined, '$ne', 'YES']) expect(rescheduledFilterFor(v as never)).toBeNull();
  });
});
