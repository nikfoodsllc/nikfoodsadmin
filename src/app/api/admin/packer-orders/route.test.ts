import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const read = vi.fn();
const count = vi.fn();
vi.mock('@/lib/db', () => ({ db: { read: (...a: unknown[]) => read(...a), count: (...a: unknown[]) => count(...a) } }));

import { GET } from './route';

const req = (query = '', token: string | null = 'packer') => new NextRequest('http://localhost/api/admin/packer-orders' + query, { headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'packer' ? { success: true, payload: { userId: 'p1', role: 'packer' } }
    : t === 'admin' ? { success: true, payload: { userId: 'a1', role: 'admin' } }
    : t === 'customer' ? { success: true, payload: { userId: 'c1', role: 'user' } }
    : { success: false, error: 'bad' });
  count.mockResolvedValue({ success: true, count: 1 });
  read.mockResolvedValue({ success: true, data: [{ orderId: 'ORD-1', totalPaid: 99, customerInfo: { name: 'A', email: 'a@x.com', phone: '1' }, items: [] }] });
});

describe('GET /api/admin/packer-orders', () => {
  it('needs a packer or an admin', async () => {
    expect((await GET(req('', null))).status).toBe(401);
    expect((await GET(req('', 'bad'))).status).toBe(401);
    expect((await GET(req('', 'customer'))).status).toBe(401);
    expect((await GET(req('', 'packer'))).status).toBe(200);
    expect((await GET(req('', 'admin'))).status).toBe(200);
  });
  it('lists confirmed orders only, whatever the request says', async () => {
    await GET(req('?status=cancelled&paymentStatus=unpaid'));
    expect(read.mock.calls[0][1]).toMatchObject({ status: 'confirmed' });
    expect(count.mock.calls[0][1]).toEqual(read.mock.calls[0][1]);
  });
  it('answers with the money-free view and asks the database for no money field', async () => {
    const res = await GET(req());
    const text = JSON.stringify(await res.json());
    expect(text).toContain('ORD-1');
    expect(text).not.toContain('99');
    expect(text).not.toContain('a@x.com');
    expect(JSON.stringify(read.mock.calls[0][2].projection)).not.toMatch(/total|price|email|payment/i);
  });
  it('searches plain text and filters by delivery day', async () => {
    await GET(req('?search=(%2B&date=2026-10-15'));
    const filter = JSON.stringify(read.mock.calls[0][1]);
    expect(filter).toContain('\\\\(\\\\+');
    expect(filter).toContain('2026-10-15');
    expect(filter).not.toContain('customerInfo.email');
  });
  it('refuses a made-up date and caps the page size', async () => {
    expect((await GET(req('?date=2026-13-45'))).status).toBe(400);
    await GET(req('?limit=100000'));
    expect(read.mock.calls[0][2]).toMatchObject({ limit: 100 });
  });
});
