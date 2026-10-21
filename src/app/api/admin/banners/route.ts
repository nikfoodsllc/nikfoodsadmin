import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { bannerStatus, MAX_BANNERS, validateBanner } from '@/lib/banners';

export const dynamic = 'force-dynamic';

/**
 * Home-page banners (the website and the app show the live ones).
 *   GET  /api/admin/banners          every banner in display order, each with its status (live / scheduled / ended / off)
 *   POST /api/admin/banners          add one (goes last)
 */
async function collection() {
  const conn = await db.getDb();
  return conn.collection('banners');
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const col = await collection();
  const docs = await col.find({}).sort({ sequence: 1, createdAt: 1 }).toArray();
  const now = new Date();
  return NextResponse.json({ data: docs.map((d) => ({ ...d, _id: String(d._id), status: bannerStatus(d as unknown as Parameters<typeof bannerStatus>[0], now) })) });
}

export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const checked = validateBanner(await request.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const col = await collection();
  const count = await col.countDocuments({});
  if (count >= MAX_BANNERS) return NextResponse.json({ error: `You can have up to ${MAX_BANNERS} banners. Delete one first.` }, { status: 409 });
  const last = await col.find({}).sort({ sequence: -1 }).limit(1).toArray();
  const now = new Date();
  const doc = { ...checked.value, sequence: (Number(last[0]?.sequence) || 0) + 1, createdAt: now, updatedAt: now, createdBy: new ObjectId(auth.userId) };
  const result = await col.insertOne(doc);
  return NextResponse.json({ data: { ...doc, _id: String(result.insertedId), status: bannerStatus(doc, now) } }, { status: 201 });
}
