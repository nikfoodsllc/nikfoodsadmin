import { describe, expect, it } from 'vitest';
import { withoutCreditedItems } from './creditAdjust';

const order = {
  items: [
    { items: [{ quantity: 2 }, { quantity: 1 }] },
    { items: [{ quantity: 3 }] },
  ],
  creditsIssued: [{ items: [{ line: 0, item: 0, quantity: 1 }, { line: 0, item: 1, quantity: 1 }] }, { items: [{ line: 1, item: 0, quantity: 3 }] }],
};

describe('withoutCreditedItems', () => {
  it('lowers a partly credited item, drops a fully credited item and a day left with nothing', () => {
    const out = withoutCreditedItems(order);
    expect(out.items).toEqual([{ items: [{ quantity: 1 }] }]);
  });
  it('leaves an order without credit alone, and an entirely credited order has no days left', () => {
    const plain = { items: [{ items: [{ quantity: 2 }] }] };
    expect(withoutCreditedItems(plain)).toBe(plain);
    const all = withoutCreditedItems({ ...order, creditsIssued: [{ items: [{ line: 0, item: 0, quantity: 2 }, { line: 0, item: 1, quantity: 1 }, { line: 1, item: 0, quantity: 3 }] }] });
    expect(all.items).toEqual([]);
  });
});
