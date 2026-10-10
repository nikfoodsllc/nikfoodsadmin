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
  replaceLine,
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

import { orderLinePayload, totalsLines, unitCount, searchRows, phoneNote, linkActivity, elapsed, uniqueIds, allMenuNodes, dayMenuNodes, filterNodes, isValidDate, paidMethodValue, quantityFor, removeOne, allNodeIds, type CatalogPayload, type CartLine } from './createOrder';

describe('whole menu helpers', () => {
  const item = (id: string, name: string) => ({ _id: id, name, price: 5 });
  const catalog: CatalogPayload = {
    today: '2026-10-07',
    dates: [],
    items: { a: item('a', 'Aam Panna'), b: item('b', 'Dosa Batter'), c: item('c', 'Veg Combo'), d: item('d', 'Gajar Halwa') },
    categories: [
      { _id: 'fm', name: 'Food Menu', listingType: 'day-wise', flatItemIds: [], allItemIds: ['a', 'c'], dayWise: { '2026-10-08': ['a'], '2026-10-09': ['a', 'c'] }, children: [] },
      {
        _id: 'sw', name: 'Indian Sweets', listingType: 'flat', flatItemIds: ['d'], allItemIds: ['d'], dayWise: {},
        children: [{ _id: 'sw2', name: 'Halwa', listingType: 'flat', flatItemIds: ['d'], allItemIds: ['d'], dayWise: {}, children: [] }],
      },
      { _id: 'ba', name: 'Batter', listingType: 'flat', flatItemIds: ['b'], allItemIds: ['b'], dayWise: {}, children: [] },
    ],
  };

  it('a day shows the flat items and that date\'s day-wise items, with empty categories left out', () => {
    const nodes = dayMenuNodes(catalog, '2026-10-08');
    expect(nodes.map((n) => n.name)).toEqual(['Food Menu', 'Indian Sweets', 'Batter']);
    expect(nodes[0].itemIds).toEqual(['a']);
    expect(dayMenuNodes(catalog, '2026-12-25').map((n) => n.name)).toEqual(['Indian Sweets', 'Batter']);
  });
  it('the whole menu has every item of every category whatever its date', () => {
    const nodes = allMenuNodes(catalog);
    expect(nodes[0].itemIds).toEqual(['a', 'c']);
    expect(uniqueIds(nodes)).toHaveLength(4);
  });
  it('sub-categories nest and counts include them', () => {
    const sweets = allMenuNodes(catalog).find((n) => n.name === 'Indian Sweets')!;
    expect(sweets.children[0].name).toBe('Halwa');
    // the halwa is grouped under its sub-category, not repeated in the parent
    expect(sweets.itemIds).toEqual([]);
    expect(sweets.children[0].itemIds).toEqual(['d']);
    expect(sweets.total).toBe(1);
    expect(allNodeIds(allMenuNodes(catalog))).toContain('sw2');
  });
  it('a day-wise category groups its date\'s items under the sub-category they are tagged to', () => {
    const c: CatalogPayload = {
      today: 't', dates: [], items: { x: item('x', 'Aam'), y: item('y', 'Dal'), z: item('z', 'Rice') },
      categories: [{
        _id: 'fm', name: 'Food Menu', listingType: 'day-wise', flatItemIds: [], allItemIds: ['x', 'y', 'z'], dayWise: { '2026-10-08': ['x', 'y'], '2026-10-09': ['z'] },
        children: [
          { _id: 'bev', name: 'Beverages', listingType: 'flat', flatItemIds: ['x'], allItemIds: ['x', 'z'], dayWise: {}, children: [] },
          { _id: 'main', name: 'Main Course', listingType: 'flat', flatItemIds: ['y'], allItemIds: ['y'], dayWise: {}, children: [] },
        ],
      }],
    };
    const thu = dayMenuNodes(c, '2026-10-08')[0];
    expect(thu.children.map((n) => [n.name, n.itemIds])).toEqual([['Beverages', ['x']], ['Main Course', ['y']]]);
    expect(thu.itemIds).toEqual([]);
    const fri = dayMenuNodes(c, '2026-10-09')[0];
    expect(fri.children.map((n) => n.name)).toEqual(['Beverages']); // Rice is tagged Beverages in this sample; Main Course has nothing that day
    const whole = allMenuNodes(c)[0];
    expect(uniqueIds([whole])).toHaveLength(3);
    // whole menu: a sub-category shows all of its items, whatever the date
    expect(whole.children.find((n) => n.name === 'Beverages')!.itemIds).toEqual(['x', 'z']);
  });
  it('items under a sub-category of a day-wise category follow the order of the day\'s menu, like the website', () => {
    const c: CatalogPayload = {
      today: 't', dates: [], items: { a: item('a', 'Chapati'), b: item('b', 'Jeera Rice'), c: item('c', 'Veg Combo'), d: item('d', 'Dhaba Dal') },
      categories: [{
        _id: 'fm', name: 'Food Menu', listingType: 'day-wise', flatItemIds: [], allItemIds: ['a', 'b', 'c', 'd'],
        dayWise: { '2026-10-08': ['c', 'd', 'a', 'b'] },
        children: [{ _id: 'main', name: 'Main Course', listingType: 'flat', flatItemIds: ['a', 'b', 'c', 'd'], allItemIds: ['a', 'b', 'c', 'd'], dayWise: {}, children: [] }],
      }],
    };
    const main = dayMenuNodes(c, '2026-10-08')[0].children[0];
    expect(main.itemIds).toEqual(['c', 'd', 'a', 'b']); // the day's order, not the sub-category's own a, b, c, d
  });
  it('search keeps matching items and the categories holding them', () => {
    const found = filterNodes(allMenuNodes(catalog), catalog.items, 'halwa');
    expect(found.map((n) => n.name)).toEqual(['Indian Sweets']);
    expect(found[0].children[0].itemIds).toEqual(['d']);
    expect(filterNodes(allMenuNodes(catalog), catalog.items, 'zzz')).toEqual([]);
    expect(filterNodes(allMenuNodes(catalog), catalog.items, '  ')).toHaveLength(3);
  });
  it('quantities and take-one-off work per item and date', () => {
    const line = (key: string, date: string, id: string, q: number): CartLine => ({ key, date, foodItemId: id, quantity: q, name: id, unitPrice: 1, tags: [] });
    const lines = [line('k1', '2026-10-08', 'a', 2), line('k2', '2026-10-09', 'a', 1), line('k3', '2026-10-08', 'a', 1)];
    expect(quantityFor(lines, '2026-10-08', 'a')).toBe(3);
    const after = removeOne(lines, '2026-10-08', 'a');
    expect(after.find((l) => l.key === 'k3')).toBeUndefined(); // the latest line (qty 1) went
    expect(quantityFor(after, '2026-10-08', 'a')).toBe(2);
    expect(removeOne(lines, '2026-10-10', 'a')).toBe(lines);
  });
  it('any real calendar date is accepted, impossible ones are not', () => {
    expect(isValidDate('2026-10-07')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('10/07/2026')).toBe(false);
  });
  it('paid method: Cash and Zelle as is, Other needs text', () => {
    expect(paidMethodValue('Cash', '')).toBe('Cash');
    expect(paidMethodValue('Zelle', 'ignored')).toBe('Zelle');
    expect(paidMethodValue('Other', '   ')).toBeNull();
    expect(paidMethodValue('Other', '  Venmo   @kunal ')).toBe('Venmo @kunal');
    expect(paidMethodValue('Other', 'x'.repeat(80))).toHaveLength(40);
  });
});

describe('payment link activity', () => {
  const NOW = new Date('2026-10-08T12:00:00Z');
  const base = { linkOrder: true, paymentStatus: 'unpaid', awaitingPayment: true, linkSentAt: '2026-10-08T10:00:00Z', linkEmail: { status: 'sent' } };
  it('nothing to say for orders that are not emailed link orders', () => {
    expect(linkActivity({ ...base, linkOrder: false }, NOW)).toEqual([]);
    expect(linkActivity({ ...base, linkSentAt: undefined }, NOW)).toEqual([]);
  });
  it('an older link sent before tracking existed (no email record, no views) says nothing', () => {
    expect(linkActivity({ linkOrder: true, paymentStatus: 'unpaid', awaitingPayment: true, linkSentAt: '2026-10-01T10:00:00Z' }, NOW)).toEqual([]);
  });
  it('an older link that was opened still shows the opening', () => {
    const r = linkActivity({ linkOrder: true, paymentStatus: 'unpaid', awaitingPayment: true, linkSentAt: '2026-10-01T10:00:00Z', linkViews: { firstAt: '2026-10-08T11:00:00Z', lastAt: '2026-10-08T11:00:00Z', count: 1 } }, NOW);
    expect(r[0].tone).toBe('good');
  });
  it('sent but not opened yet: a neutral note with how long ago', () => {
    expect(linkActivity(base, NOW)).toEqual([{ tone: 'info', text: 'Has not opened the payment page yet (sent 2 hours ago)' }]);
  });
  it('not opened after a day: an amber nudge', () => {
    const r = linkActivity({ ...base, linkSentAt: '2026-10-06T10:00:00Z' }, NOW);
    expect(r[0].tone).toBe('warn');
    expect(r[0].text).toContain('after 2 days');
    expect(r[0].text).toContain('Email a new link or call');
  });
  it('opened the payment page: green, with count and last time', () => {
    const r = linkActivity({ ...base, linkViews: { firstAt: '2026-10-08T11:00:00Z', lastAt: '2026-10-08T11:30:00Z', count: 3 } }, NOW);
    expect(r).toHaveLength(1);
    expect(r[0].tone).toBe('good');
    expect(r[0].text).toContain('3 times');
  });
  it('a bounce is red, names the reason and says to check the address', () => {
    const r = linkActivity({ ...base, linkEmail: { status: 'bounced', bounceReason: 'Mailbox does not exist' } }, NOW);
    expect(r[0]).toMatchObject({ tone: 'bad' });
    expect(r[0].text).toContain('Mailbox does not exist');
    expect(r[0].text).toContain('Check the email address');
  });
  it('email opens are only a hint and never shown for a bounced email', () => {
    const opened = { firstAt: '2026-10-08T11:00:00Z', lastAt: '2026-10-08T11:05:00Z', count: 2 };
    const ok = linkActivity({ ...base, linkEmail: { status: 'delivered', opened } }, NOW);
    expect(ok.map((l) => l.text).join(' | ')).toContain('only a hint');
    expect(linkActivity({ ...base, linkEmail: { status: 'bounced', opened } }, NOW).some((l) => /opened/.test(l.text) && /hint/.test(l.text))).toBe(false);
  });
  it('a paid order that was opened says so', () => {
    const r = linkActivity({ ...base, paymentStatus: 'paid', awaitingPayment: false, linkViews: { firstAt: '2026-10-08T11:00:00Z', lastAt: '2026-10-08T11:30:00Z', count: 1 } }, NOW);
    expect(r[0].text).toMatch(/and paid$/);
  });
  it('a paid order never nags about not opening', () => {
    expect(linkActivity({ ...base, paymentStatus: 'paid', awaitingPayment: false }, NOW).filter((l) => l.tone === 'warn')).toEqual([]);
  });
  it('elapsed wording', () => {
    expect(elapsed('2026-10-08T11:30:00Z', NOW)).toBe('30 min');
    expect(elapsed('2026-10-08T11:00:00Z', NOW)).toBe('1 hour');
    expect(elapsed('2026-10-05T12:00:00Z', NOW)).toBe('3 days');
  });
});

describe('phone note in Create Order', () => {
  it('a new customer: saved on the new account', () => {
    expect(phoneNote(null, '2065550100')).toBe('Saved on the new account.');
  });
  it('an existing customer without a phone: it will be saved to the profile', () => {
    expect(phoneNote({ phone: '' }, '2065550100')).toContain('saved to it when the order is created');
    expect(phoneNote({ phone: '12345' }, '')).toContain('no phone on their profile');
  });
  it('an existing customer with a phone: nothing to say when it is the same, in any format', () => {
    expect(phoneNote({ phone: '2065550100' }, '(206) 555-0100')).toBeUndefined();
    expect(phoneNote({ phone: '2065550100' }, '1-206-555-0100')).toBeUndefined();
    expect(phoneNote({ phone: '2065550100' }, '')).toBeUndefined();
  });
  it('a different number: used for this order only', () => {
    expect(phoneNote({ phone: '2065550100' }, '2065550199')).toContain('this order only');
  });
});

describe('search in Recent orders', () => {
  const row = (over: Partial<OrderListRow>): OrderListRow => ({
    orderId: 'ORD-1791392098152121',
    createdAt: '2026-10-07T16:54:00.000Z',
    customerName: 'Aditi Nagpal',
    customerEmail: 'duggal.aditi@gmail.com',
    customerPhone: '2065550144',
    total: 6.08,
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'Credit Card',
    linkOrder: true,
    awaitingPayment: true,
    deliveryDates: ['2026-10-07'],
    ...over,
  });
  const rows = [
    row({}),
    row({ orderId: 'ORD-1791348392591569', customerName: 'Shrey Test', customerEmail: 'jainshrey2004+pay3@gmail.com', customerPhone: '4255550177', total: 38.65, paymentStatus: 'paid', status: 'confirmed', awaitingPayment: false, paymentMethod: 'Cash on Delivery', offlinePaymentNote: 'paid at the door', deliveryDates: ['2026-10-09'] }),
    row({ orderId: 'ORD-1791336924112871', customerName: 'Kunal Mehra', customerEmail: 'kmehra1@gmail.com', customerPhone: '2535550123', total: 51.92, status: 'cancelled', awaitingPayment: false, paymentMethod: 'Zelle', deliveryDates: ['2026-10-08', '2026-10-09'] }),
  ];
  const ids = (q: string) => searchRows(rows, q).map((r) => r.orderId.slice(-4));
  it('an empty or blank box matches everything', () => {
    expect(searchRows(rows, '')).toHaveLength(3);
    expect(searchRows(rows, '   ')).toHaveLength(3);
  });
  it('finds by name, email, order number (also the last digits) and ignores case', () => {
    expect(ids('aditi')).toEqual(['2121']);
    expect(ids('ADITI')).toEqual(['2121']);
    expect(ids('kmehra1')).toEqual(['2871']);
    expect(ids('1791348392591569')).toEqual(['1569']);
    expect(ids('2871')).toEqual(['2871']);
    expect(ids('ord-17913')).toEqual(['2121', '1569', '2871']);
  });
  it('every word must match, in any order', () => {
    expect(ids('aditi gmail')).toEqual(['2121']);
    expect(ids('gmail aditi')).toEqual(['2121']);
    expect(ids('aditi kunal')).toEqual([]);
  });
  it('finds by amount, with or without a $', () => {
    expect(ids('6.08')).toEqual(['2121']);
    expect(ids('$38.65')).toEqual(['1569']);
  });
  it('finds by delivery day, written as a date or in words', () => {
    expect(ids('2026-10-09')).toEqual(['1569', '2871']);
    expect(ids('friday')).toEqual(['1569', '2871']);
    expect(ids('wednesday oct 7')).toEqual(['2121']);
  });
  it('finds by payment method, note and state', () => {
    expect(ids('cash')).toEqual(['1569']);
    expect(ids('zelle')).toEqual(['2871']);
    expect(ids('door')).toEqual(['1569']);
    expect(ids('cancelled')).toEqual(['2871']);
    expect(ids('paid')).toEqual(['1569']);
    expect(ids('waiting')).toEqual(['2121']);
  });
  it('finds by phone, however it is typed, and also by a part of it', () => {
    expect(ids('2065550144')).toEqual(['2121']);
    expect(ids('(206) 555-0144')).toEqual(['2121']);
    expect(ids('206.555.0144')).toEqual(['2121']);
    expect(ids('1-206-555-0144')).toEqual(['2121']);
    expect(ids('+1 206 555 0144')).toEqual(['2121']);
    expect(ids('555-0177')).toEqual(['1569']);
    expect(ids('425')).toEqual(['1569']);
    expect(ids('555')).toEqual(['2121', '1569', '2871']);
    expect(ids('aditi 0144')).toEqual(['2121']);
    expect(ids('aditi 0177')).toEqual([]);
  });
  it('an order from an older server without a phone is still found by everything else', () => {
    const old = [row({ customerPhone: undefined })];
    expect(searchRows(old, 'aditi')).toHaveLength(1);
    expect(searchRows(old, '2065550144')).toHaveLength(0);
  });
  it('no match gives an empty list', () => {
    expect(ids('zzzz')).toEqual([]);
  });
});

describe('Recent orders tabs', () => {
  const row = (over: Partial<OrderListRow>): OrderListRow => ({
    orderId: 'ORD-1', createdAt: '2026-10-07T10:00:00.000Z', customerName: 'A', customerEmail: 'a@example.com', total: 10, status: 'pending', paymentStatus: 'unpaid', paymentMethod: 'Credit Card', linkOrder: true, awaitingPayment: true, deliveryDates: ['2026-10-07'], ...over,
  });
  const waiting = row({ orderId: 'W', createdAt: '2026-10-07T12:00:00.000Z' });
  const paid = row({ orderId: 'P', createdAt: '2026-10-07T11:00:00.000Z', status: 'confirmed', paymentStatus: 'paid', awaitingPayment: false });
  const cancelledOld = row({ orderId: 'C1', createdAt: '2026-10-06T09:00:00.000Z', status: 'cancelled', awaitingPayment: false });
  const cancelledNew = row({ orderId: 'C2', createdAt: '2026-10-07T09:00:00.000Z', status: 'cancelled', awaitingPayment: false });
  const rows = [cancelledOld, waiting, paid, cancelledNew];
  const ids = (tab: 'waiting' | 'paid' | 'cancelled' | 'all') => rowsForTab(rows, tab).map((r) => r.orderId);
  it('Cancelled shows only cancelled orders, newest first', () => {
    expect(ids('cancelled')).toEqual(['C2', 'C1']);
  });
  it('cancelled orders are not in Waiting or Paid, but are in All', () => {
    expect(ids('waiting')).toEqual(['W']);
    expect(ids('paid')).toEqual(['P']);
    expect(ids('all')).toEqual(['W', 'P', 'C2', 'C1']);
  });
  it('the three counts and All add up', () => {
    expect(ids('waiting').length + ids('paid').length + ids('cancelled').length).toBe(ids('all').length);
  });
  it('an order that was paid and then cancelled is only in Cancelled', () => {
    const odd = [row({ orderId: 'X', status: 'cancelled', paymentStatus: 'paid', awaitingPayment: false })];
    expect(rowsForTab(odd, 'paid')).toEqual([]);
    expect(rowsForTab(odd, 'cancelled').map((r) => r.orderId)).toEqual(['X']);
  });
  it('search narrows Cancelled too, and the word cancelled finds cancelled orders', () => {
    expect(rowsForTab(searchRows(rows, 'c1'), 'cancelled').map((r) => r.orderId)).toEqual(['C1']);
    expect(searchRows(rows, 'cancelled').map((r) => r.orderId).sort()).toEqual(['C1', 'C2']);
  });
});

describe('expanded order in Recent orders', () => {
  const details = {
    days: [
      { menuDay: '2026-10-07', deliveryDay: '2026-10-09', dayTotal: 17.5, items: [{ name: 'Rajma', quantity: 2, lineTotal: 17.5, tags: ['8Oz', 'Medium Spice', 'Eco'], choices: [] }] },
      { menuDay: '2026-10-09', deliveryDay: '2026-10-09', dayTotal: 43.75, items: [{ name: 'Veg Combo', quantity: 1, lineTotal: 26.5, tags: [], choices: ['Staple: Chapati'] }, { name: 'Samosa', quantity: 3, lineTotal: 17.25, tags: [], choices: [] }] },
    ],
    totals: { subtotal: 60.5, platformFee: 2.73, deliveryFee: 0, tax: 6.5, tip: 3, discount: 0, total: 72.73 },
    address: { line: '400 Broad Street, Seattle 98109' },
  };
  it('counts every unit ordered, across days', () => {
    expect(unitCount(details)).toBe(6);
    expect(unitCount(undefined)).toBe(0);
    expect(unitCount({ ...details, days: [] })).toBe(0);
  });
  it('totals: subtotal, taxes and fees together, tip, total', () => {
    expect(totalsLines(details)).toEqual([
      { label: 'Subtotal', amount: 60.5 },
      { label: 'Taxes & fees', amount: 9.23 },
      { label: 'Tip', amount: 3 },
      { label: 'Total', amount: 72.73, strong: true },
    ]);
  });
  it('no tip line without a tip, a discount line only when there is a discount, delivery fee is folded into taxes and fees', () => {
    const lines = totalsLines({ ...details, totals: { ...details.totals, tip: 0, discount: 5, deliveryFee: 3 } });
    expect(lines.map((l) => l.label)).toEqual(['Subtotal', 'Taxes & fees', 'Discount', 'Total']);
    expect(lines[1].amount).toBe(12.23);
    expect(lines[2].amount).toBe(-5);
  });
});

describe('replaceLine (changing a line that is already in the order)', () => {
  const mk = (over: Partial<Parameters<typeof addLine>[1]> = {}) => ({ date: '2026-10-08', foodItemId: 'r', quantity: 1, name: 'Rajma', unitPrice: 8, tags: [], selectedPortion: '8Oz', selectedSpiceLevel: 'Mild', ...over });

  it('changes the options and quantity in the same place in the list', () => {
    let lines = addLine([], mk({ foodItemId: 'a', name: 'A' }));
    lines = addLine(lines, mk());
    lines = addLine(lines, mk({ foodItemId: 'z', name: 'Z' }));
    const key = lines[1].key;
    const next = replaceLine(lines, key, mk({ selectedPortion: '12Oz', quantity: 3, unitPrice: 11, tags: ['12Oz', 'Mild'] }));
    expect(next.map((l) => l.foodItemId)).toEqual(['a', 'r', 'z']);
    expect(next[1]).toMatchObject({ selectedPortion: '12Oz', quantity: 3, unitPrice: 11 });
    expect(next[1].key).toBe(lineSignature(next[1]));
    expect(next).toHaveLength(3);
  });

  it('merges into another line that is now the same pick, adding the quantities', () => {
    let lines = addLine([], mk({ quantity: 2 }));
    lines = addLine(lines, mk({ selectedPortion: '12Oz', quantity: 4 }));
    const next = replaceLine(lines, lines[0].key, mk({ selectedPortion: '12Oz', quantity: 2 }));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ selectedPortion: '12Oz', quantity: 6 });
  });

  it('caps a merged quantity at 99', () => {
    let lines = addLine([], mk({ quantity: 60 }));
    lines = addLine(lines, mk({ selectedPortion: '12Oz', quantity: 60 }));
    expect(replaceLine(lines, lines[0].key, mk({ selectedPortion: '12Oz', quantity: 60 }))[0].quantity).toBe(99);
  });

  it('keeps everything else untouched and adds the pick when the line is gone', () => {
    const lines = addLine([], mk());
    const next = replaceLine(lines, 'no-such-key', mk({ selectedSpiceLevel: 'Normal' }));
    expect(next).toHaveLength(2);
    expect(lines).toHaveLength(1);
  });

  it('a note change makes it a different pick but stays in place', () => {
    let lines = addLine([], mk({ foodItemId: 'a', name: 'A' }));
    lines = addLine(lines, mk());
    const next = replaceLine(lines, lines[1].key, mk({ notes: 'less salt' }));
    expect(next[1].notes).toBe('less salt');
    expect(next).toHaveLength(2);
  });
});

describe('typed item price', () => {
  const base = { date: '2026-10-14', foodItemId: 'f1', quantity: 2 };
  it('travels as unitPrice only when it was typed', () => {
    expect(orderLinePayload(base)).not.toHaveProperty('unitPrice');
    expect(orderLinePayload({ ...base, unitPriceEdited: 15 })).toMatchObject({ unitPrice: 15, quantity: 2, foodItemId: 'f1' });
    expect(orderLinePayload({ ...base, unitPriceEdited: 0 })).toMatchObject({ unitPrice: 0 });
  });
  it('two prices of the same item are two lines', () => {
    expect(lineSignature({ ...base, unitPriceEdited: 15 })).not.toBe(lineSignature(base));
    expect(lineSignature({ ...base, unitPriceEdited: 15 })).not.toBe(lineSignature({ ...base, unitPriceEdited: 16 }));
    expect(lineSignature({ ...base, unitPriceEdited: 15 })).toBe(lineSignature({ ...base, unitPriceEdited: 15 }));
  });
});

describe('Zelle orders in Recent orders', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const row = (extra: object) => ({ linkOrder: false, payKind: 'zelle' as const, paymentStatus: 'unpaid', awaitingPayment: true, linkSentAt: '2026-10-11T12:00:00Z', linkEmail: { status: 'delivered', sentAt: '2026-10-11T12:00:00Z' }, ...extra });
  it('says it is waiting for the Zelle payment, with no pay-page lines', () => {
    const lines = linkActivity(row({}), now);
    expect(lines.some((l) => /Waiting for the Zelle payment/.test(l.text))).toBe(true);
    expect(lines.some((l) => /payment page/i.test(l.text))).toBe(false);
  });
  it('warns after two days', () => {
    expect(linkActivity(row({ linkSentAt: '2026-10-09T12:00:00Z' }), now).some((l) => l.tone === 'warn' && /Zelle payment has not been marked received/.test(l.text))).toBe(true);
  });
  it('shows a bounce and says nothing when paid', () => {
    expect(linkActivity(row({ linkEmail: { status: 'bounced', sentAt: '2026-10-11T12:00:00Z' } }), now).some((l) => l.tone === 'bad')).toBe(true);
    expect(linkActivity(row({ awaitingPayment: false, paymentStatus: 'paid' }), now).some((l) => /Waiting for the Zelle/.test(l.text))).toBe(false);
  });
  it('a link order is unchanged', () => {
    expect(linkActivity({ linkOrder: true, paymentStatus: 'unpaid', awaitingPayment: true, linkSentAt: '2026-10-11T12:00:00Z', linkEmail: { status: 'delivered', sentAt: '2026-10-11T12:00:00Z' } }, now).some((l) => /payment page/.test(l.text))).toBe(true);
  });
});
