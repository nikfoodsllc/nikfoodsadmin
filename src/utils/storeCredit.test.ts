import { describe, expect, it } from 'vitest';
import { centsToMoney, creditForFeeCents, creditForItemCents, creditLeft, entireOrderPreview, feeCreditCents, creditPicks, creditedQuantities, whyNotCreditable } from './storeCredit';

const order = {
  status: 'delivered',
  paymentStatus: 'paid',
  paymentMethod: 'Credit Card',
  user: 'u1',
  items: [{ items: [{ quantity: 2, price: 10, food: { name: 'A' } }, { quantity: 1, price: 30, food: { name: 'B' } }] }],
  creditsIssued: [{ items: [{ line: 0, item: 0, quantity: 1 }] }],
};

describe('item credit', () => {
  it('is price x quantity, with the 10.3% tax only when asked', () => {
    expect(creditForItemCents(20, 1)).toBe(2000);
    expect(creditForItemCents(5.99, 2)).toBe(1198);
    expect(creditForItemCents(20, 1, true)).toBe(2206);
    expect(creditForItemCents(5.99, 2, true)).toBe(1321);
    expect(creditForItemCents(10, 0)).toBe(0);
  });
  it('credits the Platform Fee with its tax once', () => {
    expect(creditForFeeCents(1.75)).toBe(193);
    expect(feeCreditCents({ ...order, platformFee: 1.75 })).toBe(193);
    expect(feeCreditCents({ ...order, platformFee: 1.75, platformFeeWaived: true })).toBe(0);
    expect(feeCreditCents({ ...order, platformFee: 1.75, creditsIssued: [{ fee: 1.93, items: [] }] })).toBe(0);
  });
  it('previews crediting the entire order', () => {
    const p = entireOrderPreview({ ...order, platformFee: 1.75, tip: 2 });
    expect(p.feeCents).toBe(193);
    expect(p.tipCents).toBe(200);
    expect(p.totalCents).toBe(p.itemsCents + 193 + 200);
    const again = entireOrderPreview({ ...order, platformFee: 1.75, tip: 2, creditsIssued: [{ fee: 1.93, tip: 2, items: [] }] });
    expect(again.feeCents + again.tipCents).toBe(0);
  });
  it('knows what was credited and what is left', () => {
    expect(creditedQuantities(order).get('0:0')).toBe(1);
    expect(creditLeft(order, 0, 0)).toBe(1);
    expect(creditLeft(order, 0, 1)).toBe(1);
    expect(creditLeft(order, 4, 0)).toBe(0);
  });
  it('picks default to everything that is left and never exceed it', () => {
    const picks = creditPicks(order, ['0:1', '0:0']);
    expect(picks.map((p) => [p.item, p.quantity, p.cents])).toEqual([[0, 1, 1000], [1, 1, 3000]]);
    expect(creditPicks(order, ['0:1', '0:0'], {}, true).map((p) => p.cents)).toEqual([1103, 3309]);
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
