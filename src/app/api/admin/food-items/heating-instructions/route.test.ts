import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const update = vi.fn();
vi.mock('@/lib/db', () => ({ db: { update: (...a: unknown[]) => update(...a) } }));
const remember = vi.fn();
vi.mock('@/lib/heatingInstructionsLibrary', () => ({ rememberHeatingInstruction: (...a: unknown[]) => remember(...a) }));

import { PATCH } from './route';

const A = '64b7f0c2a1b2c3d4e5f60001';
const B = '64b7f0c2a1b2c3d4e5f60002';

function req(opts: { body?: unknown; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  return new NextRequest('http://localhost/api/admin/food-items/heating-instructions', { method: 'PATCH', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good' ? { success: true, payload: { userId: 'a', role: 'admin' } } : t === 'user' ? { success: true, payload: { userId: 'u', role: 'user' } } : { success: false, error: 'bad' }
  );
  update.mockResolvedValue({ success: true, modifiedCount: 2 });
});

describe('PATCH heating-instructions', () => {
  it('needs an admin', async () => {
    expect((await PATCH(req({ body: { ids: [A], text: 'x' }, token: null }))).status).toBe(401);
    expect((await PATCH(req({ body: { ids: [A], text: 'x' }, token: 'user' }))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects bad bodies', async () => {
    expect((await PATCH(req({ body: { ids: [], text: 'x' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: ['nope'], text: 'x' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], text: 5 } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A], text: '   ' } }))).status).toBe(400);
    expect((await PATCH(req({ body: { ids: [A] } }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it('sets the cleaned text on the ticked items and remembers it', async () => {
    const res = await PATCH(req({ body: { ids: [A, B, A], text: '  Keep   Refrigerated ' } }));
    expect(res.status).toBe(200);
    const [collection, filter, change] = update.mock.calls[0];
    expect(collection).toBe('fooditems');
    expect((filter as { _id: { $in: unknown[] } })._id.$in).toHaveLength(2);
    expect((change as { $set: { heatingInstructions: string } }).$set.heatingInstructions).toBe('Keep Refrigerated');
    expect(remember).toHaveBeenCalledWith('Keep Refrigerated');
  });
  it('clears the field for null', async () => {
    const res = await PATCH(req({ body: { ids: [A], text: null } }));
    expect(res.status).toBe(200);
    const change = update.mock.calls[0][2] as { $unset: Record<string, string> };
    expect(change.$unset).toHaveProperty('heatingInstructions');
    expect(remember).not.toHaveBeenCalled();
  });
});
