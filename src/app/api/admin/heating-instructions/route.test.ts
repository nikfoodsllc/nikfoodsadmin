import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const readAll = vi.fn();
const readCounts = vi.fn();
const rename = vi.fn();
const remove = vi.fn();
vi.mock('@/lib/heatingInstructionsLibrary', () => ({
  readHeatingInstructions: () => readAll(),
  readHeatingInstructionsWithCounts: () => readCounts(),
  renameHeatingInstruction: (...a: unknown[]) => rename(...a),
  deleteHeatingInstruction: (...a: unknown[]) => remove(...a),
}));

import { DELETE, GET, PATCH } from './route';

function req(method: string, opts: { body?: unknown; token?: string | null; query?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? 'good'}`;
  return new NextRequest('http://localhost/api/admin/heating-instructions' + (opts.query ?? ''), { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) =>
    t === 'good' ? { success: true, payload: { userId: 'a', role: 'admin' } } : t === 'user' ? { success: true, payload: { userId: 'u', role: 'user' } } : { success: false, error: 'bad' }
  );
  readAll.mockResolvedValue(['A', 'B']);
  readCounts.mockResolvedValue([{ text: 'A', count: 2 }]);
  rename.mockResolvedValue({ ok: true, updatedItems: 2, merged: false });
  remove.mockResolvedValue({ ok: true, clearedItems: 2 });
});

describe('heating-instructions route', () => {
  it('needs an admin for every method', async () => {
    for (const [fn, m] of [[GET, 'GET'], [PATCH, 'PATCH'], [DELETE, 'DELETE']] as const) {
      expect((await fn(req(m, { token: null, body: m === 'GET' ? undefined : {} }))).status).toBe(401);
      expect((await fn(req(m, { token: 'user', body: m === 'GET' ? undefined : {} }))).status).toBe(401);
    }
    expect(rename).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it('lists the instructions, with counts on request', async () => {
    expect(await (await GET(req('GET'))).json()).toEqual({ data: ['A', 'B'] });
    expect(await (await GET(req('GET', { query: '?counts=1' }))).json()).toEqual({ data: [{ text: 'A', count: 2 }] });
  });
  it('renames and deletes through the library and passes its answer on', async () => {
    const renamed = await PATCH(req('PATCH', { body: { from: 'A', to: 'C' } }));
    expect(renamed.status).toBe(200);
    expect(rename).toHaveBeenCalledWith('A', 'C');
    const deleted = await DELETE(req('DELETE', { body: { text: 'A' } }));
    expect(deleted.status).toBe(200);
    expect(remove).toHaveBeenCalledWith('A');
    expect((await deleted.json()).data.clearedItems).toBe(2);
  });
  it('passes a refusal on with its status', async () => {
    rename.mockResolvedValueOnce({ ok: false, error: 'That instruction is not in the list', status: 404 });
    const res = await PATCH(req('PATCH', { body: { from: 'Z', to: 'Y' } }));
    expect(res.status).toBe(404);
    remove.mockResolvedValueOnce({ ok: false, error: 'Which instruction?', status: 400 });
    expect((await DELETE(req('DELETE', { body: {} }))).status).toBe(400);
  });
  it('rejects a body that is not JSON', async () => {
    const bad = new NextRequest('http://localhost/api/admin/heating-instructions', { method: 'PATCH', headers: { authorization: 'Bearer good' }, body: 'nope' });
    expect((await PATCH(bad)).status).toBe(400);
  });
});
