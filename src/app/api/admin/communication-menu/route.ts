import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { buildDayMenus, type MenuCategory, type MenuFood, type MenuMapping } from '@/utils/communicationMenu';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const oid = (v: unknown) => (v instanceof ObjectId ? v : typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) ? new ObjectId(v) : null);

/**
 * GET /api/admin/communication-menu?dates=2026-11-17,2026-11-18
 * The day-wise menu of each date, as dish names in the order customers see them (what the New menu email starts from). Read only.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const dates = [...new Set((new URL(request.url).searchParams.get('dates') ?? '').split(',').map((d) => d.trim()).filter(Boolean))];
  if (dates.length === 0 || dates.length > 10 || dates.some((d) => !DATE.test(d))) {
    return NextResponse.json({ error: 'Send up to 10 dates like 2026-11-17' }, { status: 400 });
  }
  try {
    const mapped = await db.read<{ day?: string; categoryId?: unknown; foodItemId?: unknown; sequence?: number }>('categoryfoodmapping', { mappingType: 'DAY_WISE', day: { $in: dates } } as never);
    const mappings: MenuMapping[] = (mapped.success ? mapped.data ?? [] : [])
      .filter((m) => m.day && m.categoryId && m.foodItemId)
      .map((m) => ({ day: String(m.day), categoryId: String(m.categoryId), foodItemId: String(m.foodItemId), sequence: m.sequence }));
    const foodIds = [...new Set(mappings.map((m) => m.foodItemId))].map(oid).filter((v): v is ObjectId => Boolean(v));
    const catIds = [...new Set(mappings.map((m) => m.categoryId))].map(oid).filter((v): v is ObjectId => Boolean(v));
    const foodRes = foodIds.length ? await db.read<{ _id: ObjectId; name?: string; available?: boolean; isDraft?: boolean }>('fooditems', { _id: { $in: foodIds } } as never, { projection: { name: 1, available: 1, isDraft: 1 } } as never) : { success: true, data: [] };
    const toCategory = (c: { _id: ObjectId; name?: string; sequence?: number; isDraft?: boolean; parentCategoryId?: unknown }): MenuCategory => ({ id: String(c._id), name: c.name, sequence: c.sequence, isDraft: c.isDraft, parentId: c.parentCategoryId ? String(c.parentCategoryId) : undefined });
    type CatDoc = { _id: ObjectId; name?: string; sequence?: number; isDraft?: boolean; parentCategoryId?: unknown };
    const catRes = catIds.length ? await db.read<CatDoc>('foodcategories', { _id: { $in: catIds } } as never) : { success: true, data: [] as CatDoc[] };
    const categories = (catRes.success ? catRes.data ?? [] : []).map(toCategory);
    // the parents of sub-categories (their order and whether they are switched off)
    const parentIds = [...new Set(categories.map((c) => c.parentId).filter((p): p is string => Boolean(p) && !categories.some((c) => c.id === p)))].map(oid).filter((v): v is ObjectId => Boolean(v));
    if (parentIds.length) {
      const parents = await db.read<CatDoc>('foodcategories', { _id: { $in: parentIds } } as never);
      categories.push(...(parents.success ? parents.data ?? [] : []).map(toCategory));
    }
    const foods: MenuFood[] = (foodRes.success ? foodRes.data ?? [] : []).map((f) => ({ id: String(f._id), name: String(f.name ?? ''), available: f.available, isDraft: f.isDraft }));
    return NextResponse.json({ data: { menus: buildDayMenus(dates, mappings, categories, foods) } });
  } catch (error) {
    console.error('[communication-menu] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Could not load the menu' }, { status: 500 });
  }
}
