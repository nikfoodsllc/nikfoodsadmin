import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const invalidate = vi.fn();
vi.mock('@/lib/invalidateHomeMenuCache', () => ({ invalidateLivesiteHomeMenuCacheAndWait: () => invalidate() }));

const find = vi.fn();
const bulkWrite = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    getDb: async () => ({
      collection: () => ({
        find: (...a: unknown[]) => ({ toArray: async () => find(...a) }),
        bulkWrite: (...a: unknown[]) => bulkWrite(...a),
      }),
    }),
  },
}));

import { PATCH } from './route';

const A = '64b7f0c2a1b2c3d4e5f60001';
const B = '64b7f0c2a1b2c3d4e5f60002';
const C = '64b7f0c2a1b2c3d4e5f60003';
const PARENT = '64b7f0c2a1b2c3d4e5f60009';

function req(opts: { body?: unknown; rawBody?: string; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return new NextRequest('http://localhost/api/admin/food-category/reorder', { method: 'PATCH', headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good'
      ? { success: true, payload: { userId: 'admin-1', role: 'admin' } }
      : t === 'user'
        ? { success: true, payload: { userId: 'u1', role: 'user' } }
        : { success: false, error: 'Invalid token' },
  );
  find.mockReturnValue([
    { _id: A, sequence: 1 },
    { _id: B, sequence: 2 },
    { _id: C, sequence: 3 },
  ]);
  bulkWrite.mockResolvedValue({});
  invalidate.mockResolvedValue(true);
});

describe('PATCH /api/admin/food-category/reorder', () => {
  it('rejects no token, a bad token and a customer token without touching the database', async () => {
    const body = { parentId: null, orderedIds: [A, B, C] };
    expect((await PATCH(req({ body, token: null }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'bad' }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'user' }))).status).toBe(401);
    expect(find).not.toHaveBeenCalled();
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects bad JSON and a bad parentId', async () => {
    expect((await PATCH(req({ rawBody: '{nope' }))).status).toBe(400);
    expect((await PATCH(req({ body: { parentId: 'abc', orderedIds: [A] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { parentId: 5, orderedIds: [A] } }))).status).toBe(400);
  });

  it('renumbers only the categories whose rank changes, in one write, and clears the livesite menu cache', async () => {
    const res = await PATCH(req({ body: { parentId: null, orderedIds: [B, A, C] } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.changed).toBe(2);
    expect(body.data.livesiteNotified).toBe(true);
    const ops = bulkWrite.mock.calls[0][0] as Array<{
      updateOne: { filter: { _id: { toString(): string } }; update: { $set: { sequence: number } } };
    }>;
    expect(ops.map((o) => [o.updateOne.filter._id.toString(), o.updateOne.update.$set.sequence])).toEqual([
      [B, 1],
      [A, 2],
    ]);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('still answers 200 (and says so) when the livesite could not be told', async () => {
    invalidate.mockResolvedValue(false);
    const res = await PATCH(req({ body: { parentId: null, orderedIds: [B, A, C] } }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.livesiteNotified).toBe(false);
  });

  it('writes nothing and keeps the cache when the order is unchanged', async () => {
    const res = await PATCH(req({ body: { parentId: null, orderedIds: [A, B, C] } }));
    expect((await res.json()).data.changed).toBe(0);
    expect(bulkWrite).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('looks up the sub-categories of the given parent, never other groups', async () => {
    await PATCH(req({ body: { parentId: PARENT, orderedIds: [A, B, C] } }));
    const filter = find.mock.calls[0][0] as { parentCategoryId: { $in: unknown[] } };
    expect(filter.parentCategoryId.$in.map(String)).toEqual([PARENT, PARENT]);
  });

  it('answers 409 when the list no longer matches the group, and 400 for junk', async () => {
    expect((await PATCH(req({ body: { parentId: null, orderedIds: [A, B] } }))).status).toBe(409);
    expect((await PATCH(req({ body: { parentId: null, orderedIds: [A, B, '64b7f0c2a1b2c3d4e5f6ffff'] } }))).status).toBe(409);
    expect((await PATCH(req({ body: { parentId: null, orderedIds: [A, A, B] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { parentId: null } }))).status).toBe(400);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('answers 500 when the database fails', async () => {
    bulkWrite.mockRejectedValue(new Error('boom'));
    expect((await PATCH(req({ body: { parentId: null, orderedIds: [B, A, C] } }))).status).toBe(500);
  });
});
