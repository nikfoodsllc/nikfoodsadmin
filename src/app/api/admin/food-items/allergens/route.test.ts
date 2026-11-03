import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const update = vi.fn();
vi.mock('@/lib/db', () => ({ db: { update: (...a: unknown[]) => update(...a) } }));

vi.mock('@/lib/invalidateHomeMenuCache', () => ({ invalidateLivesiteHomeMenuCacheAndWait: async () => true }));

import { PATCH } from './route';

const MAX_BULK_ITEMS = 1000; // keep in step with route.ts

const URL_BASE = 'http://localhost/api/admin/food-items/allergens';
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
    const body = { ids: [A], mode: 'add', allergens: ['milk'] };
    expect((await PATCH(req({ body, token: null }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'nope' }))).status).toBe(401);
    expect((await PATCH(req({ body, token: 'user' }))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('validation', () => {
  it('rejects a body that is not JSON, a bad mode and bad allergens', async () => {
    expect((await PATCH(req({ rawBody: 'not json' }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], mode: 'set', allergens: ['milk'] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], mode: 'add', allergens: 'milk' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], mode: 'add', allergens: ['milk', 'wheat'] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], mode: 'add', allergens: [] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], mode: 'remove', allergens: [] } }))).status).toBe(400);
  });
  it('rejects missing, empty, bad and too many ids', async () => {
    expect((await PATCH(req({ body: { mode: 'add', allergens: ['milk'] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [], mode: 'add', allergens: ['milk'] } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: ['abc'], mode: 'add', allergens: ['milk'] } }))).status).toBe(400);
    const many = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => (0x64b7f0c2a1b2c3d4e5f60000 + i).toString(16));
    expect((await PATCH(req({ body: { ids: many, mode: 'add', allergens: ['milk'] } }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('adds with $addToSet, replaces with $set, removes with $pull', async () => {
    await PATCH(req({ body: { ids: [A, B], mode: 'add', allergens: ['gluten', 'milk'] } }));
    expect(update.mock.calls[0][2]).toMatchObject({ $addToSet: { allergens: { $each: ['milk', 'gluten'] } } });
    await PATCH(req({ body: { ids: [A], mode: 'replace', allergens: ['soy'] } }));
    expect(update.mock.calls[1][2]).toMatchObject({ $set: { allergens: ['soy'] } });
    await PATCH(req({ body: { ids: [A], mode: 'remove', allergens: ['eggs'] } }));
    expect(update.mock.calls[2][2]).toMatchObject({ $pull: { allergens: { $in: ['eggs'] } } });
  });
  it('replace with an empty list means no allergens', async () => {
    const res = await PATCH(req({ body: { ids: [A], mode: 'replace', allergens: [] } }));
    expect(res.status).toBe(200);
    expect(update.mock.calls[0][2]).toMatchObject({ $set: { allergens: [] } });
  });
  it('answers with the counts', async () => {
    const res = await PATCH(req({ body: { ids: [A, B, A], mode: 'add', allergens: ['milk'] } }));
    expect((await res.json()).data).toMatchObject({ requested: 2, modified: 2, mode: 'add', allergens: ['milk'] });
  });
});
