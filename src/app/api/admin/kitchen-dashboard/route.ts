import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { fetchDashboardRows } from '@/lib/kitchenRows';
import { db } from '@/lib/db';
import { buildKitchenDays, buildKitchenWeek, enumerateDays, namesIn, validateRange, withPreparation } from '@/utils/kitchenDashboard';
import { normalizePreparationType, type PreparationType } from '@/utils/preparationType';

/**
 * Verify JWT token and check admin role
 */
function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  const verificationResult = jwtHandler.verifyToken(token);

  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }

  // admins and packers (the kitchen dashboard holds counts only, no money)
  if (verificationResult.payload.role !== 'admin' && verificationResult.payload.role !== 'packer') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  return { success: true, userId: verificationResult.payload.userId };
}

/**
 * GET /api/admin/kitchen-dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * What the kitchen has to produce on each day of the range. An item belongs to the menu day it was
 * picked for (the order day's `deliveryDate`), not to the day it is finally delivered. Only orders
 * that are really going to be cooked count: not cancelled, not refunded, not failed and not
 * a checkout that was never paid.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = {
      startDate: searchParams.get('startDate') ?? '',
      endDate: searchParams.get('endDate') ?? '',
    };
    const problem = validateRange(range);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const days = enumerateDays(range);

    const rows = await fetchDashboardRows(range);

    const builtDays = buildKitchenDays(rows, days);
    const builtWeek = buildKitchenWeek(rows);

    // how each item is prepared (cooked or ready to eat), by name: only when every food item with that name agrees
    const names = namesIn([...builtDays, builtWeek]);
    const typesByName = new Map<string, Set<string>>();
    if (names.length > 0) {
      const found = await db.read<{ name?: string; preparationType?: unknown }>('fooditems', { name: { $in: names } } as never, { projection: { name: 1, preparationType: 1 } } as never);
      for (const item of found.success ? found.data ?? [] : []) {
        const key = (item.name ?? '').trim();
        const set = typesByName.get(key) ?? new Set<string>();
        set.add(normalizePreparationType(item.preparationType) ?? 'none');
        typesByName.set(key, set);
      }
    }
    const typeByName = new Map<string, PreparationType | null>(
      [...typesByName].map(([name, set]) => [name, set.size === 1 && !set.has('none') ? ([...set][0] as PreparationType) : null])
    );

    return NextResponse.json({
      data: {
        startDate: range.startDate,
        endDate: range.endDate,
        days: builtDays.map((d) => withPreparation(d, typeByName)),
        // the whole range as one block, whatever the menu day or delivery day of each line
        week: withPreparation(builtWeek, typeByName),
      },
      message: 'Kitchen dashboard generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/kitchen-dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
