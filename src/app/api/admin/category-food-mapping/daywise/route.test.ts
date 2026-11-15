import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyToken = vi.fn();
vi.mock('@/lib/jwt', () => ({ jwtHandler: { verifyToken: (t: string) => verifyToken(t) } }));
const del = vi.fn();
vi.mock('@/lib/db', () => ({ db: { delete: (...a: unknown[]) => del(...a), deleteOne: vi.fn(), readOne: vi.fn() } }));
vi.mock('@/lib/invalidateHomeMenuCache', () => ({ invalidateLivesiteHomeMenuCache: vi.fn() }));

import { DELETE } from './route';

const CATEGORY = 'a'.repeat(24);
const call = (query: string, token: string | null = 'good') =>
  DELETE(new NextRequest(`http://localhost/api/admin/category-food-mapping/daywise${query}`, { method: 'DELETE', headers: token ? { authorization: `Bearer ${token}` } : {} }));

describe('DELETE /api/admin/category-food-mapping/daywise', () => {
  beforeEach(() => {
    verifyToken.mockReset().mockReturnValue({ success: true, payload: { userId: 'u1', role: 'admin' } });
    del.mockReset().mockResolvedValue({ success: true, deletedCount: 3 });
  });

  it('with fromDay only the rows of that day and later are deleted (earlier days are kept)', async () => {
    const res = await call(`?categoryId=${CATEGORY}&fromDay=2026-11-17`);
    expect(res.status).toBe(200);
    const filter = del.mock.calls[0][1] as Record<string, unknown>;
    expect(filter.mappingType).toBe('DAY_WISE');
    expect(filter.day).toEqual({ $gte: '2026-11-17' });
    expect(String(filter.categoryId)).toBe(CATEGORY);
    expect((await res.json()).data.fromDay).toBe('2026-11-17');
  });

  it('without fromDay it still deletes the whole category, as before', async () => {
    await call(`?categoryId=${CATEGORY}`);
    const filter = del.mock.calls[0][1] as Record<string, unknown>;
    expect(filter.day).toBeUndefined();
  });

  it('an exact day wins over fromDay', async () => {
    await call(`?categoryId=${CATEGORY}&day=2026-11-18&fromDay=2026-11-17`);
    expect((del.mock.calls[0][1] as Record<string, unknown>).day).toBe('2026-11-18');
  });

  it('refuses a fromDay that is not a date, and a missing login', async () => {
    expect((await call(`?categoryId=${CATEGORY}&fromDay=tomorrow`)).status).toBe(400);
    expect(del).not.toHaveBeenCalled();
    verifyToken.mockReturnValue({ success: false, error: 'bad' });
    expect((await call(`?categoryId=${CATEGORY}&fromDay=2026-11-17`, 'bad')).status).toBe(401);
  });
});
