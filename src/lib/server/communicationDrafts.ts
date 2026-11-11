import { ObjectId, type Db } from 'mongodb';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { draftPreview, draftTitle, parseDraftContent, type DraftContent } from '@/utils/communicationDraft';

/** Drafts of Communication messages, shared by every admin (one collection). */
export const DRAFTS = 'communicationDrafts';

export interface DraftDoc extends DraftContent {
  _id: ObjectId;
  createdBy: { id: string; name: string };
  updatedBy: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export async function whoIs(database: Db, userId: string): Promise<{ id: string; name: string }> {
  if (!ObjectId.isValid(userId)) return { id: userId, name: '' };
  const u = await database.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { name: 1, email: 1 } });
  return { id: userId, name: String(u?.name || u?.email || '') };
}

/** The signed-in admin of a request, or null. */
export function adminId(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const r = jwtHandler.verifyToken(header.substring(7));
  return r.success && r.payload && r.payload.role === 'admin' ? String(r.payload.userId) : null;
}

export const summaryOf = (d: DraftDoc) => ({
  id: String(d._id),
  title: draftTitle(d),
  preview: draftPreview(d),
  kind: d.kind,
  date: d.date,
  from: d.from,
  to: d.to,
  peopleCount: d.kind === 'people' ? d.people.length : d.extra.length,
  channels: { email: d.email, text: d.text },
  updatedAt: d.updatedAt.toISOString(),
  updatedBy: d.updatedBy.name,
  createdBy: d.createdBy.name,
});

export const fullOf = (d: DraftDoc) => ({ id: String(d._id), content: parseDraftContent(d), updatedAt: d.updatedAt.toISOString(), updatedBy: d.updatedBy.name, createdBy: d.createdBy.name });

export async function drafts() {
  const database = await db.getDb();
  return { database, col: database.collection<DraftDoc>(DRAFTS) };
}
