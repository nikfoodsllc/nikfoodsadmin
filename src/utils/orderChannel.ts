/**
 * Where an order was placed: the customer website, the iPhone app, or by an admin (Create Order).
 * The live site writes `channel` ('web' | 'mobile') when a customer checks out; an order an admin entered has `source: 'admin'`.
 * Orders from before this existed have neither and count as the website.
 */
export type OrderChannel = 'web' | 'mobile' | 'admin';

export interface ChannelLike {
  channel?: string | null;
  source?: string | null;
}

export const CHANNEL_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'web', label: 'Website' },
  { value: 'mobile', label: 'Mobile app' },
  { value: 'admin', label: 'Entered by admin' },
] as const;

export const CHANNEL_LABELS: Record<OrderChannel, string> = { web: 'Website', mobile: 'Mobile app', admin: 'Admin' };

export function channelOf(order: ChannelLike): OrderChannel {
  if (order.source === 'admin') return 'admin';
  return order.channel === 'mobile' ? 'mobile' : 'web';
}

/** The database filter for the Orders list (null for All or an unknown value). */
export function channelFilterFor(value: string | null | undefined): Record<string, unknown> | null {
  if (value === 'mobile') return { channel: 'mobile', source: { $ne: 'admin' } };
  if (value === 'web') return { source: { $ne: 'admin' }, channel: { $ne: 'mobile' } };
  if (value === 'admin') return { source: 'admin' };
  return null;
}
