import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { KitchenRow } from '@/utils/kitchenDashboard';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const fetchKitchenRows = vi.fn();
vi.mock('@/lib/kitchenRows', () => ({ fetchDashboardRows: (...a: unknown[]) => fetchKitchenRows(...a) }));

import { GET } from './route';

const row = (over: Partial<KitchenRow>): KitchenRow => ({
  orderId: 'ORD-1',
  day: '2026-10-07',
  name: 'Rajma',
  quantity: 1,
  customerName: 'Asha',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good' ? { success: true, payload: { userId: 'a', role: 'admin' } } : { success: false, error: 'Invalid token' },
  );
  fetchKitchenRows.mockResolvedValue([
    row({ orderId: 'A', day: '2026-10-07', quantity: 2 }),
    row({ orderId: 'B', day: '2026-10-08', quantity: 3 }),
  ]);
});

const get = (query: string, token: string | null = 'good') =>
  GET(
    new NextRequest(`http://localhost/api/admin/kitchen-dashboard${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
  );

describe('GET /api/admin/kitchen-dashboard', () => {
  it('needs an admin login', async () => {
    expect((await get('?startDate=2026-10-03&endDate=2026-10-09', null)).status).toBe(401);
    expect((await get('?startDate=2026-10-03&endDate=2026-10-09', 'bad')).status).toBe(401);
  });

  it('returns the days and the week total (the same item added up over the whole range)', async () => {
    const { data } = await (await get('?startDate=2026-10-03&endDate=2026-10-09')).json();
    expect(data.days).toHaveLength(7);
    expect(data.days.find((d: { day: string }) => d.day === '2026-10-07').items[0].quantity).toBe(2);
    expect(data.week.items).toHaveLength(1);
    expect(data.week.items[0]).toMatchObject({ name: 'Rajma', quantity: 5 });
    expect(data.week.totals).toMatchObject({ units: 5, orders: 2 });
  });

  it('never sends customer names with the counts', async () => {
    const body = JSON.stringify(await (await get('?startDate=2026-10-03&endDate=2026-10-09')).json());
    expect(body).not.toContain('Asha');
  });

  it('rejects a bad range', async () => {
    expect((await get('?startDate=2026-10-09&endDate=2026-10-03')).status).toBe(400);
    expect(fetchKitchenRows).not.toHaveBeenCalled();
  });
});
