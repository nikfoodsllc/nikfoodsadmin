import { describe, it, expect } from 'vitest';
import { addDays, pacificToday, pickableRange, rescheduleView, whyNotReschedulable } from './orderReschedule';

const order = (over: Record<string, unknown> = {}) => ({
  status: 'confirmed', paymentStatus: 'paid',
  items: [{ day: 'Friday', deliveryDate: '2026-10-09', actualDeliveryDate: '2026-10-09' }, { day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-12' }],
  ...over,
});
const change = (index: number, from: string, to: string) => ({ index, fromDay: '', toDay: '', fromMenuDate: from, fromDeliveryDate: from, toDate: to });

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
    expect(pacificToday(new Date('2026-10-09T05:00:00Z'))).toBe('2026-10-08'); // 10 PM PT on the 8th
    expect(pacificToday(new Date('2026-10-09T08:00:00Z'))).toBe('2026-10-09'); // 1 AM PT on the 9th
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
  it('shows original to current and a pending email', () => {
    const v = rescheduleView(order({ reschedules: [{ at: '2026-10-08T17:00:00Z', by: { name: 'Kunal' }, changes: [change(0, '2026-10-08', '2026-10-09')] }] }));
    expect(v.rescheduled).toBe(true); expect(v.lines).toEqual([{ index: 0, from: '2026-10-08', to: '2026-10-09' }]);
    expect(v.email).toBe('pending'); expect(v.lastBy).toBe('Kunal'); expect(v.summary).toContain('Thu, Oct 8'); expect(v.summary).toContain('Fri, Oct 9');
  });
  it('email sent after the last move = sent; a later move makes it pending again', () => {
    const base = { at: '2026-10-08T17:00:00Z', changes: [change(0, '2026-10-08', '2026-10-09')] };
    const sent = rescheduleView(order({ reschedules: [base], rescheduleEmail: { sentAt: '2026-10-08T17:05:00Z', count: 1 } }));
    expect(sent.email).toBe('sent'); expect(sent.emailCount).toBe(1);
    const again = rescheduleView(order({ reschedules: [base, { at: '2026-10-08T18:00:00Z', changes: [change(1, '2026-10-12', '2026-10-12')] }], rescheduleEmail: { sentAt: '2026-10-08T17:05:00Z', count: 1 } }));
    expect(again.email).toBe('pending');
  });
  it('moved twice shows the first original date, and back on the original date shows none', () => {
    const twice = rescheduleView(order({ items: [{ day: 'Monday', deliveryDate: '2026-10-12', actualDeliveryDate: '2026-10-12' }], reschedules: [
      { at: '2026-10-08T17:00:00Z', changes: [change(0, '2026-10-08', '2026-10-09')] }, { at: '2026-10-08T18:00:00Z', changes: [change(0, '2026-10-09', '2026-10-12')] }] }));
    expect(twice.lines).toEqual([{ index: 0, from: '2026-10-08', to: '2026-10-12' }]);
    const back = rescheduleView(order({ items: [{ day: 'Thursday', deliveryDate: '2026-10-08', actualDeliveryDate: '2026-10-08' }], reschedules: [
      { at: '2026-10-08T17:00:00Z', changes: [change(0, '2026-10-08', '2026-10-09')] }, { at: '2026-10-08T18:00:00Z', changes: [change(0, '2026-10-09', '2026-10-08')] }] }));
    expect(back.rescheduled).toBe(true); expect(back.lines).toEqual([]); expect(back.email).toBe('none'); expect(back.summary).toMatch(/original/);
  });
  it('copes with missing fields', () => {
    expect(rescheduleView({ reschedules: [{ changes: null }] }).lines).toEqual([]);
    expect(rescheduleView({ items: [], reschedules: [{ at: 'bad', changes: [change(5, '2026-10-08', '2026-10-09')] }] }).email).toBe('none');
  });
});

import { rescheduledFilterFor } from './orderReschedule';
describe('rescheduledFilterFor', () => {
  it('yes / no filter, anything else none', () => {
    expect(rescheduledFilterFor('yes')).toEqual({ 'reschedules.0': { $exists: true } });
    expect(rescheduledFilterFor('no')).toEqual({ 'reschedules.0': { $exists: false } });
    for (const v of ['all', '', null, undefined, '$ne', 'YES']) expect(rescheduledFilterFor(v as never)).toBeNull();
  });
});
