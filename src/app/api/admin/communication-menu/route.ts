import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { buildCategoryItems, buildDayMenus, flatCategoryOptions, MENU_EMAIL_SUBCATEGORIES, type ItemSubCategories, type MenuCategory, type MenuFood, type MenuMapping } from '@/utils/communicationMenu';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const oid = (v: unknown) => (v instanceof ObjectId ? v : typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) ? new ObjectId(v) : null);

/**
 * GET /api/admin/communication-menu?dates=2026-11-17,2026-11-18   the day-wise menu of each date, as dish names in the order customers see them
 * GET /api/admin/communication-menu?list=categories               the flat categories an extra box can be filled from
 * GET /api/admin/communication-menu?category=<id>                 the items of one flat category (and its sub-categories) as dish names
 * What the New menu email starts from. Read only.
 */
type CatDoc = { _id: ObjectId; name?: string; sequence?: number; isDraft?: boolean; parentCategoryId?: unknown; listingType?: string };
const toCategory = (c: CatDoc): MenuCategory & { listingType?: string } => ({ id: String(c._id), name: c.name, sequence: c.sequence, isDraft: c.isDraft, parentId: c.parentCategoryId ? String(c.parentCategoryId) : undefined, listingType: c.listingType });

async function categoryRoutes(url: URL): Promise<NextResponse | null> {
  if (url.searchParams.get('list') === 'categories') {
    const all = await db.read<CatDoc>('foodcategories', {} as never);
    return NextResponse.json({ data: { categories: flatCategoryOptions((all.success ? all.data ?? [] : []).map(toCategory)) } });
  }
  const id = url.searchParams.get('category');
  if (id !== null) {
    const root = oid(id);
    if (!root) return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
    const all = await db.read<CatDoc>('foodcategories', {} as never);
    const categories = (all.success ? all.data ?? [] : []).map(toCategory);
    const ids = [String(root), ...categories.filter((c) => c.parentId === String(root)).map((c) => c.id)].map(oid).filter((v): v is ObjectId => Boolean(v));
    const mapped = await db.read<{ categoryId?: unknown; foodItemId?: unknown; sequence?: number }>('categoryfoodmapping', { mappingType: 'FLAT', categoryId: { $in: ids } } as never);
    const mappings = (mapped.success ? mapped.data ?? [] : []).filter((m) => m.categoryId && m.foodItemId).map((m) => ({ categoryId: String(m.categoryId), foodItemId: String(m.foodItemId), sequence: m.sequence }));
    const foodIds = [...new Set(mappings.map((m) => m.foodItemId))].map(oid).filter((v): v is ObjectId => Boolean(v));
    const foodRes = foodIds.length ? await db.read<{ _id: ObjectId; name?: string; available?: boolean; isDraft?: boolean }>('fooditems', { _id: { $in: foodIds } } as never, { projection: { name: 1, available: 1, isDraft: 1 } } as never) : { success: true, data: [] };
    const foods: MenuFood[] = (foodRes.success ? foodRes.data ?? [] : []).map((f) => ({ id: String(f._id), name: String(f.name ?? ''), available: f.available, isDraft: f.isDraft }));
    return NextResponse.json({ data: { items: buildCategoryItems(String(root), mappings, categories, foods) } });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const other = await categoryRoutes(new URL(request.url));
    if (other) return other;
  } catch (error) {
    console.error('[communication-menu] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Could not load the menu' }, { status: 500 });
  }
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
    const catRes = catIds.length ? await db.read<CatDoc>('foodcategories', { _id: { $in: catIds } } as never) : { success: true, data: [] as CatDoc[] };
    const categories = (catRes.success ? catRes.data ?? [] : []).map(toCategory);
    // the parents of sub-categories (their order and whether they are switched off)
    const parentIds = [...new Set(categories.map((c) => c.parentId).filter((p): p is string => Boolean(p) && !categories.some((c) => c.id === p)))].map(oid).filter((v): v is ObjectId => Boolean(v));
    if (parentIds.length) {
      const parents = await db.read<CatDoc>('foodcategories', { _id: { $in: parentIds } } as never);
      categories.push(...(parents.success ? parents.data ?? [] : []).map(toCategory));
    }
    const foods: MenuFood[] = (foodRes.success ? foodRes.data ?? [] : []).map((f) => ({ id: String(f._id), name: String(f.name ?? ''), available: f.available, isDraft: f.isDraft }));
    // an item's sub-category (Appetizers, Main Course ...) is its own link to that category: read them for the sub-categories under the day's categories
    const dayCatIds = [...new Set(mappings.map((m) => m.categoryId))];
    const subRes = dayCatIds.length ? await db.read<CatDoc>('foodcategories', { parentCategoryId: { $in: dayCatIds.map(oid).filter((v): v is ObjectId => Boolean(v)) }, isDraft: { $ne: true } } as never) : { success: true, data: [] as CatDoc[] };
    const subs = subRes.success ? subRes.data ?? [] : [];
    const itemSubs: ItemSubCategories = {};
    if (subs.length && foodIds.length) {
      const subById = new Map(subs.map((x) => [String(x._id), x]));
      const links = await db.read<{ categoryId?: unknown; foodItemId?: unknown }>('categoryfoodmapping', { categoryId: { $in: subs.map((x) => x._id) }, foodItemId: { $in: foodIds }, $or: [{ mappingType: 'FLAT' }, { mappingType: { $exists: false } }] } as never);
      for (const l of links.success ? links.data ?? [] : []) {
        const sub = subById.get(String(l.categoryId));
        if (sub && l.foodItemId) (itemSubs[String(l.foodItemId)] ??= []).push({ name: String(sub.name ?? ''), sequence: sub.sequence });
      }
    }
    return NextResponse.json({ data: { menus: buildDayMenus(dates, mappings, categories, foods, { names: MENU_EMAIL_SUBCATEGORIES, itemSubs }) } });
  } catch (error) {
    console.error('[communication-menu] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Could not load the menu' }, { status: 500 });
  }
}
