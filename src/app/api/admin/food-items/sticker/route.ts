import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { isStickerFlag } from '@/utils/stickerFlag';

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
 * PATCH /api/admin/food-items/sticker
 * Body: { ids: string[], sticker: 'yes' | 'no' | null, field?: 'sticker' | 'splitSticker' }
 *
 * Sets whether a whole batch of food items gets a packing sticker (null puts them back to "not set yet").
 * Only the sticker field (and updatedAt) is touched. The customer menu does not use this
 * field, so the home menu cache is left alone.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    let body: { ids?: unknown; sticker?: unknown; field?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ids, sticker } = body;
    // which field to set: the Sticker (default) or the Split Sticker
    if (body.field !== undefined && body.field !== 'sticker' && body.field !== 'splitSticker') {
      return NextResponse.json({ error: 'field must be "sticker" or "splitSticker"' }, { status: 400 });
    }
    const field: 'sticker' | 'splitSticker' = body.field === 'splitSticker' ? 'splitSticker' : 'sticker';
    if (sticker !== null && !isStickerFlag(sticker)) {
      return NextResponse.json(
        { error: 'sticker must be "yes", "no" or null' },
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
      sticker === null
        ? { $unset: { [field]: '' }, $set: { updatedAt: new Date() } }
        : { $set: { [field]: sticker, updatedAt: new Date() } }
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to update food items');
    }

    return NextResponse.json({
      data: { requested: objectIds.length, modified: result.modifiedCount ?? 0, sticker, field },
      message: 'Food items updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/food-items/sticker:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
