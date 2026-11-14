import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { RECIPE_ITEMS } from '@/lib/recipeRows';
import { isPreparationType, normalizePreparationType } from '@/utils/preparationType';
import { cleanRecipeLines, isRecipeUnit, normalizeRecipeUnit } from '@/utils/recipeItems';

export const dynamic = 'force-dynamic';

/**
 * Recipe items: hidden extras that go with a menu item (raita with biryani). Customers never see them (the customer site does not read
 * this collection). Admin only.
 *
 *   GET    -> every recipe item with the food items that use it
 *   POST   { name, unit, preparationType? }      create (unit: oz, lb, g, kg or pc: what the amounts are measured in)
 *   PUT    { id, name, unit, preparationType? }  rename / change the unit or the type (null = not set)
 *   DELETE ?id=                                  delete, refused while a food item still uses it
 */

interface RecipeItemDoc {
  _id: ObjectId;
  name: string;
  unit?: string;
  preparationType?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const NAME_MIN = 2;
const NAME_MAX = 80;
const cleanName = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

async function usage(): Promise<Map<string, string[]>> {
  const used = await db.read<{ name?: string; recipeLines?: unknown }>('fooditems', { 'recipeLines.0': { $exists: true } } as never, { projection: { name: 1, recipeLines: 1 } } as never);
  const map = new Map<string, string[]>();
  for (const item of used.success ? used.data ?? [] : []) {
    for (const line of cleanRecipeLines(item.recipeLines)) map.set(line.recipeItemId, [...(map.get(line.recipeItemId) ?? []), String(item.name ?? '').trim()]);
  }
  return map;
}

async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const all = await db.read<RecipeItemDoc>(RECIPE_ITEMS, {} as never, { projection: { name: 1 } } as never);
  return (all.success ? all.data ?? [] : []).some((r) => String(r._id) !== exceptId && cleanName(r.name).toLowerCase() === name.toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const [all, used] = await Promise.all([db.read<RecipeItemDoc>(RECIPE_ITEMS, {} as never), usage()]);
    if (!all.success) return NextResponse.json({ error: 'Failed to load recipe items' }, { status: 500 });
    const data = (all.data ?? [])
      .map((r) => ({
        id: String(r._id),
        name: cleanName(r.name),
        unit: normalizeRecipeUnit(r.unit),
        preparationType: normalizePreparationType(r.preparationType),
        usedBy: [...new Set(used.get(String(r._id)) ?? [])].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/admin/recipe-items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { name?: unknown; unit?: unknown; preparationType?: unknown } | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const name = cleanName(body.name);
    if (!isRecipeUnit(body.unit)) return NextResponse.json({ error: 'Choose what it is measured in (oz, lb, g, kg or pc).' }, { status: 400 });
    if (name.length < NAME_MIN || name.length > NAME_MAX) return NextResponse.json({ error: `The name needs ${NAME_MIN} to ${NAME_MAX} characters.` }, { status: 400 });
    if (body.preparationType != null && !isPreparationType(body.preparationType)) return NextResponse.json({ error: 'preparationType must be "cooked", "ready_to_eat" or empty' }, { status: 400 });
    if (await nameTaken(name)) return NextResponse.json({ error: 'A recipe item with this name already exists.' }, { status: 409 });
    const now = new Date();
    const created = await db.create<RecipeItemDoc>(RECIPE_ITEMS, { name, unit: body.unit, ...(isPreparationType(body.preparationType) ? { preparationType: body.preparationType } : {}), createdAt: now, updatedAt: now } as never);
    if (!created.success) return NextResponse.json({ error: 'Failed to create the recipe item' }, { status: 500 });
    return NextResponse.json({ data: { id: created.id, name, unit: body.unit, preparationType: normalizePreparationType(body.preparationType), usedBy: [] }, message: 'Recipe item created' }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/recipe-items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const body = (await request.json().catch(() => null)) as { id?: unknown; name?: unknown; unit?: unknown; preparationType?: unknown } | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    if (!isRecipeUnit(body.unit)) return NextResponse.json({ error: 'Choose what it is measured in (oz, lb, g, kg or pc).' }, { status: 400 });
    const id = String(body.id ?? '');
    if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== id) return NextResponse.json({ error: 'Unknown recipe item' }, { status: 404 });
    const name = cleanName(body.name);
    if (name.length < NAME_MIN || name.length > NAME_MAX) return NextResponse.json({ error: `The name needs ${NAME_MIN} to ${NAME_MAX} characters.` }, { status: 400 });
    if (body.preparationType != null && !isPreparationType(body.preparationType)) return NextResponse.json({ error: 'preparationType must be "cooked", "ready_to_eat" or empty' }, { status: 400 });
    if (await nameTaken(name, id)) return NextResponse.json({ error: 'A recipe item with this name already exists.' }, { status: 409 });
    const result = await db.updateOne<RecipeItemDoc>(
      RECIPE_ITEMS,
      { _id: new ObjectId(id) } as never,
      (isPreparationType(body.preparationType) ? { $set: { name, unit: body.unit, preparationType: body.preparationType, updatedAt: new Date() } } : { $set: { name, unit: body.unit, updatedAt: new Date() }, $unset: { preparationType: '' } }) as never
    );
    if (!result.success) return NextResponse.json({ error: 'Failed to update the recipe item' }, { status: 500 });
    if (!result.matchedCount) return NextResponse.json({ error: 'Unknown recipe item' }, { status: 404 });
    return NextResponse.json({ data: { id, name, unit: body.unit, preparationType: normalizePreparationType(body.preparationType) }, message: 'Recipe item updated' });
  } catch (error) {
    console.error('Error in PUT /api/admin/recipe-items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== id) return NextResponse.json({ error: 'Unknown recipe item' }, { status: 404 });
    const using = [...new Set((await usage()).get(id) ?? [])];
    if (using.length > 0) {
      return NextResponse.json({ error: `Still used by ${using.slice(0, 5).join(', ')}${using.length > 5 ? ` and ${using.length - 5} more` : ''}. Take it off those items first.`, usedBy: using }, { status: 409 });
    }
    const result = await db.deleteOne<RecipeItemDoc>(RECIPE_ITEMS, { _id: new ObjectId(id) } as never);
    if (!result.success) return NextResponse.json({ error: 'Failed to delete the recipe item' }, { status: 500 });
    if (!result.deletedCount) return NextResponse.json({ error: 'Unknown recipe item' }, { status: 404 });
    return NextResponse.json({ message: 'Recipe item deleted' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/recipe-items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
