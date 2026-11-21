import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminId, whoIs } from '@/lib/server/communicationDrafts';
import { cleanPromo, MAX_MENU_PROMOS, type MenuPromo } from '@/utils/menuEmail';

export const dynamic = 'force-dynamic';

/**
 * Saved promotion blocks of the "New menu" email (Niksweets, Bite Theory), shared by every admin. Every new menu email starts with them.
 *   GET                 -> { promos, updatedAt, updatedBy } (promos empty when nothing is saved yet)
 *   PUT { promos }      -> save them (replaces the saved copy)
 */
const COLLECTION = 'communicationSavedPromos';
const DOC_ID = 'menuEmail';

interface PromoDoc {
  _id: string;
  promos: MenuPromo[];
  updatedAt: Date;
  updatedBy: { id: string; name: string };
}

export async function GET(request: NextRequest) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const database = await db.getDb();
    const doc = await database.collection<PromoDoc>(COLLECTION).findOne({ _id: DOC_ID });
    return NextResponse.json({ data: { promos: (doc?.promos ?? []).map(cleanPromo), updatedAt: doc?.updatedAt?.toISOString() ?? null, updatedBy: doc?.updatedBy?.name ?? '' } });
  } catch (error) {
    console.error('Error in GET /api/admin/communication-promos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not load the saved promotions' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const me = adminId(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { promos?: unknown } | null;
  if (!Array.isArray(body?.promos) || body.promos.length > MAX_MENU_PROMOS) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  const promos = body.promos.map(cleanPromo);
  if (promos.some((p) => !p.name)) return NextResponse.json({ error: 'Every promotion needs a name' }, { status: 400 });
  try {
    const database = await db.getDb();
    const who = await whoIs(database, me);
    const now = new Date();
    await database.collection<PromoDoc>(COLLECTION).updateOne({ _id: DOC_ID }, { $set: { promos, updatedAt: now, updatedBy: who } }, { upsert: true });
    return NextResponse.json({ data: { promos, updatedAt: now.toISOString(), updatedBy: who.name } });
  } catch (error) {
    console.error('Error in PUT /api/admin/communication-promos:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not save the promotions' }, { status: 500 });
  }
}
