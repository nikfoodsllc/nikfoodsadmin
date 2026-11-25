/**
 * Where an order was placed: the customer website, the app (iPhone or Android), or by an admin (Create Order).
 * App orders carry `appPlatform` ('ios' | 'android'); app orders from before Android have none and are iPhone.
 * The live site writes `channel` ('web' | 'mobile') when a customer checks out; an order an admin entered has `source: 'admin'`.
 * Orders from before this existed have neither and count as the website.
 */
export type OrderChannel = 'web' | 'mobile' | 'admin';

export interface ChannelLike {
  channel?: string | null;
  source?: string | null;
  appPlatform?: string | null;
}

export const CHANNEL_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'web', label: 'Website' },
  { value: 'mobile', label: 'Mobile app (both)' },
  { value: 'mobile_ios', label: 'iPhone app' },
  { value: 'mobile_android', label: 'Android app' },
  { value: 'admin', label: 'Entered by admin' },
] as const;

/** Which app an app order came from (null for website and admin orders). */
export function appPlatformOf(order: ChannelLike): 'ios' | 'android' | null {
  if (channelOf(order) !== 'mobile') return null;
  return order.appPlatform === 'android' ? 'android' : 'ios';
}

/** The Order Source text: Website, Admin, or "iPhone app" / "Android app". */
export function channelLabel(order: ChannelLike): string {
  const p = appPlatformOf(order);
  if (p) return p === 'android' ? 'Android app' : 'iPhone app';
  return CHANNEL_LABELS[channelOf(order)];
}

export const CHANNEL_LABELS: Record<OrderChannel, string> = { web: 'Website', mobile: 'Mobile app', admin: 'Admin' };

export function channelOf(order: ChannelLike): OrderChannel {
  if (order.source === 'admin') return 'admin';
  return order.channel === 'mobile' ? 'mobile' : 'web';
}

/** The database filter for the Orders list (null for All or an unknown value). */
export function channelFilterFor(value: string | null | undefined): Record<string, unknown> | null {
  if (value === 'mobile') return { channel: 'mobile', source: { $ne: 'admin' } };
  if (value === 'mobile_android') return { channel: 'mobile', source: { $ne: 'admin' }, appPlatform: 'android' };
  if (value === 'mobile_ios') return { channel: 'mobile', source: { $ne: 'admin' }, appPlatform: { $ne: 'android' } };
  if (value === 'web') return { source: { $ne: 'admin' }, channel: { $ne: 'mobile' } };
  if (value === 'admin') return { source: 'admin' };
  return null;
}
