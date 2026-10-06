import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const invalidate = vi.fn();
vi.mock('@/lib/invalidateHomeMenuCache', () => ({ invalidateLivesiteHomeMenuCacheAndWait: () => invalidate() }));

const readOne = vi.fn();
const read = vi.fn();
const updateOne = vi.fn();
const create = vi.fn();
const createMany = vi.fn();
const del = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    readOne: (...a: unknown[]) => readOne(...a),
    read: (...a: unknown[]) => read(...a),
    updateOne: (...a: unknown[]) => updateOne(...a),
    create: (...a: unknown[]) => create(...a),
    createMany: (...a: unknown[]) => createMany(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { GET, POST, PUT } from './route';

const ID = '64b7f0c2a1b2c3d4e5f60001';
const DAY = '2026-10-07'; // standard cutoff: Tue Oct 6, 1 PM Pacific = 20:00Z
const CUTOFF = '2026-10-06T23:00:00.000Z'; // Tue Oct 6, 4 PM Pacific

function req(method: string, body?: unknown, query = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json', authorization: 'Bearer good' };
  return new NextRequest(`http://localhost/api/admin/available-dates${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const existing = { _id: ID, date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true };

beforeEach(() => {
  vi.clearAllMocks();
  verifyToken.mockImplementation((t: string) => (t === 'good' ? { success: true, payload: { userId: 'admin-1', role: 'admin' } } : { success: false, error: 'Invalid token' }));
  readOne.mockResolvedValue({ success: true, data: existing });
  read.mockResolvedValue({ success: true, data: [] });
  updateOne.mockResolvedValue({ success: true });
  create.mockResolvedValue({ success: true, id: ID });
  createMany.mockResolvedValue({ success: true, ids: ['a'] });
  del.mockResolvedValue({ success: true, deletedCount: 0 });
  invalidate.mockResolvedValue(true);
});

describe('POST: custom cutoff', () => {
  it('sets a custom cutoff, keeps the toggles, and tells the customer site', async () => {
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt: CUTOFF }));
    expect(res.status).toBe(200);
    const [, filter, update] = updateOne.mock.calls[0];
    expect(String(filter._id)).toBe(ID);
    expect(update.$set.cutoffAt).toEqual(new Date(CUTOFF));
    expect(update.$unset).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect((await res.json()).livesiteNotified).toBe(true);
  });

  it('null clears the custom cutoff (back to the standard rule)', async () => {
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt: null }));
    const [, , update] = updateOne.mock.calls[0];
    expect(update.$unset).toEqual({ cutoffAt: '' });
    expect(update.$set.cutoffAt).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('leaves the cutoff alone when the field is not sent (a plain availability toggle)', async () => {
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: false, dayWiseCategoryEnabled: true }));
    expect(res.status).toBe(200);
    const [, , update] = updateOne.mock.calls[0];
    expect('cutoffAt' in update.$set).toBe(false);
    expect(update.$unset).toBeUndefined();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('creates a new date with the custom cutoff', async () => {
    readOne.mockResolvedValueOnce({ success: true, data: null }).mockResolvedValueOnce({ success: true, data: { ...existing, cutoffAt: new Date(CUTOFF) } });
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: false, cutoffAt: CUTOFF }));
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][1].cutoffAt).toEqual(new Date(CUTOFF));
  });

  it('rejects an unreadable cutoff, one a week+ too early, and one after the delivery day', async () => {
    for (const cutoffAt of ['not a date', 12345, '2026-09-20T00:00:00.000Z', '2026-10-08T12:00:00.000Z']) {
      const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt }));
      expect(res.status).toBe(400);
    }
    expect(updateOne).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('still answers 200 when the customer site could not be told', async () => {
    invalidate.mockResolvedValue(false);
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt: CUTOFF }));
    expect(res.status).toBe(200);
    expect((await res.json()).livesiteNotified).toBe(false);
  });

  it('needs an admin login', async () => {
    const res = await POST(new NextRequest('http://localhost/api/admin/available-dates', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('returns each date with its custom cutoff (null when none)', async () => {
    read.mockResolvedValue({ success: true, data: [{ ...existing, cutoffAt: new Date(CUTOFF) }, { _id: 'x', date: '2026-10-08', flatCategoryEnabled: true, dayWiseCategoryEnabled: true }] });
    const body = await (await GET(req('GET', undefined, '?startDate=2026-10-01&endDate=2026-10-31'))).json();
    expect(body.data.map((d: { cutoffAt: unknown }) => d.cutoffAt)).toEqual([new Date(CUTOFF).toISOString(), null]);
  });
});

describe('PUT (month-wide save: delete + reinsert)', () => {
  it('keeps the custom cutoffs of dates in the range', async () => {
    read.mockResolvedValueOnce({ success: true, data: [{ ...existing, cutoffAt: new Date(CUTOFF) }] }).mockResolvedValue({ success: true, data: [] });
    const res = await PUT(
      req('PUT', {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        dates: [
          { date: DAY, flatCategoryEnabled: false, dayWiseCategoryEnabled: false },
          { date: '2026-10-08', flatCategoryEnabled: false, dayWiseCategoryEnabled: false },
        ],
      })
    );
    expect(res.status).toBe(200);
    const inserted = createMany.mock.calls[0][1] as Array<{ date: string; cutoffAt?: Date }>;
    expect(inserted.find((d) => d.date === DAY)?.cutoffAt).toEqual(new Date(CUTOFF));
    expect(inserted.find((d) => d.date === '2026-10-08')?.cutoffAt).toBeUndefined();
    // the existing cutoffs were read BEFORE the delete
    expect(read.mock.invocationCallOrder[0]).toBeLessThan(del.mock.invocationCallOrder[0]);
  });

  it('stops (and deletes nothing) if the existing cutoffs cannot be read', async () => {
    read.mockResolvedValueOnce({ success: false, error: 'boom' });
    const res = await PUT(req('PUT', { startDate: '2026-10-01', endDate: '2026-10-31', dates: [{ date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true }] }));
    expect(res.status).toBe(500);
    expect(del).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});
