import { describe, expect, it } from 'vitest';
import {
  addLine,
  estimateUnitPrice,
  itemGroupsForDay,
  lineSignature,
  lineTags,
  missingForCreate,
  needsOptions,
  pickProblem,
  rowsForTab,
  type OrderListRow,
  setLineQuantity,
  type MenuItem,
  type MenuPayload,
} from './createOrder';

const rajma: MenuItem = { _id: 'r', name: 'Rajma', price: 8, portions: ['8Oz', '12Oz'], portionPrices: [8, 11], hasSpiceLevel: true, spiceLevel: ['Mild', 'Normal'], isEcoFriendlyContainer: true, ecoContainerCharge: 0.75 };
const combo: MenuItem = {
  _id: 'c', name: 'Veg Combo', price: 25, hasCombo: true, isEcoFriendlyContainer: true, ecoContainerCharge: 1.5,
  sections: [
    { _id: 's1', title: 'Curry', isRequired: true, minSelection: 1, maxSelection: 1, selectedItems: [{ _id: 'o1', item: { name: 'Kale Chane' }, portion: '12Oz', price: 0 }, { _id: 'o2', item: { name: 'Paneer' }, price: 2 }] },
  ],
};
const flat: MenuItem = { _id: 'f', name: 'Batter', price: 18 };

describe('estimateUnitPrice', () => {
  it('uses the portion price, adds eco and priced combo options', () => {
    expect(estimateUnitPrice(rajma, { selectedPortion: '12Oz' })).toBe(11);
    expect(estimateUnitPrice(rajma, { selectedPortion: '8Oz', isEcoFriendlyContainer: true })).toBe(8.75);
    expect(estimateUnitPrice(combo, { isEcoFriendlyContainer: true, comboSelections: { s1: ['o2'] } })).toBe(28.5);
    expect(estimateUnitPrice(flat, {})).toBe(18);
  });
});

describe('pickProblem / needsOptions', () => {
  it('asks for the choices an item needs', () => {
    expect(pickProblem(rajma, {})).toBe('Choose a size');
    expect(pickProblem(rajma, { selectedPortion: '8Oz' })).toBe('Choose a spice level');
    expect(pickProblem(rajma, { selectedPortion: '8Oz', selectedSpiceLevel: 'Mild' })).toBeNull();
    expect(pickProblem(combo, {})).toBe('Choose at least 1 for Curry');
    expect(pickProblem(combo, { comboSelections: { s1: ['o1', 'o2'] } })).toBe('Choose no more than 1 for Curry');
    expect(pickProblem(flat, {})).toBeNull();
  });
  it('only items with choices open the dialog', () => {
    expect(needsOptions(flat)).toBe(false);
    expect(needsOptions(rajma)).toBe(true);
    expect(needsOptions(combo)).toBe(true);
  });
});

describe('lines', () => {
  const base = { date: '2026-10-09', foodItemId: 'f', quantity: 1, name: 'Batter', unitPrice: 18, tags: [] };
  it('the same pick is one line with a bigger quantity, a different option is a new line', () => {
    let lines = addLine([], base);
    lines = addLine(lines, { ...base, quantity: 2 });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
    lines = addLine(lines, { ...base, date: '2026-10-08' });
    lines = addLine(lines, { ...base, notes: 'less salt' });
    expect(lines).toHaveLength(3);
  });
  it('combo choice order does not matter and quantity is capped', () => {
    const a = lineSignature({ date: 'd', foodItemId: 'c', quantity: 1, comboSelections: { s1: ['b', 'a'] } });
    const b = lineSignature({ date: 'd', foodItemId: 'c', quantity: 1, comboSelections: { s1: ['a', 'b'] } });
    expect(a).toBe(b);
    const lines = addLine(addLine([], { ...base, quantity: 98 }), { ...base, quantity: 5 });
    expect(lines[0].quantity).toBe(99);
  });
  it('setting the quantity to 0 removes the line', () => {
    const lines = addLine([], base);
    expect(setLineQuantity(lines, lines[0].key, 0)).toHaveLength(0);
    expect(setLineQuantity(lines, lines[0].key, 4)[0].quantity).toBe(4);
  });
});

describe('lineTags', () => {
  it('shows size, spice, eco and combo choices by name', () => {
    expect(lineTags(combo, { isEcoFriendlyContainer: true, comboSelections: { s1: ['o1'] } })).toEqual(['Eco container', 'Curry: Kale Chane (12Oz)']);
    expect(lineTags(rajma, { selectedPortion: '8Oz', selectedSpiceLevel: 'Mild' })).toEqual(['8Oz', 'Mild']);
  });
});

describe('itemGroupsForDay', () => {
  const menu: MenuPayload = {
    openDates: ['2026-10-08', '2026-10-09'],
    dates: [
      { date: '2026-10-08', flatCategoryEnabled: true, dayWiseCategoryEnabled: true },
      { date: '2026-10-09', flatCategoryEnabled: false, dayWiseCategoryEnabled: true },
    ],
    categoryItems: {
      a: { _id: 'a', name: 'Food Menu', listingType: 'day-wise', foodItems: [], dayWiseItems: { '2026-10-08': [rajma], '2026-10-09': [combo] } },
      b: { _id: 'b', name: 'Batters', listingType: 'flat', foodItems: [flat], dayWiseItems: null },
    },
  };
  it('flat items every enabled day, day-wise items on their date only', () => {
    expect(itemGroupsForDay(menu, '2026-10-08').map((g) => g.category)).toEqual(['Food Menu', 'Batters']);
    expect(itemGroupsForDay(menu, '2026-10-09').map((g) => g.category)).toEqual(['Food Menu']);
    expect(itemGroupsForDay(menu, '2026-12-01')).toEqual([]);
  });
});

describe('missingForCreate', () => {
  const customer = { name: 'Asha Rao', email: 'asha@example.com', phone: '(206) 555-0199' };
  const address = { street_address: '400 Broad Street', apartment: '', city: 'Seattle', postal_code: '98109', entrance: '', floor: '' };
  it('lists what is missing, nothing when complete', () => {
    expect(missingForCreate(customer, address, 1)).toEqual([]);
    expect(missingForCreate({ name: '', email: 'x', phone: '12' }, { ...address, postal_code: '9', street_address: '' }, 0)).toEqual([
      'Customer name', 'A valid customer email', 'A 10 digit phone number', 'Street address', 'A 5 digit zip code', 'At least one item',
    ]);
  });
  it('accepts a leading 1 on the phone number', () => {
    expect(missingForCreate({ ...customer, phone: '1-206-555-0199' }, address, 1)).toEqual([]);
  });
});

describe('rowsForTab', () => {
  const row = (orderId: string, createdAt: string, over: Partial<OrderListRow> = {}): OrderListRow => ({
    orderId, createdAt, customerName: 'A', customerEmail: 'a@x.com', total: 10, status: 'pending', paymentStatus: 'unpaid', paymentMethod: 'Credit Card',
    linkOrder: true, awaitingPayment: true, deliveryDates: [], ...over,
  });
  const paid = (id: string, at: string) => row(id, at, { status: 'confirmed', paymentStatus: 'paid', awaitingPayment: false });
  const cancelled = (id: string, at: string) => row(id, at, { status: 'cancelled', awaitingPayment: false });
  const rows = [paid('P-new', '2026-10-07T12:00:00Z'), row('W-old', '2026-10-05T12:00:00Z'), paid('P-old', '2026-10-04T12:00:00Z'), row('W-new', '2026-10-06T12:00:00Z'), cancelled('C', '2026-10-07T13:00:00Z')];
  it('Waiting shows only unpaid link orders, newest first', () => {
    expect(rowsForTab(rows, 'waiting').map((r) => r.orderId)).toEqual(['W-new', 'W-old']);
  });
  it('an order that gets paid leaves Waiting and appears under Paid', () => {
    const after = rows.map((r) => (r.orderId === 'W-new' ? { ...r, paymentStatus: 'paid', status: 'confirmed', awaitingPayment: false } : r));
    expect(rowsForTab(after, 'waiting').map((r) => r.orderId)).toEqual(['W-old']);
    expect(rowsForTab(after, 'paid').map((r) => r.orderId)).toEqual(['P-new', 'W-new', 'P-old']);
  });
  it('All puts unpaid orders on top, then everything else newest first', () => {
    expect(rowsForTab(rows, 'all').map((r) => r.orderId)).toEqual(['W-new', 'W-old', 'C', 'P-new', 'P-old']);
  });
  it('does not change the list it is given', () => {
    const copy = JSON.stringify(rows);
    rowsForTab(rows, 'all');
    expect(JSON.stringify(rows)).toBe(copy);
  });
});
