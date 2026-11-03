import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { cleanAllergens, isAllergenBulkMode } from '@/utils/allergens';
import { invalidateLivesiteHomeMenuCacheAndWait } from '@/lib/invalidateHomeMenuCache';

/** Most items one request may change (the whole menu is a few hundred items). */
const MAX_BULK_ITEMS = 1000; // not exported: a Next.js route file may only export HTTP handlers

/**
 * Verify JWT token and check admin role
 */
function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  const verificationResult = jwtHandler.verifyToken(token);

  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }

  if (verificationResult.payload.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  return { success: true, userId: verificationResult.payload.userId };
}

/**
 * PATCH /api/admin/food-items/allergens
 * Body: { ids: string[], mode: 'add' | 'replace' | 'remove', allergens: string[] }
 *
 * Changes the allergen list of a whole batch of food items: add the ticked allergens to each item, replace each
 * item's list with them (an empty list = no allergens), or take them off. Only the allergens field (and updatedAt)
 * is touched. Customers see allergens, so the home menu cache is cleared afterwards.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    let body: { ids?: unknown; mode?: unknown; allergens?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ids, mode, allergens } = body;
    if (!isAllergenBulkMode(mode)) {
      return NextResponse.json({ error: 'mode must be "add", "replace" or "remove"' }, { status: 400 });
    }
    if (!Array.isArray(allergens)) {
      return NextResponse.json({ error: 'allergens must be a list' }, { status: 400 });
    }
    const picked = cleanAllergens(allergens);
    if (picked.length !== new Set(allergens).size) {
      return NextResponse.json({ error: 'allergens has an unknown allergen' }, { status: 400 });
    }
    if (mode !== 'replace' && picked.length === 0) {
      return NextResponse.json({ error: 'Pick at least one allergen' }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty list of food item ids' }, { status: 400 });
    }
    if (ids.length > MAX_BULK_ITEMS) {
      return NextResponse.json({ error: `At most ${MAX_BULK_ITEMS} items can be changed at once` }, { status: 400 });
    }
    if (!ids.every((id) => typeof id === 'string' && ObjectId.isValid(id) && String(new ObjectId(id)) === id)) {
      return NextResponse.json({ error: 'ids must be valid food item ids' }, { status: 400 });
    }

    const objectIds = [...new Set(ids as string[])].map((id) => new ObjectId(id));
    const now = new Date();
    const update =
      mode === 'replace'
        ? { $set: { allergens: picked, updatedAt: now } }
        : mode === 'add'
          ? { $addToSet: { allergens: { $each: picked } }, $set: { updatedAt: now } }
          : { $pull: { allergens: { $in: picked } }, $set: { updatedAt: now } };
    const result = await db.update('fooditems', { _id: { $in: objectIds } } as never, update as never);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update food items');
    }

    const livesiteNotified = await invalidateLivesiteHomeMenuCacheAndWait();
    return NextResponse.json({
      data: { requested: objectIds.length, modified: result.modifiedCount ?? 0, mode, allergens: picked, livesiteNotified },
      message: 'Food items updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/food-items/allergens:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
