import { describe, expect, it } from 'vitest';
import { bucketsFor } from './businessDashboard';
import { customerKeyOf, splitNewExisting, type SplitOrder } from './customerSplit';

const range = { from: '2026-11-15', to: '2026-11-17' };
const o = (orderId: string, day: string, customerKey: string | null): SplitOrder => ({ orderId, day, customerKey, name: orderId, total: 10 });

describe('customerKeyOf', () => {
  it('prefers the account, then the email in lower case', () => {
    expect(customerKeyOf('abc', 'X@Y.com')).toBe('u:abc');
    expect(customerKeyOf(undefined, ' X@Y.com ')).toBe('e:x@y.com');
    expect(customerKeyOf(null, '')).toBeNull();
  });
});

describe('splitNewExisting', () => {
  const first = new Map([
    ['u:a', 'A1'], // first order inside the range
    ['u:b', 'B0'], // first order before the range
  ]);
  const orders = [o('A1', '2026-11-15', 'u:a'), o('A2', '2026-11-16', 'u:a'), o('B1', '2026-11-16', 'u:b'), o('C1', '2026-11-17', null)];
  const split = splitNewExisting(orders, first, bucketsFor(range, 'day'), 'day');

  it('counts only the first order ever as new', () => {
    expect(split.orders).toBe(4);
    expect(split.newOrders).toBe(1);
    expect(split.existingOrders).toBe(3);
  });
  it('people: a new customer who ordered again also counts among repeat people, once in the total', () => {
    expect(split.newCustomers).toBe(1);
    expect(split.existingCustomers).toBe(2);
    expect(split.customers).toBe(2);
  });
  it('splits each day', () => {
    expect(split.series.map((b) => [b.key, b.newOrders, b.existingOrders])).toEqual([
      ['2026-11-15', 1, 0],
      ['2026-11-16', 0, 2],
      ['2026-11-17', 0, 1],
    ]);
  });
  it('lists the orders newest day first with the flag', () => {
    expect(split.lines.map((l) => [l.orderId, l.isNew])).toEqual([['C1', false], ['A2', false], ['B1', false], ['A1', true]]);
  });
});
