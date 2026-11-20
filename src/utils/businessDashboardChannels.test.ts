import { describe, expect, it } from 'vitest';
import { channelOf, channelSeries, channelTotals, type SaleOrder } from './businessDashboard';

const o = (day: string, extra: Partial<SaleOrder> = {}): SaleOrder => ({ day, subtotal: 40, totalPaid: 45, paymentStatus: 'paid', ...extra });

describe('channelOf', () => {
  it('admin-entered = offline, app = mobile, everything else = website', () => {
    expect(channelOf({ source: 'admin' })).toBe('offline');
    expect(channelOf({ source: 'admin', channel: 'mobile' })).toBe('offline');
    expect(channelOf({ channel: 'mobile' })).toBe('app');
    expect(channelOf({ channel: 'web' })).toBe('website');
    expect(channelOf({})).toBe('website');
  });
});

describe('channelTotals and channelSeries', () => {
  const range = { from: '2026-11-14', to: '2026-11-20' };
  const orders = [
    o('2026-11-14'),
    o('2026-11-15', { channel: 'web' }),
    o('2026-11-15', { channel: 'mobile', subtotal: 20 }),
    o('2026-11-16', { source: 'admin', subtotal: 30, paymentStatus: 'refunded', totalPaid: 30 }),
    o('2026-11-16', { paymentStatus: 'pending' }), // not a sale
    o('2026-11-21', { channel: 'mobile' }), // outside the range
  ];
  it('counts sales per channel with gross, net and share', () => {
    const t = channelTotals(orders, range);
    expect(t.website).toEqual({ orders: 2, gross: 80, net: 80, share: 50 });
    expect(t.app).toEqual({ orders: 1, gross: 20, net: 20, share: 25 });
    expect(t.offline).toEqual({ orders: 1, gross: 30, net: 0, share: 25 });
  });
  it('gives zero shares for an empty period', () => {
    expect(channelTotals([], range).app).toEqual({ orders: 0, gross: 0, net: 0, share: 0 });
  });
  it('splits each day by channel', () => {
    const s = channelSeries(orders, range, 'day');
    expect(s).toHaveLength(7);
    expect(s.find((b) => b.key === '2026-11-15')).toMatchObject({ website: 1, app: 1, offline: 0 });
    expect(s.find((b) => b.key === '2026-11-16')).toMatchObject({ website: 0, app: 0, offline: 1 });
    expect(s.reduce((n, b) => n + b.website + b.app + b.offline, 0)).toBe(4);
  });
});
