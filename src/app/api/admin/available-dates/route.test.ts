import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- mocks: no real database or secrets needed
const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));

const invalidate = vi.fn();
vi.mock('@/lib/invalidateHomeMenuCache', () => ({ invalidateLivesiteHomeMenuCacheAndWait: () => invalidate() }));
const applyLocked = vi.fn();
vi.mock('@/lib/server/lockedMenu', () => ({ applyLockedMenuToDates: (...a: unknown[]) => applyLocked(...a) }));

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
  applyLocked.mockReset();
  applyLocked.mockResolvedValue({ added: 2, days: [] });
});

describe('POST: custom cutoff', () => {
  it('a cutoffAt (both kinds at once) sets flat and day-wise, replaces the older single field, and tells the customer site', async () => {
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt: CUTOFF }));
    expect(res.status).toBe(200);
    const [, filter, update] = updateOne.mock.calls[0];
    expect(String(filter._id)).toBe(ID);
    expect(update.$set.flatCutoffAt).toEqual(new Date(CUTOFF));
    expect(update.$set.dayWiseCutoffAt).toEqual(new Date(CUTOFF));
    expect(update.$unset).toEqual({ cutoffAt: '' });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect((await res.json()).livesiteNotified).toBe(true);
  });

  it('null clears both custom cutoffs (back to the standard rules)', async () => {
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt: null }));
    const [, , update] = updateOne.mock.calls[0];
    expect(update.$unset).toEqual({ flatCutoffAt: '', dayWiseCutoffAt: '', cutoffAt: '', flatCutoffSet: '', dayWiseCutoffSet: '' });
    expect(update.$set.flatCutoffAt).toBeUndefined();
    expect(update.$set.dayWiseCutoffAt).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('sets only the flat cutoff and leaves the day-wise one alone', async () => {
    const dayWiseExisting = new Date('2026-10-06T21:00:00.000Z');
    readOne.mockResolvedValueOnce({ success: true, data: { ...existing, dayWiseCutoffAt: dayWiseExisting } }).mockResolvedValue({ success: true, data: existing });
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, flatCutoffAt: CUTOFF }));
    const [, , update] = updateOne.mock.calls[0];
    expect(update.$set.flatCutoffAt).toEqual(new Date(CUTOFF));
    expect(update.$set.dayWiseCutoffAt).toEqual(dayWiseExisting);
    expect(update.$unset).toEqual({ cutoffAt: '' });
  });

  it('clears only the day-wise cutoff and keeps the flat one', async () => {
    const flatExisting = new Date('2026-10-06T22:00:00.000Z');
    readOne.mockResolvedValueOnce({ success: true, data: { ...existing, flatCutoffAt: flatExisting, dayWiseCutoffAt: new Date(CUTOFF) } }).mockResolvedValue({ success: true, data: existing });
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, dayWiseCutoffAt: null }));
    const [, , update] = updateOne.mock.calls[0];
    expect(update.$set.flatCutoffAt).toEqual(flatExisting);
    expect(update.$set.dayWiseCutoffAt).toBeUndefined();
    expect(update.$unset).toEqual({ dayWiseCutoffAt: '', cutoffAt: '', dayWiseCutoffSet: '' });
  });

  it('records when and by whom a custom cutoff was set, only for the kind that was set', async () => {
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, flatCutoffAt: CUTOFF }));
    const [, , update] = updateOne.mock.calls[0];
    expect(update.$set.flatCutoffSet.at).toBeInstanceOf(Date);
    expect(update.$set.dayWiseCutoffSet).toBeUndefined();
  });

  it('a date that still has the older single cutoff keeps it for the kind that was not changed', async () => {
    const legacy = new Date('2026-10-06T21:30:00.000Z');
    readOne.mockResolvedValueOnce({ success: true, data: { ...existing, cutoffAt: legacy } }).mockResolvedValue({ success: true, data: existing });
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, flatCutoffAt: CUTOFF }));
    const [, , update] = updateOne.mock.calls[0];
    expect(update.$set.flatCutoffAt).toEqual(new Date(CUTOFF));
    expect(update.$set.dayWiseCutoffAt).toEqual(legacy); // carried over from the older field, which is then removed
    expect(update.$unset).toEqual({ cutoffAt: '' });
  });

  it('rejects a bad per-kind cutoff and names the field', async () => {
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, flatCutoffAt: 'nope' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('flatCutoffAt');
    const res2 = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true, dayWiseCutoffAt: '2026-10-08T12:00:00.000Z' }));
    expect(res2.status).toBe(400);
    expect(updateOne).not.toHaveBeenCalled();
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
    expect(create.mock.calls[0][1].flatCutoffAt).toEqual(new Date(CUTOFF));
    expect(create.mock.calls[0][1].dayWiseCutoffAt).toEqual(new Date(CUTOFF));
    expect(create.mock.calls[0][1].cutoffAt).toBeUndefined();
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

describe('GET: per kind', () => {
  it('returns the flat and day-wise cutoffs of each date', async () => {
    read.mockResolvedValue({ success: true, data: [{ ...existing, flatCutoffAt: new Date(CUTOFF) }] });
    const body = await (await GET(req('GET', undefined, '?startDate=2026-10-01&endDate=2026-10-31'))).json();
    expect(body.data[0].flatCutoffAt).toBe(new Date(CUTOFF).toISOString());
    expect(body.data[0].dayWiseCutoffAt).toBeNull();
    expect(body.data[0].cutoffAt).toBeNull();
  });
});

describe('PUT (month-wide save): per kind cutoffs survive', () => {
  it('keeps each kind of custom cutoff and the older single one as they were', async () => {
    const legacy = new Date('2026-10-06T21:30:00.000Z');
    read
      .mockResolvedValueOnce({
        success: true,
        data: [
          { ...existing, flatCutoffAt: new Date(CUTOFF) },
          { _id: 'y', date: '2026-10-08', flatCategoryEnabled: true, dayWiseCategoryEnabled: true, cutoffAt: legacy },
        ],
      })
      .mockResolvedValue({ success: true, data: [] });
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
    const inserted = createMany.mock.calls[0][1] as Array<{ date: string; cutoffAt?: Date; flatCutoffAt?: Date; dayWiseCutoffAt?: Date }>;
    const a = inserted.find((d) => d.date === DAY)!;
    expect(a.flatCutoffAt).toEqual(new Date(CUTOFF));
    expect(a.dayWiseCutoffAt).toBeUndefined();
    expect(a.cutoffAt).toBeUndefined();
    const b = inserted.find((d) => d.date === '2026-10-08')!;
    expect(b.cutoffAt).toEqual(legacy);
    expect(b.flatCutoffAt).toBeUndefined();
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

describe('locked rows repeat onto days that are switched on for day-wise ordering', () => {
  it('POST: a brand new day with day-wise on', async () => {
    readOne.mockResolvedValueOnce({ success: true, data: null }).mockResolvedValueOnce({ success: true, data: { ...existing } });
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true }));
    expect(res.status).toBe(201);
    expect(applyLocked).toHaveBeenCalledWith([DAY]);
    expect((await res.json()).lockedItemsAdded).toBe(2);
  });
  it('POST: a brand new day with day-wise off does nothing', async () => {
    readOne.mockResolvedValueOnce({ success: true, data: null }).mockResolvedValueOnce({ success: true, data: { ...existing } });
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: false }));
    expect(applyLocked).not.toHaveBeenCalled();
  });
  it('POST: an existing day switched from off to on', async () => {
    readOne.mockResolvedValueOnce({ success: true, data: { ...existing, dayWiseCategoryEnabled: false } }).mockResolvedValue({ success: true, data: existing });
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true }));
    expect(applyLocked).toHaveBeenCalledWith([DAY]);
  });
  it('POST: a day that was already on (for example a cutoff change) is not touched again', async () => {
    readOne.mockResolvedValueOnce({ success: true, data: { ...existing, dayWiseCategoryEnabled: true } }).mockResolvedValue({ success: true, data: existing });
    await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true }));
    expect(applyLocked).not.toHaveBeenCalled();
  });
  it('POST: a failure while repeating the rows never fails the day save', async () => {
    applyLocked.mockRejectedValue(new Error('boom'));
    readOne.mockResolvedValueOnce({ success: true, data: { ...existing, dayWiseCategoryEnabled: false } }).mockResolvedValue({ success: true, data: existing });
    const res = await POST(req('POST', { date: DAY, flatCategoryEnabled: true, dayWiseCategoryEnabled: true }));
    expect(res.status).toBe(200);
  });
  it('PUT: only the days switched on by this save', async () => {
    // reads: (1) custom cutoffs in the range, (2) days already on, (3) the final list
    read
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [{ _id: 'k', date: '2026-10-08', dayWiseCategoryEnabled: true }] })
      .mockResolvedValue({ success: true, data: [] });
    const res = await PUT(
      req('PUT', {
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        dates: [
          { date: '2026-10-08', flatCategoryEnabled: true, dayWiseCategoryEnabled: true }, // already on
          { date: '2026-10-15', flatCategoryEnabled: true, dayWiseCategoryEnabled: true }, // new
          { date: '2026-10-16', flatCategoryEnabled: true, dayWiseCategoryEnabled: false }, // not day-wise
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(applyLocked).toHaveBeenCalledWith(['2026-10-15']);
  });
});
