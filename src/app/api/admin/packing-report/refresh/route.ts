import { NextRequest } from 'next/server';
import { forwardPostToLivesite } from '@/lib/livesiteForward';

/**
 * POST /api/admin/packing-report/refresh {date}: asks the customer site (which holds the OptimoRoute key) to read that
 * day's drivers and stops from OptimoRoute now. Read only towards OptimoRoute.
 */
export async function POST(request: NextRequest) {
  return forwardPostToLivesite(request, '/api/admin/optimoroute/roster', 'packing-report refresh');
}
