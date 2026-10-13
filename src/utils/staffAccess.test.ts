import { describe, expect, it } from 'vitest';
import { packerMayOpen } from './staffAccess';

describe('packerMayOpen', () => {
  it('allows the Orders list, the Kitchen Dashboard and the Packing Report with Pack live', () => {
    expect(packerMayOpen('/admin/orders')).toBe(true);
    expect(packerMayOpen('/admin/orders/')).toBe(true);
    expect(packerMayOpen('/admin/reports/packing')).toBe(true);
    expect(packerMayOpen('/admin/reports/packing/live')).toBe(true);
    expect(packerMayOpen('/admin/kitchen-dashboard')).toBe(true);
  });
  it('turns away everything else, including look-alike paths', () => {
    for (const p of ['/admin', '/admin/kitchen-dashboard-old', '/admin/kitchen-report', '/admin/reports/kitchen', '/admin/create-order', '/admin/all-users', '/admin/admin-users', '/admin/reports/delivery', '/admin/reports', '/admin/ordersx', '/admin/orders-old', '/admin/reports/packingx', '/admin/dashboard', '/admin/understanding-admin', '', null, undefined]) {
      expect(packerMayOpen(p as string)).toBe(false);
    }
  });
  it('keeps the packing times for admins', () => {
    expect(packerMayOpen('/admin/reports/packing/metrics')).toBe(false);
    expect(packerMayOpen('/admin/reports/packing/metrics/')).toBe(false);
  });
});
