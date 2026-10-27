import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { bannerStatus, validateBanner } from '@/lib/banners';

export const dynamic = 'force-dynamic';

async function collection() {
  const conn = await db.getDb();
  return conn.collection('banners');
}

/** PUT /api/admin/banners/{id}: save a banner (all its fields; the position is kept). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
  const checked = validateBanner(await request.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const col = await collection();
  const now = new Date();
  // where a banner is shown (header or popup) is fixed when it is added
  const { placement: _placement, ...fields } = checked.value;
  void _placement;
  const updated = await col.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: { ...fields, updatedAt: now } }, { returnDocument: 'after' });
  const doc = (updated as { value?: Record<string, unknown> | null } | Record<string, unknown> | null);
  const saved = doc && 'value' in (doc as object) ? (doc as { value?: Record<string, unknown> | null }).value : (doc as Record<string, unknown> | null);
  if (!saved) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
  return NextResponse.json({ data: { ...saved, _id: String(saved._id), status: bannerStatus(saved, now) } });
}

/** DELETE /api/admin/banners/{id} */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
  const col = await collection();
  const r = await col.deleteOne({ _id: new ObjectId(id) });
  if (r.deletedCount === 0) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
  return NextResponse.json({ data: { deleted: true } });
}
