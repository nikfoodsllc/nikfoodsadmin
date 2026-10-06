import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const update = vi.fn();
vi.mock('@/lib/db', () => ({ db: { update: (...a: unknown[]) => update(...a) } }));

import { PATCH } from './route';

const MAX_BULK_ITEMS = 1000; // keep in step with route.ts

const URL_BASE = 'http://localhost/api/admin/food-items/preparation-type';
const A = '64b7f0c2a1b2c3d4e5f60001';
const B = '64b7f0c2a1b2c3d4e5f60002';

function req(opts: { body?: unknown; rawBody?: string; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return new NextRequest(URL_BASE, { method: 'PATCH', headers, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good'
      ? { success: true, payload: { userId: 'admin-1', role: 'admin' } }
      : t === 'user'
        ? { success: true, payload: { userId: 'u1', role: 'user' } }
        : { success: false, error: 'Invalid token' }
  );
  update.mockResolvedValue({ success: true, modifiedCount: 2 });
});

describe('authentication', () => {
  it('rejects no token, a bad token and a customer token', async () => {
    const body = { ids: [A], preparationType: 'cooked' };
    expect((await PATCH(req({ body, token: null }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'nope' }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'user' }))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('validation', () => {
  it('rejects a body that is not JSON', async () => {
    expect((await PATCH(req({ rawBody: 'not json' }))).status).toBe(400);
  });
  it('rejects an unknown type, including undefined', async () => {
    expect((await PATCH(req({ body: { ids: [A], preparationType: 'fried' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], preparationType: '' } }))).status).toBe(400);
  });
  it('rejects missing, empty and bad ids', async () => {
    expect((await PATCH(req({ body: { preparationType: 'cooked' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [], preparationType: 'cooked' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: ['abc'], preparationType: 'cooked' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A, 5], preparationType: 'cooked' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: { $ne: 1 }, preparationType: 'cooked' } }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects too many ids', async () => {
    const ids = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => (i + 1).toString(16).padStart(24, '0'));
    expect((await PATCH(req({ body: { ids, preparationType: 'cooked' } }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('updating', () => {
  it('sets the type on exactly the chosen items and nothing else', async () => {
    const res = await PATCH(req({ body: { ids: [A, B], preparationType: 'ready_to_eat' } }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    const [collection, filter, change] = update.mock.calls[0];
    expect(collection).toBe('fooditems');
    expect(filter._id.$in.map(String)).toEqual([A, B]);
    expect(Object.keys(change)).toEqual(['$set']);
    expect(change.$set.preparationType).toBe('ready_to_eat');
    expect(Object.keys(change.$set).sort()).toEqual(['preparationType', 'updatedAt']);
    const json = await res.json();
    expect(json.data).toEqual({ requested: 2, modified: 2, preparationType: 'ready_to_eat' });
  });

  it('ignores duplicate ids', async () => {
    await PATCH(req({ body: { ids: [A, A, B], preparationType: 'cooked' } }));
    expect(update.mock.calls[0][1]._id.$in).toHaveLength(2);
  });

  it('null puts items back to "not set yet" by removing the field', async () => {
    const res = await PATCH(req({ body: { ids: [A], preparationType: null } }));
    expect(res.status).toBe(200);
    const change = update.mock.calls[0][2];
    expect(change.$unset).toEqual({ preparationType: '' });
    expect(change.$set).not.toHaveProperty('preparationType');
  });

  it('reports a database failure as 500', async () => {
    update.mockResolvedValue({ success: false, error: 'boom' });
    const res = await PATCH(req({ body: { ids: [A], preparationType: 'cooked' } }));
    expect(res.status).toBe(500);
  });
});
