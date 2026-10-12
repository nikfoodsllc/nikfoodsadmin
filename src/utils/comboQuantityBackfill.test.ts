import { describe, expect, it } from 'vitest';
import { isLiveOrder, planOrderChanges, summarizeChanges, type CurrentCombo, type OrderLike } from './comboQuantityBackfill';

const combo: CurrentCombo = {
  id: 'c1',
  sections: [
    { _id: 's1', title: 'Curry', options: [{ itemId: 'kale', quantity: 1 }] },
    { _id: 's3', title: 'Choice of Staple', options: [{ itemId: 'chapati', quantity: 4 }, { itemId: 'rice', quantity: 1 }] },
  ],
};
const combos = new Map([['c1', combo]]);
const line = (extra: Record<string, unknown> = {}) => ({
  food: {
    _id: 'c1', name: 'Veg Combo', hasCombo: true,
    sections: [
      { _id: 's1', title: 'Curry', selectedItems: [{ item: { _id: 'kale' } }] },
      { _id: 's3', title: 'Choice of Staple', selectedItems: [{ item: { _id: 'chapati' }, ...extra }, { item: { _id: 'rice' } }] },
    ],
  },
});
const order = (over: Partial<OrderLike> = {}, day: Record<string, unknown> = {}): OrderLike => ({ orderId: 'ORD-1', status: 'confirmed', paymentStatus: 'paid', items: [{ deliveryDate: '2026-10-15', items: [line()], ...day }], ...over });

describe('planOrderChanges', () => {
  it('sets the combo quantity on the option whose frozen copy has none, and only there', () => {
    const [change, ...rest] = planOrderChanges(order(), combos, '2026-10-13');
    expect(rest).toEqual([]);
    expect(change).toMatchObject({ orderId: 'ORD-1', combo: 'Veg Combo', quantity: 4, path: 'items.0.items.0.food.sections.1.selectedItems.0.quantity', guardPath: 'items.0.items.0.food.sections.1.selectedItems.0.item._id', guardId: 'chapati' });
  });
  it('leaves an option that was ordered with a quantity alone', () => {
    expect(planOrderChanges({ ...order(), items: [{ deliveryDate: '2026-10-15', items: [line({ quantity: 2 })] }] }, combos, '2026-10-13')).toEqual([]);
  });
  it('never touches past deliveries, using the real delivery day when the day was combined into another', () => {
    expect(planOrderChanges(order({}, { deliveryDate: '2026-10-10' }), combos, '2026-10-13')).toEqual([]);
    expect(planOrderChanges(order({}, { deliveryDate: '2026-10-10', actualDeliveryDate: '2026-10-14' }), combos, '2026-10-13')).toHaveLength(1);
    expect(planOrderChanges(order({}, { deliveryDate: '2026-10-16', actualDeliveryDate: '2026-10-12' }), combos, '2026-10-13')).toEqual([]);
    expect(planOrderChanges(order({}, { deliveryDate: '2026-10-13' }), combos, '2026-10-13')).toHaveLength(1); // today counts
  });
  it('skips orders that do not go out', () => {
    for (const status of ['cancelled', 'delivered', 'failed']) expect(planOrderChanges(order({ status }), combos, '2026-10-13')).toEqual([]);
    expect(planOrderChanges(order({ paymentStatus: 'refunded' }), combos, '2026-10-13')).toEqual([]);
    expect(isLiveOrder({ status: 'preparing', paymentStatus: 'paid' })).toBe(true);
  });
  it('skips combos that now say 1, unknown combos and options no longer in the combo', () => {
    const none = new Map([['c1', { ...combo, sections: combo.sections.map((s) => ({ ...s, options: s.options.map((o) => ({ ...o, quantity: 1 })) })) }]]);
    expect(planOrderChanges(order(), none, '2026-10-13')).toEqual([]);
    expect(planOrderChanges(order(), new Map(), '2026-10-13')).toEqual([]);
    const removed = new Map([['c1', { ...combo, sections: [{ _id: 's3', title: 'Choice of Staple', options: [{ itemId: 'rice', quantity: 3 }] }] }]]);
    expect(planOrderChanges(order(), removed, '2026-10-13').map((c) => c.guardId)).toEqual(['rice']);
  });
  it('matches a section by title when its id changed', () => {
    const renamed = new Map([['c1', { ...combo, sections: combo.sections.map((s) => ({ ...s, _id: `new-${s._id}` })) }]]);
    expect(planOrderChanges(order(), renamed, '2026-10-13')).toHaveLength(1);
  });
  it('is the same when run twice on the result (nothing left to change)', () => {
    const o = order();
    const [c] = planOrderChanges(o, combos, '2026-10-13');
    (o.items![0].items![0].food!.sections![1].selectedItems![0] as { quantity?: number }).quantity = c.quantity;
    expect(planOrderChanges(o, combos, '2026-10-13')).toEqual([]);
  });
  it('several days and several combos in one order', () => {
    const o: OrderLike = { orderId: 'ORD-2', status: 'confirmed', paymentStatus: 'paid', items: [{ deliveryDate: '2026-10-15', items: [line(), line()] }, { deliveryDate: '2026-10-16', items: [line()] }] };
    expect(planOrderChanges(o, combos, '2026-10-13')).toHaveLength(3);
  });
});

describe('summarizeChanges', () => {
  it('counts options, orders and combos', () => {
    const a = planOrderChanges(order(), combos, '2026-10-13');
    const b = planOrderChanges({ ...order(), orderId: 'ORD-9' }, combos, '2026-10-13');
    const s = summarizeChanges([...a, ...b], 5);
    expect(s).toEqual({ ordersChecked: 5, ordersToChange: 2, optionsToChange: 2, byCombo: [{ combo: 'Veg Combo', options: 2, orders: 2 }], orderIds: ['ORD-1', 'ORD-9'] });
  });
});
