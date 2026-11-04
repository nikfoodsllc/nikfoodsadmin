import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { cleanHeatingInstruction } from '@/utils/heatingInstructions';
import { rememberHeatingInstruction } from '@/lib/heatingInstructionsLibrary';

/** Most items one request may change (the whole menu is a few hundred items). */
const MAX_BULK_ITEMS = 1000; // not exported: a Next.js route file may only export HTTP handlers

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false, error: 'Missing or invalid authorization header' };
  const verificationResult = jwtHandler.verifyToken(authHeader.substring(7));
  if (!verificationResult.success || !verificationResult.payload) return { success: false, error: verificationResult.error || 'Invalid token' };
  if (verificationResult.payload.role !== 'admin') return { success: false, error: 'Unauthorized: Admin access required' };
  return { success: true };
}

/**
 * PATCH /api/admin/food-items/heating-instructions
 * Body: { ids: string[], text: string | null }
 *
 * Sets the heating / storage instruction of a whole batch of food items (null clears it). A new instruction is added to the
 * list to pick from. Only that field (and updatedAt) is touched; the customer menu does not use it.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    let body: { ids?: unknown; text?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { ids } = body;
    if (body.text !== null && typeof body.text !== 'string') {
      return NextResponse.json({ error: 'text must be a string or null' }, { status: 400 });
    }
    const text = cleanHeatingInstruction(body.text);
    if (body.text !== null && text === null) {
      return NextResponse.json({ error: 'The instruction is empty' }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids must be a non-empty list of food item ids' }, { status: 400 });
    if (ids.length > MAX_BULK_ITEMS) return NextResponse.json({ error: `At most ${MAX_BULK_ITEMS} items can be changed at once` }, { status: 400 });
    if (!ids.every((id) => typeof id === 'string' && ObjectId.isValid(id) && String(new ObjectId(id)) === id)) {
      return NextResponse.json({ error: 'ids must be valid food item ids' }, { status: 400 });
    }

    const objectIds = [...new Set(ids as string[])].map((id) => new ObjectId(id));
    const result = await db.update(
      'fooditems',
      { _id: { $in: objectIds } },
      text === null ? { $unset: { heatingInstructions: '' }, $set: { updatedAt: new Date() } } : { $set: { heatingInstructions: text, updatedAt: new Date() } }
    );
    if (!result.success) throw new Error(result.error || 'Failed to update food items');
    if (text !== null) await rememberHeatingInstruction(text);
    return NextResponse.json({ data: { requested: objectIds.length, modified: result.modifiedCount ?? 0 }, message: 'Heating instructions updated' });
  } catch (error) {
    console.error('Error in PATCH /api/admin/food-items/heating-instructions:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
