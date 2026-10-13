import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const readOne = vi.fn();
const count = vi.fn();
const del = vi.fn();
const create = vi.fn();
vi.mock('@/lib/db', () => ({ db: { readOne: (...a: unknown[]) => readOne(...a), count: (...a: unknown[]) => count(...a), delete: (...a: unknown[]) => del(...a), create: (...a: unknown[]) => create(...a) } }));

import { POST } from './route';

const req = (body: unknown, token: string | null = 'admin') =>
  new NextRequest('http://localhost/api/admin/abandoned-checkouts/cleanup', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'admin' ? { success: true, payload: { userId: 'a1', role: 'admin' } } : t === 'packer' ? { success: true, payload: { userId: 'p1', role: 'packer' } } : { success: false, error: 'bad' });
  readOne.mockResolvedValue({ success: true, data: { orderId: 'ORD-179183223552030', createdAt: '2026-10-12T19:10:35.927Z' } });
  count.mockResolvedValue({ success: true, count: 40 });
  del.mockResolvedValue({ success: true, deletedCount: 40 });
  create.mockResolvedValue({ success: true });
});

describe('POST /api/admin/abandoned-checkouts/cleanup', () => {
  it('needs an admin', async () => {
    expect((await POST(req({ beforeOrderId: 'ORD-179183223552030' }, null))).status).toBe(401);
    expect((await POST(req({ beforeOrderId: 'ORD-179183223552030' }, 'packer'))).status).toBe(401);
  });
  it('refuses a bad body or a made-up order id', async () => {
    expect((await POST(req('not json'))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ beforeOrderId: '{"$ne":1}' }))).status).toBe(400);
    readOne.mockResolvedValue({ success: true, data: null });
    expect((await POST(req({ beforeOrderId: 'ORD-179183223552030' }))).status).toBe(404);
    expect(del).not.toHaveBeenCalled();
  });
  it('counts only, unless dryRun is explicitly false', async () => {
    for (const body of [{ beforeOrderId: 'ORD-179183223552030' }, { beforeOrderId: 'ORD-179183223552030', dryRun: true }, { beforeOrderId: 'ORD-179183223552030', dryRun: 'false' }, { beforeOrderId: 'ORD-179183223552030', dryRun: 0 }]) {
      const res = await POST(req(body));
      const json = await res.json();
      expect(json).toMatchObject({ dryRun: true, data: { matching: 40, cutoff: '2026-10-12T19:10:35.927Z' } });
    }
    expect(del).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('deletes only checkouts opened before the order, and keeps a record', async () => {
    const res = await POST(req({ beforeOrderId: 'ORD-179183223552030', dryRun: false }));
    expect(await res.json()).toMatchObject({ dryRun: false, data: { deleted: 40 } });
    expect(del).toHaveBeenCalledTimes(1);
    expect(del.mock.calls[0][0]).toBe('checkoutDrafts');
    expect(del.mock.calls[0][1]).toEqual({ createdAt: { $lt: new Date('2026-10-12T19:10:35.927Z') } });
    expect(create.mock.calls[0][0]).toBe('abandonedCheckoutCleanups');
    expect(create.mock.calls[0][1]).toMatchObject({ by: 'a1', beforeOrderId: 'ORD-179183223552030', deleted: 40 });
  });
  it('a failed delete is an error', async () => {
    del.mockResolvedValue({ success: false, error: 'boom' });
    expect((await POST(req({ beforeOrderId: 'ORD-179183223552030', dryRun: false }))).status).toBe(500);
  });
});
