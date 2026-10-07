import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { KitchenRow } from '@/utils/kitchenDashboard';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const fetchKitchenRows = vi.fn();
vi.mock('@/lib/kitchenRows', () => ({ fetchKitchenRows: (...a: unknown[]) => fetchKitchenRows(...a) }));

import { GET } from './route';

const row = (over: Partial<KitchenRow>): KitchenRow => ({
  orderId: 'ORD-1',
  day: '2026-10-07',
  name: 'Rajma',
  quantity: 1,
  customerName: 'Asha',
  deliveredOn: '2026-10-09',
  orderStatus: 'confirmed',
  ...over,
});
const ROWS: KitchenRow[] = [
  row({ orderId: 'ORD-2', day: '2026-10-08', quantity: 3, customerName: 'Ben' }),
  row({ orderId: 'ORD-1', day: '2026-10-07', quantity: 2 }),
  row({ orderId: 'ORD-3', day: '2026-10-07', name: 'Dosa Batter', quantity: 5 }),
];

function req(query: string, token: string | null = 'good') {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost/api/admin/kitchen-dashboard/item-orders${query}`, { headers });
}
const RANGE = 'startDate=2026-10-03&endDate=2026-10-09';

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good'
      ? { success: true, payload: { userId: 'a', role: 'admin' } }
      : t === 'user'
        ? { success: true, payload: { userId: 'u', role: 'user' } }
        : { success: false, error: 'Invalid token' },
  );
  fetchKitchenRows.mockResolvedValue(ROWS);
});

describe('GET /api/admin/kitchen-dashboard/item-orders', () => {
  it('needs an admin login and reads nothing without one', async () => {
    for (const token of [null, 'bad', 'user']) expect((await GET(req(`?${RANGE}&item=Rajma`, token))).status).toBe(401);
    expect(fetchKitchenRows).not.toHaveBeenCalled();
  });

  it('rejects a missing or backwards range, a missing or huge item name, and a bad day', async () => {
    expect((await GET(req('?item=Rajma'))).status).toBe(400);
    expect((await GET(req('?startDate=2026-10-09&endDate=2026-10-03&item=Rajma'))).status).toBe(400);
    expect((await GET(req(`?${RANGE}`))).status).toBe(400);
    expect((await GET(req(`?${RANGE}&item=%20%20`))).status).toBe(400);
    expect((await GET(req(`?${RANGE}&item=${'x'.repeat(201)}`))).status).toBe(400);
    expect((await GET(req(`?${RANGE}&item=Rajma&day=tomorrow`))).status).toBe(400);
    expect((await GET(req(`?${RANGE}&item=Rajma&day=2026-11-01`))).status).toBe(400); // outside the range
    expect(fetchKitchenRows).not.toHaveBeenCalled();
  });

  it('lists who ordered the item across the range, with totals', async () => {
    const res = await GET(req(`?${RANGE}&item=Rajma`));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(
      data.lines.map((l: { orderId: string; customerName: string; quantity: number }) => [l.orderId, l.customerName, l.quantity]),
    ).toEqual([
      // no spice on either: the bigger order comes first
      ['ORD-2', 'Ben', 3],
      ['ORD-1', 'Asha', 2],
    ]);
    expect(data.totals).toEqual({ orders: 2, units: 5, truncated: false });
    expect(fetchKitchenRows).toHaveBeenCalledWith({ startDate: '2026-10-03', endDate: '2026-10-09' });
  });

  it('only one menu day when a day is given', async () => {
    const { data } = await (await GET(req(`?${RANGE}&item=Rajma&day=2026-10-08`))).json();
    expect(data.day).toBe('2026-10-08');
    expect(data.lines.map((l: { orderId: string }) => l.orderId)).toEqual(['ORD-2']);
    expect(data.totals.units).toBe(3);
  });

  it('answers with an empty list for an item nobody ordered', async () => {
    const { data } = await (await GET(req(`?${RANGE}&item=Nothing`))).json();
    expect(data.lines).toEqual([]);
    expect(data.totals).toEqual({ orders: 0, units: 0, truncated: false });
  });

  it('answers 500 when the orders cannot be read', async () => {
    fetchKitchenRows.mockRejectedValue(new Error('boom'));
    expect((await GET(req(`?${RANGE}&item=Rajma`))).status).toBe(500);
  });
});
