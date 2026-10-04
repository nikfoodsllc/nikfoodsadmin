import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const updateOne = vi.fn();
const createIndex = vi.fn();
const readOne = vi.fn();
const deleteOne = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    readOne: (...a: unknown[]) => readOne(...a),
    deleteOne: (...a: unknown[]) => deleteOne(...a),
    getDb: async () => ({ collection: () => ({ updateOne, createIndex }) }),
  },
}));

import { GET, PUT } from './route';

const URL_BASE = 'http://localhost/api/admin/preferences/table';
const adminToken = { success: true, payload: { userId: 'admin-1', role: 'admin' } };

function req(method: string, opts: { query?: string; body?: unknown; rawBody?: string; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return new NextRequest(URL_BASE + (opts.query ?? ''), { method, headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) => (t === 'good' ? adminToken : t === 'user' ? { success: true, payload: { userId: 'u9', role: 'user' } } : { success: false, error: 'bad' }));
  readOne.mockResolvedValue({ success: true, data: null });
  deleteOne.mockResolvedValue({ success: true, deletedCount: 1 });
  updateOne.mockResolvedValue({});
  createIndex.mockResolvedValue('ok');
});

describe('authentication', () => {
  it('rejects a request with no token', async () => {
    expect((await GET(req('GET', { query: '?table=orders', token: null }))).status).toBe(401);
    expect((await PUT(req('PUT', { body: { table: 'orders', columns: {} }, token: null }))).status).toBe(401);
  });
  it('rejects an invalid token and a non-admin token', async () => {
    expect((await GET(req('GET', { query: '?table=orders', token: 'nope' }))).status).toBe(401);
    expect((await GET(req('GET', { query: '?table=orders', token: 'user' }))).status).toBe(401);
    expect((await PUT(req('PUT', { body: { table: 'orders', columns: { hidden: ['a'] } }, token: 'user' }))).status).toBe(401);
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('rejects an unknown table', async () => {
    expect((await GET(req('GET', { query: '?table=users' }))).status).toBe(400);
    expect((await GET(req('GET'))).status).toBe(400);
  });
  it('returns null when the admin has no saved layout', async () => {
    const res = await GET(req('GET', { query: '?table=orders' }));
    expect(await res.json()).toEqual({ data: null });
  });
  it('looks the layout up by the admin in the token, never by a value from the request', async () => {
    await GET(req('GET', { query: '?table=food-items&userId=someone-else' }));
    expect(readOne).toHaveBeenCalledWith('adminTablePreferences', { userId: 'admin-1', table: 'food-items' });
  });
  it('returns the saved layout', async () => {
    readOne.mockResolvedValue({ success: true, data: { columns: { order: ['b', 'a'], hidden: ['c'], widths: { a: 130 } }, updatedAt: '2026-10-05T00:00:00.000Z' } });
    const body = await (await GET(req('GET', { query: '?table=orders' }))).json();
    expect(body.data.columns).toEqual({ order: ['b', 'a'], hidden: ['c'], widths: { a: 130 } });
  });
  it('answers 500 when the database read fails', async () => {
    readOne.mockResolvedValue({ success: false, error: 'boom' });
    expect((await GET(req('GET', { query: '?table=orders' }))).status).toBe(500);
  });
});

describe('PUT', () => {
  it('rejects bad input', async () => {
    expect((await PUT(req('PUT', { rawBody: '{not json' }))).status).toBe(400);
    expect((await PUT(req('PUT', { body: { table: 'users', columns: {} } }))).status).toBe(400);
    expect((await PUT(req('PUT', { body: { table: 'orders', columns: 'x' } }))).status).toBe(400);
    expect((await PUT(req('PUT', { body: { table: 'orders' } }))).status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
  });
  it('rejects an oversized body', async () => {
    const big = { table: 'orders', columns: { order: [], hidden: [], widths: {} }, junk: 'x'.repeat(9000) };
    expect((await PUT(req('PUT', { body: big }))).status).toBe(413);
  });
  it('saves a layout for the admin in the token (upsert) and ignores a userId in the body', async () => {
    const res = await PUT(req('PUT', { body: { table: 'orders', userId: 'someone-else', columns: { order: ['b', 'a'], hidden: ['c'], widths: { a: 20 } } } }));
    expect(res.status).toBe(200);
    expect(updateOne).toHaveBeenCalledTimes(1);
    const [filter, update, options] = updateOne.mock.calls[0];
    expect(filter).toEqual({ userId: 'admin-1', table: 'orders' });
    expect(update.$set.columns).toEqual({ order: ['b', 'a'], hidden: ['c'], widths: { a: 60 } }); // width clamped
    expect(options).toEqual({ upsert: true });
    expect(createIndex).toHaveBeenCalledWith({ userId: 1, table: 1 }, { unique: true });
  });
  it('strips odd keys before saving', async () => {
    await PUT(req('PUT', { body: { table: 'food-items', columns: { order: ['ok', '$where', 5], hidden: ['bad key'], widths: { '$gt': 1, fine: 100 } } } }));
    const update = updateOne.mock.calls[0][1];
    expect(update.$set.columns).toEqual({ order: ['ok'], hidden: [], widths: { fine: 100 } });
  });
  it('deletes the saved layout when it is back to the default', async () => {
    const res = await PUT(req('PUT', { body: { table: 'orders', columns: { order: [], hidden: [], widths: {} } } }));
    expect(await res.json()).toEqual({ data: null });
    expect(deleteOne).toHaveBeenCalledWith('adminTablePreferences', { userId: 'admin-1', table: 'orders' });
    expect(updateOne).not.toHaveBeenCalled();
  });
  it('still saves if creating the index fails', async () => {
    createIndex.mockRejectedValue(new Error('no permission'));
    const res = await PUT(req('PUT', { body: { table: 'orders', columns: { hidden: ['a'] } } }));
    expect(res.status).toBe(200);
    expect(updateOne).toHaveBeenCalled();
  });
});
