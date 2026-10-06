import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { fetchKitchenRows } from '@/lib/kitchenRows';
import { buildKitchenDays, buildKitchenWeek, enumerateDays, validateRange } from '@/utils/kitchenDashboard';

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

  if (verificationResult.payload.role !== 'admin') {
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

    const rows = await fetchKitchenRows(range);

    return NextResponse.json({
      data: {
        startDate: range.startDate,
        endDate: range.endDate,
        days: buildKitchenDays(rows, days),
        // the whole range as one block, whatever the menu day or delivery day of each line
        week: buildKitchenWeek(rows),
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
