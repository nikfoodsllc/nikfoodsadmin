import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { getCategoryDeleteImpact } from '@/lib/server/categoryDeleteImpact';
import { deleteVerdict } from '@/utils/categoryDelete';

/** GET /api/admin/food-category/delete-impact?id=... : what deleting this category would take with it (read only). */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
  }
  const verified = jwtHandler.verifyToken(authHeader.substring(7));
  if (!verified.success || !verified.payload) {
    return NextResponse.json({ error: verified.error || 'Invalid token' }, { status: 401 });
  }
  if (verified.payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Valid category ID is required' }, { status: 400 });
  }
  const categoryId = new ObjectId(id);
  const found = await db.readOne<{ name: string; dayWiseLockedItemIds?: unknown }>('foodcategories', { _id: categoryId } as never);
  if (!found.success || !found.data) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }
  const impact = await getCategoryDeleteImpact(categoryId, found.data);
  return NextResponse.json({ success: true, data: { name: found.data.name, impact, verdict: deleteVerdict(impact) } });
}
