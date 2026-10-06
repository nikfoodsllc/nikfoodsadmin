import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { isDefaultColumnPrefs, validateColumnPrefsPayload, ColumnPrefs } from '@/utils/columnPreferences';

/**
 * Per-admin table layout (column order, hidden columns, widths) for the admin tables.
 *
 *   GET /api/admin/preferences/table?table=orders      -> { data: { columns, updatedAt } | null }
 *   PUT /api/admin/preferences/table  { table, columns } -> { data: { columns } | null }
 *
 * The admin is always the one in the login token: the request cannot name another user. A layout that
 * is back to the default is deleted instead of stored.
 */

const COLLECTION = 'adminTablePreferences';
const TABLES = ['orders', 'food-items', 'kitchen-days'];
const MAX_BODY_CHARS = 8 * 1024;

interface TablePreferencesDoc {
  userId: string;
  table: string;
  columns: ColumnPrefs;
  createdAt?: Date;
  updatedAt?: Date;
}

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false as const, error: 'Missing or invalid authorization header' };
  }
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) {
    return { success: false as const, error: result.error || 'Invalid token' };
  }
  if (result.payload.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized: Admin access required' };
  }
  return { success: true as const, userId: result.payload.userId };
}

// One layout per admin and table. Created once, on the first save (needs no manual setup).
let indexEnsured = false;
async function ensureUniqueIndex() {
  if (indexEnsured) return;
  try {
    const conn = await db.getDb();
    await conn.collection(COLLECTION).createIndex({ userId: 1, table: 1 }, { unique: true });
    indexEnsured = true;
  } catch (error) {
    console.warn('[table preferences] could not create the unique index:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    const table = new URL(request.url).searchParams.get('table') || '';
    if (!TABLES.includes(table)) return NextResponse.json({ error: 'Unknown table' }, { status: 400 });

    const result = await db.readOne<TablePreferencesDoc>(COLLECTION, { userId: auth.userId, table });
    if (!result.success) return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });

    const doc = result.data;
    return NextResponse.json({
      data: doc ? { columns: validateColumnPrefsPayload(doc.columns), updatedAt: doc.updatedAt ?? null } : null,
    });
  } catch (error) {
    console.error('[table preferences] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return NextResponse.json({ error: 'Request too large' }, { status: 413 });

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { table, columns: rawColumns } = (body ?? {}) as { table?: unknown; columns?: unknown };
    if (typeof table !== 'string' || !TABLES.includes(table)) {
      return NextResponse.json({ error: 'Unknown table' }, { status: 400 });
    }
    const columns = validateColumnPrefsPayload(rawColumns);
    if (!columns) return NextResponse.json({ error: 'columns must be an object' }, { status: 400 });

    // Back to the default layout: nothing to keep
    if (isDefaultColumnPrefs(columns)) {
      const removed = await db.deleteOne<TablePreferencesDoc>(COLLECTION, { userId: auth.userId, table });
      if (!removed.success) return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
      return NextResponse.json({ data: null });
    }

    await ensureUniqueIndex();
    const now = new Date();
    const conn = await db.getDb();
    await conn.collection(COLLECTION).updateOne(
      { userId: auth.userId, table },
      { $set: { columns, updatedAt: now }, $setOnInsert: { createdAt: now } }, // userId + table come from the filter on insert
      { upsert: true }
    );
    return NextResponse.json({ data: { columns } });
  } catch (error) {
    console.error('[table preferences] PUT failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
