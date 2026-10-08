import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { invalidateLivesiteHomeMenuCache } from '@/lib/invalidateHomeMenuCache';
import { isDateKey, lockedItemPlacement, type AssignedDay } from '@/utils/lockedMenu';

/**
 * Locked rows repeat every week. When day-wise ordering is switched on for a day, every day-wise category that has
 * locked items gets them on that day if the weekday matches the pattern of the most recent week (see utils/lockedMenu).
 * A day on which the category already has items is left alone (someone has set it up), and nothing is ever removed.
 * Best effort: the caller must not fail because of this.
 */
export async function applyLockedMenuToDates(dates: string[]): Promise<{ added: number; days: string[] }> {
  const targets = [...new Set(dates.filter(isDateKey))].sort();
  if (targets.length === 0) return { added: 0, days: [] };

  const database = await db.getDb();
  const categories = await database
    .collection('foodcategories')
    .find({ listingType: 'day-wise', 'dayWiseLockedItemIds.0': { $exists: true } }, { projection: { _id: 1, dayWiseLockedItemIds: 1 } })
    .toArray();
  if (categories.length === 0) return { added: 0, days: [] };

  const mappings = database.collection('categoryfoodmapping');
  const items = database.collection('fooditems');
  let added = 0;
  const touched = new Set<string>();

  for (const category of categories) {
    const categoryId = category._id as ObjectId;
    const lockedIds = ((category.dayWiseLockedItemIds as unknown[]) ?? []).filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id));

    // where each locked item is assigned today (a day-wise 'day' is a calendar date 'YYYY-MM-DD')
    const assigned = new Map<string, AssignedDay[]>();
    for (const id of lockedIds) {
      const rows = await mappings.find({ categoryId, foodItemId: new ObjectId(id), mappingType: 'DAY_WISE' }, { projection: { day: 1, sequence: 1 } }).toArray();
      assigned.set(id, rows.map((r) => ({ day: String(r.day), sequence: Number(r.sequence) || 0 })));
    }

    for (const target of targets) {
      // a day somebody already set up for this category is not touched
      if ((await mappings.countDocuments({ categoryId, mappingType: 'DAY_WISE', day: target }, { limit: 1 })) > 0) continue;

      const toInsert: Array<Record<string, unknown>> = [];
      for (const id of lockedIds) {
        const placement = lockedItemPlacement(target, assigned.get(id) ?? []);
        if (!placement) continue;
        if (!(await items.countDocuments({ _id: new ObjectId(id) }, { limit: 1 }))) continue; // the item was deleted
        const now = new Date();
        toInsert.push({ foodItemId: new ObjectId(id), categoryId, sequence: placement.sequence, mappingType: 'DAY_WISE', day: target, createdAt: now, updatedAt: now });
      }
      if (toInsert.length === 0) continue;
      await mappings.insertMany(toInsert as never);
      for (const row of toInsert) assigned.get(String(row.foodItemId))?.push({ day: target, sequence: Number(row.sequence) });
      added += toInsert.length;
      touched.add(target);
    }
  }

  if (added > 0) invalidateLivesiteHomeMenuCache();
  return { added, days: [...touched] };
}
