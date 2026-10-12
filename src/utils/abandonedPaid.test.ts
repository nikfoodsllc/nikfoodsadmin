import { describe, expect, it } from 'vitest';
import { buildPaidRows } from './abandonedPaid';
import type { DraftDoc } from './abandonedCheckouts';

const at = (min: number) => new Date(Date.UTC(2026, 9, 10, 12) + min * 60000);
const draft = (over: Partial<DraftDoc> & { userId: string }): DraftDoc => ({
  paymentIntentId: 'pi_' + over.userId, status: 'open', total: 40, createdAt: at(0), lastActivityAt: at(0),
  customer: { name: 'Priya S', email: 'p@example.invalid', phone: '2065550100' },
  items: [{ date: '2026-10-13', name: 'Rajma', quantity: 2, unitPrice: 8, lineTotal: 16 }], ...over,
});
const order = (user: string, min: number, total = 45.5, id = 'ORD-' + user) => ({ orderId: id, user, createdAt: at(min), totalPaid: total });

describe('paid tab (people who left and then paid)', () => {
  it('lists someone who left, came back later and paid, with what they left', () => {
    const rows = buildPaidRows([draft({ userId: 'a' })], [order('a', 300)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderId: 'ORD-a', name: 'Priya S', amount: 45.5, reason: 'own' });
    expect(rows[0].items[0].name).toBe('Rajma');
    expect(rows[0].leftAt).toBe(at(0).toISOString());
  });

  it('does not list a normal buyer who paid within the quiet time (changed their cart and paid)', () => {
    const first = draft({ userId: 'b', status: 'superseded', lastActivityAt: at(0) });
    expect(buildPaidRows([first], [order('b', 3)])).toHaveLength(0);
    expect(buildPaidRows([draft({ userId: 'b', status: 'converted', lastActivityAt: at(0) })], [order('b', 3)])).toHaveLength(0);
  });

  it('needs the order to be after the checkout, and leaves out people with no paid order and hidden people', () => {
    expect(buildPaidRows([draft({ userId: 'c', createdAt: at(100), lastActivityAt: at(100) })], [order('c', 50)])).toHaveLength(0);
    expect(buildPaidRows([draft({ userId: 'd' })], [])).toHaveLength(0);
    expect(buildPaidRows([draft({ userId: 'e', dismissedAt: at(5) })], [order('e', 300)])).toHaveLength(0);
  });

  it('says what brought them back: the reminder button, the reminder, your call, or nothing', () => {
    const base = { userId: 'f' };
    const click = buildPaidRows([draft({ ...base, reminderEmail: { status: 'delivered', sentAt: at(40), firstOpenedAt: at(50), firstClickedAt: at(60) } })], [order('f', 100)])[0];
    expect(click).toMatchObject({ reason: 'reminder_click', reminder: { opened: true, clicked: true } });
    const open = buildPaidRows([draft({ ...base, reminderEmail: { status: 'delivered', sentAt: at(40), firstOpenedAt: at(50) } })], [order('f', 100)])[0];
    expect(open).toMatchObject({ reason: 'reminder', reminder: { opened: true, clicked: false } });
    const called = buildPaidRows([draft({ ...base, contacted: { at: at(30), by: 'Kunal', note: 'Called' } })], [order('f', 100)])[0];
    expect(called).toMatchObject({ reason: 'contacted', contacted: { by: 'Kunal', note: 'Called' } });
    // a reminder or a call that came AFTER they paid did not bring them back
    const late = buildPaidRows([draft({ ...base, contacted: { at: at(500) }, reminderEmail: { status: 'delivered', sentAt: at(500), firstClickedAt: at(510) } })], [order('f', 100)])[0];
    expect(late.reason).toBe('own');
    expect(late.reminder).toBeUndefined();
  });

  it('shows the newest payment first and uses the first order after they left', () => {
    const rows = buildPaidRows(
      [draft({ userId: 'g' }), draft({ userId: 'h', customer: { name: 'Raj' } })],
      [order('g', 200, 10, 'ORD-g1'), order('g', 900, 99, 'ORD-g2'), order('h', 400)]
    );
    expect(rows.map((r) => r.orderId)).toEqual(['ORD-h', 'ORD-g1']);
    expect(rows[1].amount).toBe(10);
  });
});
