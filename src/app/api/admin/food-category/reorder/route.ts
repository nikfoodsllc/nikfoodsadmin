import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { planReorder } from '@/utils/categoryReorder';
import { invalidateLivesiteHomeMenuCache } from '@/lib/invalidateHomeMenuCache';

/**
 * Re-rank a group of sibling categories.
 *
 *   PATCH /api/admin/food-category/reorder  { parentId: string | null, orderedIds: string[] }
 *
 * parentId null = the top-level categories; otherwise the sub-categories of that category. orderedIds
 * must list every category of the group exactly once, in the new order; they are renumbered 1..n.
 * Only `sequence` (and updatedAt) of categories whose rank changes is written.
 */

const COLLECTION = 'foodcategories';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false as const, error: 'Missing or invalid authorization header' };
  }
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) {
    return { success: false as const, error: result.error || 'Invalid token' };
  }
  if (result.payload.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized: Admin access required' };
  }
  return { success: true as const };
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    let body: { parentId?: unknown; orderedIds?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { parentId, orderedIds } = body ?? {};
    let groupFilter: Record<string, unknown>;
    if (parentId === null || parentId === undefined || parentId === '') {
      groupFilter = { $or: [{ parentCategoryId: { $exists: false } }, { parentCategoryId: null }, { parentCategoryId: '' }] };
    } else if (typeof parentId === 'string' && ObjectId.isValid(parentId) && /^[0-9a-fA-F]{24}$/.test(parentId)) {
      groupFilter = { parentCategoryId: { $in: [new ObjectId(parentId), parentId] } };
    } else {
      return NextResponse.json({ error: 'parentId must be a category id or null' }, { status: 400 });
    }

    const conn = await db.getDb();
    const collection = conn.collection(COLLECTION);
    const siblings = await collection.find(groupFilter, { projection: { _id: 1, sequence: 1 } }).toArray();

    const plan = planReorder(
      siblings.map((s) => ({ id: String(s._id), sequence: typeof s.sequence === 'number' ? s.sequence : null })),
      orderedIds,
    );
    if (!plan.ok) {
      // a list that no longer matches the page is a conflict, anything else is a bad request
      const stale = plan.error.startsWith('The list of categories has changed');
      return NextResponse.json({ error: plan.error }, { status: stale ? 409 : 400 });
    }

    if (plan.updates.length > 0) {
      const now = new Date();
      await collection.bulkWrite(
        plan.updates.map((u) => ({
          updateOne: { filter: { _id: new ObjectId(u.id) }, update: { $set: { sequence: u.sequence, updatedAt: now } } },
        })),
        { ordered: false },
      );
      invalidateLivesiteHomeMenuCache();
    }

    return NextResponse.json({ data: { changed: plan.updates.length }, message: 'Order saved' });
  } catch (error) {
    console.error('[category reorder] failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
