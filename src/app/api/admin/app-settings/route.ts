import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { cleanHomeIntro } from '@/lib/appSettings';

export const dynamic = 'force-dynamic';

/**
 * Texts for the app's home screen (the customer site serves them at GET /api/app-settings).
 *   GET  /api/admin/app-settings   { homeIntro }
 *   PUT  /api/admin/app-settings   { homeIntro }  (empty = the app's usual greeting)
 */
async function collection() {
  const conn = await db.getDb();
  return conn.collection('appSettings');
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const doc = await (await collection()).findOne({ key: 'home' });
  return NextResponse.json({ data: { homeIntro: typeof doc?.intro === 'string' ? doc.intro : '' } });
}

export async function PUT(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = await request.json().catch(() => null);
  const checked = cleanHomeIntro(body?.homeIntro);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  await (await collection()).updateOne(
    { key: 'home' },
    { $set: { intro: checked.value, updatedAt: new Date(), updatedBy: new ObjectId(auth.userId) }, $setOnInsert: { key: 'home' } },
    { upsert: true }
  );
  return NextResponse.json({ data: { homeIntro: checked.value } });
}
