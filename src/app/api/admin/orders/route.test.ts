import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const read = vi.fn();
const count = vi.fn();
vi.mock('@/lib/db', () => ({ db: { read: (...a: unknown[]) => read(...a), count: (...a: unknown[]) => count(...a), readOne: vi.fn(), update: vi.fn(), updateOne: vi.fn() } }));

import { GET } from './route';

function req(query = '', token: string | null = 'good') {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/admin/orders' + query, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) => (t === 'good' ? { success: true, payload: { userId: 'a1', role: 'admin' } } : { success: false, error: 'bad' }));
  count.mockResolvedValue({ success: true, count: 4321 });
  read.mockResolvedValue({ success: true, data: [{ orderId: 'ORD-1', items: [] }] });
});

describe('GET /api/admin/orders', () => {
  it('needs an admin', async () => {
    expect((await GET(req('', null))).status).toBe(401);
    expect((await GET(req('', 'bad'))).status).toBe(401);
  });
  it('counts orders in the database instead of loading them all, and reads only the one page', async () => {
    const res = await GET(req('?page=2&limit=10'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('4321');
    expect(count).toHaveBeenCalledTimes(1);
    expect(count.mock.calls[0][0]).toBe('orders');
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][2]).toMatchObject({ skip: 10, limit: 10 });
  });
  it('the count uses the same filter as the page', async () => {
    await GET(req('?status=confirmed&limit=10'));
    expect(count.mock.calls[0][1]).toEqual(read.mock.calls[0][1]);
    expect(JSON.stringify(count.mock.calls[0][1])).toContain('confirmed');
  });
  it('a failed count is an error, not an empty list', async () => {
    count.mockResolvedValue({ success: false, error: 'boom' });
    expect((await GET(req('?limit=10'))).status).toBe(500);
  });
});
