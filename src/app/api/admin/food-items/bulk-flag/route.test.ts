import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const update = vi.fn();
vi.mock('@/lib/db', () => ({ db: { update: (...a: unknown[]) => update(...a) } }));
const invalidate = vi.fn();
vi.mock('@/lib/invalidateHomeMenuCache', () => ({ invalidateLivesiteHomeMenuCacheAndWait: () => invalidate() }));

import { PATCH } from './route';

const MAX_BULK_ITEMS = 1000; // keep in step with route.ts
const A = '64b7f0c2a1b2c3d4e5f60001';
const B = '64b7f0c2a1b2c3d4e5f60002';

function req(opts: { body?: unknown; rawBody?: string; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return new NextRequest('http://localhost/api/admin/food-items/bulk-flag', { method: 'PATCH', headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good' ? { success: true, payload: { userId: 'a1', role: 'admin' } } : t === 'user' ? { success: true, payload: { userId: 'u1', role: 'user' } } : { success: false, error: 'Invalid token' }
  );
  update.mockResolvedValue({ success: true, modifiedCount: 2 });
  invalidate.mockResolvedValue(true);
});

describe('bulk-flag', () => {
  it('needs an admin', async () => {
    const body = { ids: [A], field: 'available', value: true };
    expect((await PATCH(req({ body, token: null }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'nope' }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'user' }))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects other fields, non-booleans, bad ids and too many ids', async () => {
    for (const body of [
      { ids: [A], field: 'price', value: true },
      { ids: [A], field: '$set', value: true },
      { ids: [A], field: 'available', value: 'true' },
      { ids: [A], field: 'veg' },
      { ids: [], field: 'veg', value: true },
      { ids: ['abc'], field: 'veg', value: true },
      { ids: { $ne: 1 }, field: 'veg', value: true },
      { ids: Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => (i + 1).toString(16).padStart(24, '0')), field: 'veg', value: true },
    ]) {
      expect((await PATCH(req({ body }))).status).toBe(400);
    }
    expect((await PATCH(req({ rawBody: 'not json' }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it('sets exactly that field on exactly those items and clears the menu cache', async () => {
    const res = await PATCH(req({ body: { ids: [A, A, B], field: 'available', value: false } }));
    expect(res.status).toBe(200);
    const [collection, filter, change] = update.mock.calls[0];
    expect(collection).toBe('fooditems');
    expect(filter._id.$in.map(String)).toEqual([A, B]);
    expect(Object.keys(change)).toEqual(['$set']);
    expect(Object.keys(change.$set).sort()).toEqual(['available', 'updatedAt']);
    expect(change.$set.available).toBe(false);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect((await res.json()).data).toMatchObject({ requested: 2, modified: 2, field: 'available', value: false, livesiteNotified: true });
  });
  it('veg works the same way', async () => {
    await PATCH(req({ body: { ids: [A], field: 'veg', value: true } }));
    expect(update.mock.calls[0][2].$set.veg).toBe(true);
  });
  it('a database failure is a 500 and the cache is left alone', async () => {
    update.mockResolvedValue({ success: false, error: 'boom' });
    expect((await PATCH(req({ body: { ids: [A], field: 'veg', value: true } }))).status).toBe(500);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
