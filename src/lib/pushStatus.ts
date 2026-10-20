import { NextRequest } from 'next/server';

/** The statuses an admin can set by hand that the customer is told about (the same two the driver route sends). */
export function isAnnouncedStatus(status: unknown): status is 'out_for_delivery' | 'delivered' {
  return status === 'out_for_delivery' || status === 'delivered';
}

/**
 * Asks the customer site to send the matching app notification after an admin changed order statuses by hand. The customer site
 * decides who gets it (paid orders only, once per delivery day). Never throws and never delays the status change by more than a few
 * seconds: a notification problem must not break the update.
 */
export async function announceStatusChange(request: NextRequest, orderIds: string[], status: 'out_for_delivery' | 'delivered'): Promise<void> {
  const auth = request.headers.get('authorization');
  const ids = orderIds.filter((id) => typeof id === 'string' && id.startsWith('ORD-')).slice(0, 100);
  if (!auth || ids.length === 0) return;
  try {
    const base = (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
    await fetch(`${base}/api/admin/push/order-status`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids, status }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error('[push] could not announce the status change', error instanceof Error ? error.message : error);
  }
}
