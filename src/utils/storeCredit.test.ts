import { describe, expect, it } from 'vitest';
import { centsToMoney, creditForItemCents, creditLeft, creditPicks, creditedQuantities, whyNotCreditable } from './storeCredit';

const order = {
  status: 'delivered',
  paymentStatus: 'paid',
  paymentMethod: 'Credit Card',
  user: 'u1',
  items: [{ items: [{ quantity: 2, price: 10, food: { name: 'A' } }, { quantity: 1, price: 30, food: { name: 'B' } }] }],
  creditsIssued: [{ items: [{ line: 0, item: 0, quantity: 1 }] }],
};

describe('item credit', () => {
  it('is price x quantity plus 10.3% tax', () => {
    expect(creditForItemCents(20, 1)).toBe(2206);
    expect(creditForItemCents(5.99, 2)).toBe(1321);
    expect(creditForItemCents(10, 0)).toBe(0);
  });
  it('knows what was credited and what is left', () => {
    expect(creditedQuantities(order).get('0:0')).toBe(1);
    expect(creditLeft(order, 0, 0)).toBe(1);
    expect(creditLeft(order, 0, 1)).toBe(1);
    expect(creditLeft(order, 4, 0)).toBe(0);
  });
  it('picks default to everything that is left and never exceed it', () => {
    const picks = creditPicks(order, ['0:1', '0:0']);
    expect(picks.map((p) => [p.item, p.quantity, p.cents])).toEqual([[0, 1, 1103], [1, 1, 3309]]);
    expect(creditPicks(order, ['0:0'], { '0:0': 5 })[0].quantity).toBe(1);
    expect(creditPicks({ ...order, creditsIssued: [{ items: [{ line: 0, item: 1, quantity: 1 }] }] }, ['0:1'])).toEqual([]);
  });
  it('refuses orders that cannot be credited', () => {
    expect(whyNotCreditable(order)).toBeNull();
    expect(whyNotCreditable({ ...order, paymentStatus: 'unpaid' })).toMatch(/paid/);
    expect(whyNotCreditable({ ...order, status: 'cancelled' })).toMatch(/cancelled/);
    expect(whyNotCreditable({ ...order, paymentMethod: 'Quote' })).toMatch(/quote/);
    expect(whyNotCreditable({ ...order, user: null })).toMatch(/account/);
  });
  it('formats money', () => {
    expect(centsToMoney(2206)).toBe('$22.06');
  });
});
