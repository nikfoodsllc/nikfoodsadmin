import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { fetchKitchenRows, fetchMovedKitchenRows } from '@/lib/kitchenRows';
import { buildKitchenDays, comboParts, enumerateDays, validateRange } from '@/utils/kitchenDashboard';
import { buildKitchenReport, type TypeLookup } from '@/utils/kitchenReport';
import { normalizePreparationType, type PreparationType } from '@/utils/preparationType';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }
  const verificationResult = jwtHandler.verifyToken(authHeader.substring(7));
  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }
  if (verificationResult.payload.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }
  return { success: true, userId: verificationResult.payload.userId };
}

/**
 * GET /api/admin/kitchen-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * The kitchen's sheets for a range of menu days: what to cook (one block per cooked item with the orders behind it),
 * the ready-to-eat items to pack with stickers, the items that have no preparation type yet, and the day totals.
 * Reads the same order lines as the Kitchen Dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = { startDate: searchParams.get('startDate') ?? '', endDate: searchParams.get('endDate') ?? '' };
    const problem = validateRange(range);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    // items an admin moved to another date are cooked for their new date
    const rows = [...(await fetchKitchenRows(range, { report: true })), ...(await fetchMovedKitchenRows(range))];

    // how each item is prepared: by food id (a combo's parts have their own), and by name for anything without an id
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const row of rows) {
      if (row.foodId) ids.add(row.foodId);
      names.add(row.name.trim());
      for (const part of comboParts(row)) {
        if (part.id) ids.add(part.id);
        names.add(part.name);
      }
    }
    const byId = new Map<string, PreparationType | null>();
    const nameTypes = new Map<string, Set<string>>();
    const objectIds = [...ids].filter((id) => /^[0-9a-fA-F]{24}$/.test(id)).map((id) => new ObjectId(id));
    if (objectIds.length > 0 || names.size > 0) {
      const found = await db.read<{ _id: ObjectId; name?: string; preparationType?: unknown }>('fooditems', {
        $or: [{ _id: { $in: objectIds } }, { name: { $in: [...names] } }],
      } as never);
      for (const item of found.success ? found.data ?? [] : []) {
        const type = normalizePreparationType(item.preparationType);
        byId.set(String(item._id), type);
        if (item.name) {
          const set = nameTypes.get(item.name.trim()) ?? new Set<string>();
          set.add(type ?? 'none');
          nameTypes.set(item.name.trim(), set);
        }
      }
    }
    const typeOf: TypeLookup = ({ id, name }) => {
      if (id && byId.has(id)) return byId.get(id) ?? null;
      // no usable id: the name decides, but only when every item with that name is prepared the same way
      const set = nameTypes.get(name.trim());
      if (set && set.size === 1) {
        const only = [...set][0];
        return only === 'none' ? null : (only as PreparationType);
      }
      return null;
    };

    const report = buildKitchenReport(rows, typeOf);
    return NextResponse.json({
      data: {
        startDate: range.startDate,
        endDate: range.endDate,
        ...report,
        days: buildKitchenDays(rows, enumerateDays(range)),
      },
      message: 'Kitchen report generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/kitchen-report:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
