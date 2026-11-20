import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { adminId, whoIs } from '@/lib/server/communicationDrafts';
import { cleanSavedBox, MAX_SAVED_BOXES, type SavedMenuBox } from '@/utils/menuEmail';

export const dynamic = 'force-dynamic';

/**
 * Saved boxes of the "New menu" email (Indian Mithai, Add-On's ...), shared by every admin. Every new menu email starts with them.
 *   GET                               -> every saved box, oldest first (the order they appear in the email)
 *   PUT    { id?, title, subtitle, items, categoryId? }  save a box (no id = a new saved box)
 *   DELETE ?id=                       -> stop saving a box (emails already written keep it)
 */
const COLLECTION = 'communicationSavedBoxes';

interface BoxDoc {
  _id: ObjectId;
  title: string;
  subtitle: string;
  items: string;
  categoryId?: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: { id: string; name: string };
}

const toBox = (d: BoxDoc): SavedMenuBox => ({ id: String(d._id), title: d.title, subtitle: d.subtitle, items: d.items, ...(d.categoryId ? { categoryId: d.categoryId } : {}), updatedAt: d.updatedAt.toISOString(), updatedBy: d.updatedBy?.name ?? '' });

async function collection() {
  const database = await db.getDb();
  return { database, col: database.collection<BoxDoc>(COLLECTION) };
}

export async function GET(request: NextRequest) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { col } = await collection();
    const rows = await col.find({}).sort({ createdAt: 1 }).limit(MAX_SAVED_BOXES).toArray();
    return NextResponse.json({ data: { boxes: rows.map(toBox) } });
  } catch (error) {
    console.error('Error in GET /api/admin/communication-saved-boxes:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not load the saved boxes' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const me = adminId(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const cleaned = cleanSavedBox(body);
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const id = typeof body?.id === 'string' ? body.id : null;
  if (id !== null && !ObjectId.isValid(id)) return NextResponse.json({ error: 'Unknown saved box' }, { status: 400 });
  try {
    const { database, col } = await collection();
    const who = await whoIs(database, me);
    const now = new Date();
    const unset = cleaned.box.categoryId ? {} : { $unset: { categoryId: '' as const } };
    if (id) {
      const r = await col.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: { ...cleaned.box, updatedAt: now, updatedBy: who }, ...unset }, { returnDocument: 'after' });
      if (!r) return NextResponse.json({ error: 'That saved box was removed. Save it again as a new one.', code: 'GONE' }, { status: 404 });
      return NextResponse.json({ data: { box: toBox(r) } });
    }
    if ((await col.countDocuments({})) >= MAX_SAVED_BOXES) return NextResponse.json({ error: `At most ${MAX_SAVED_BOXES} boxes can be saved. Unsave one first.` }, { status: 409 });
    const doc = { _id: new ObjectId(), ...cleaned.box, createdAt: now, updatedAt: now, updatedBy: who };
    await col.insertOne(doc);
    return NextResponse.json({ data: { box: toBox(doc) } });
  } catch (error) {
    console.error('Error in PUT /api/admin/communication-saved-boxes:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not save the box' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Unknown saved box' }, { status: 400 });
  try {
    const { col } = await collection();
    await col.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ data: { removed: id } });
  } catch (error) {
    console.error('Error in DELETE /api/admin/communication-saved-boxes:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not unsave the box' }, { status: 500 });
  }
}
