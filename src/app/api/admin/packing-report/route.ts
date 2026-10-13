import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { fetchPackingRows } from '@/lib/packingRows';
import { isDayString } from '@/utils/kitchenDashboard';
import { buildPackingReport, type RosterRouteInput, type StopRecord } from '@/utils/packingReport';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false as const, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) return { success: false as const, error: result.error || 'Invalid token' };
  // admins and packers (the packing tools are the packer's work)
  if (result.payload.role !== 'admin' && result.payload.role !== 'packer') return { success: false as const, error: 'Unauthorized: Admin access required' };
  return { success: true as const };
}

/**
 * GET /api/admin/packing-report?date=YYYY-MM-DD
 *
 * What to pack for one DELIVERY date, in route order: the order lines delivered that day, the roster (drivers and their stops)
 * the customer site copied from OptimoRoute once it had planned the routes (`optimoRosters`), and our record of which orders
 * sit in which stop (`optimoStops`). Read only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    const date = new URL(request.url).searchParams.get('date') ?? '';
    if (!isDayString(date)) return NextResponse.json({ error: 'date must be a real day, YYYY-MM-DD' }, { status: 400 });

    const conn = await db.getDb();
    const [rows, rosterDoc, stopDocs] = await Promise.all([
      fetchPackingRows(date),
      conn.collection('optimoRosters').findOne({ date }),
      conn.collection('optimoStops').find({ date, state: { $in: ['sent', 'adopted'] } }, { projection: { _id: 0, orderIds: 1, optimoId: 1, optimoOrderNo: 1 } }).toArray(),
    ]);

    const roster = (Array.isArray(rosterDoc?.routes) ? rosterDoc.routes : []) as RosterRouteInput[];
    const report = buildPackingReport(date, rows, roster, stopDocs as unknown as StopRecord[]);
    return NextResponse.json({
      data: {
        ...report,
        roster: rosterDoc ? { fetchedAt: rosterDoc.fetchedAt ?? null, changedAt: rosterDoc.changedAt ?? null, drivers: roster.length } : null,
      },
      message: 'Packing report generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/packing-report:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
