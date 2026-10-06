import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { isPreparationType } from '@/utils/preparationType';

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
 * PATCH /api/admin/food-items/preparation-type
 * Body: { ids: string[], preparationType: 'cooked' | 'ready_to_eat' | null }
 *
 * Sets how a whole batch of food items is prepared (null puts them back to "not set yet").
 * Only the preparationType field (and updatedAt) is touched. The customer menu does not use this
 * field, so the home menu cache is left alone.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    let body: { ids?: unknown; preparationType?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ids, preparationType } = body;
    if (preparationType !== null && !isPreparationType(preparationType)) {
      return NextResponse.json(
        { error: 'preparationType must be "cooked", "ready_to_eat" or null' },
        { status: 400 }
      );
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
    const result = await db.update(
      'fooditems',
      { _id: { $in: objectIds } },
      preparationType === null
        ? { $unset: { preparationType: '' }, $set: { updatedAt: new Date() } }
        : { $set: { preparationType, updatedAt: new Date() } }
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to update food items');
    }

    return NextResponse.json({
      data: { requested: objectIds.length, modified: result.modifiedCount ?? 0, preparationType },
      message: 'Food items updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/food-items/preparation-type:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
