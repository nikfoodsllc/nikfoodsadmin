import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { invalidateLivesiteHomeMenuCacheAndWait } from '@/lib/invalidateHomeMenuCache';

/** Most items one request may change (the whole menu is a few hundred items). */
const MAX_BULK_ITEMS = 1000; // not exported: a Next.js route file may only export HTTP handlers

/** The yes/no fields of a food item the bulk update may change. All are shown to customers (Chef's Pick in the mobile app). */
const BULK_FLAGS = ['available', 'veg', 'chefsPick', 'allowInstructions'] as const;

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }
  const verificationResult = jwtHandler.verifyToken(authHeader.substring(7));
  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }
  if (verificationResult.payload.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }
  return { success: true, userId: verificationResult.payload.userId };
}

/**
 * PATCH /api/admin/food-items/bulk-flag
 * Body: { ids: string[], field: 'available' | 'veg' | 'chefsPick' | 'allowInstructions', value: boolean }
 *
 * Sets Available (on/off), Veg / Non-Veg or Chef's Pick for a whole batch of food items. Only that field (and updatedAt) is
 * touched. Customers see both fields on the menu, so the site's menu cache is cleared afterwards.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    let body: { ids?: unknown; field?: unknown; value?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ids, field, value } = body;
    if (typeof field !== 'string' || !(BULK_FLAGS as readonly string[]).includes(field)) {
      return NextResponse.json({ error: 'field must be "available", "veg", "chefsPick" or "allowInstructions"' }, { status: 400 });
    }
    if (typeof value !== 'boolean') {
      return NextResponse.json({ error: 'value must be true or false' }, { status: 400 });
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
    const result = await db.update('fooditems', { _id: { $in: objectIds } } as never, { $set: { [field]: value, updatedAt: new Date() } });
    if (!result.success) {
      throw new Error(result.error || 'Failed to update food items');
    }

    // the menu customers see changed: clear the site's cache (waits for the answer so it is not cut off)
    const livesiteNotified = await invalidateLivesiteHomeMenuCacheAndWait();

    return NextResponse.json({
      data: { requested: objectIds.length, modified: result.modifiedCount ?? 0, field, value, livesiteNotified },
      message: 'Food items updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/food-items/bulk-flag:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
