import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/banners/reorder { ids: [...] }: the banners get this order (the first is shown first). */
export async function PATCH(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((v): v is string => typeof v === 'string' && ObjectId.isValid(v)))] : [];
  if (ids.length === 0 || ids.length > 50) return NextResponse.json({ error: 'Send the banner ids in the new order' }, { status: 400 });
  const conn = await db.getDb();
  const col = conn.collection('banners');
  await col.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { sequence: i + 1, updatedAt: new Date() } } } })));
  return NextResponse.json({ data: { count: ids.length } });
}
