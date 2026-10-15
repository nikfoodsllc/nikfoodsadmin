import { describe, expect, it } from 'vitest';
import { orderDraftLines } from './checkoutOrderDraft';

describe('orderDraftLines', () => {
  it('keeps the picks of each saved cart line', () => {
    const lines = orderDraftLines([
      { date: '2026-10-16', foodItem: { _id: 'abc' }, quantity: 2, selectedPortion: '12Oz', selectedSpiceLevel: 'Medium', isEcoFriendlyContainer: true, comboSelections: { s1: ['o1'], s2: [] }, notes: 'no onion' },
      { date: '2026-10-16T00:00:00.000Z', foodItem: { _id: 7 }, quantity: 1 },
    ]);
    expect(lines).toEqual([
      { date: '2026-10-16', foodItemId: 'abc', quantity: 2, selectedPortion: '12Oz', selectedSpiceLevel: 'Medium', isEcoFriendlyContainer: true, comboSelections: { s1: ['o1'] }, notes: 'no onion' },
      { date: '2026-10-16', foodItemId: '7', quantity: 1 },
    ]);
  });
  it('skips lines without an item or a day, and keeps the quantity sensible', () => {
    expect(orderDraftLines([{ date: '2026-10-16', quantity: 1 }, { foodItem: { _id: 'x' }, quantity: 1 }])).toEqual([]);
    expect(orderDraftLines([{ date: '2026-10-16', foodItem: { _id: 'x' }, quantity: 500 }])[0].quantity).toBe(99);
    expect(orderDraftLines([{ date: '2026-10-16', foodItem: { _id: 'x' }, quantity: 0 }])[0].quantity).toBe(1);
    expect(orderDraftLines(undefined)).toEqual([]);
  });
});
