import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import type { KitchenRow } from '@/utils/kitchenDashboard';
import { cleanRecipeLines, expandRecipeRows, recipeFoodIds, type RecipeLine } from '@/utils/recipeItems';

export const RECIPE_ITEMS = 'recipeitems';

/**
 * The order lines plus the recipe items that go with them (raita with biryani). Reads the recipe lines of the items on the lines
 * (a food item's `recipeLines`) and the recipe items themselves, then adds one ordinary line per recipe item. Items without a
 * recipe cost one small read. A failure here never breaks a report: the lines are then returned as they are.
 */
export async function withRecipes<T extends KitchenRow>(rows: T[]): Promise<T[]> {
  try {
    const ids = recipeFoodIds(rows);
    if (ids.length === 0) return rows;
    const items = await db.read<{ _id: ObjectId; recipeLines?: unknown }>('fooditems', { _id: { $in: ids.map((id) => new ObjectId(id)) }, 'recipeLines.0': { $exists: true } } as never, { projection: { recipeLines: 1 } } as never);
    const linesByFoodId = new Map<string, RecipeLine[]>();
    const wanted = new Set<string>();
    for (const item of items.success ? items.data ?? [] : []) {
      const lines = cleanRecipeLines(item.recipeLines);
      if (lines.length === 0) continue;
      linesByFoodId.set(String(item._id), lines);
      for (const l of lines) wanted.add(l.recipeItemId);
    }
    if (linesByFoodId.size === 0) return rows;
    const found = await db.read<{ _id: ObjectId; name?: string }>(RECIPE_ITEMS, { _id: { $in: [...wanted].map((id) => new ObjectId(id)) } } as never, { projection: { name: 1 } } as never);
    const recipeById = new Map<string, { name: string }>();
    for (const r of found.success ? found.data ?? [] : []) if (r.name?.trim()) recipeById.set(String(r._id), { name: r.name.trim() });
    return expandRecipeRows(rows, linesByFoodId, recipeById);
  } catch (error) {
    console.error('[recipe items] could not add the recipe lines', error);
    return rows;
  }
}
