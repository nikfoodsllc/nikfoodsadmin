import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import type { CategoryDeleteImpact } from '@/utils/categoryDelete';

/** What deleting a category would leave behind: sub-categories, item rows pointing at it and its locked rows. */
export async function getCategoryDeleteImpact(categoryId: ObjectId, category: { dayWiseLockedItemIds?: unknown }): Promise<CategoryDeleteImpact> {
  const subs = await db.read<{ name: string }>('foodcategories', {
    parentCategoryId: { $in: [categoryId, categoryId.toHexString()] },
  } as never, { projection: { name: 1 } });
  const maps = await db.read<{ mappingType: string; day?: string }>('categoryfoodmapping', { categoryId } as never, {
    projection: { mappingType: 1, day: 1 },
  });
  const rows = maps.data ?? [];
  const dayWise = rows.filter((r) => r.mappingType === 'DAY_WISE');
  return {
    subCategories: (subs.data ?? []).map((s) => s.name),
    dayWiseItems: dayWise.length,
    dayWiseDays: new Set(dayWise.map((r) => r.day)).size,
    flatItems: rows.length - dayWise.length,
    lockedItems: Array.isArray(category.dayWiseLockedItemIds) ? category.dayWiseLockedItemIds.length : 0,
  };
}
