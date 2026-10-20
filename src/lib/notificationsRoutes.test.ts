import { describe, it, expect } from 'vitest';
import { notificationsTarget } from './notificationsRoutes';

describe('notificationsTarget', () => {
  it('maps the page routes', () => {
    expect(notificationsTarget(['summary'], 'GET')).toBe('/api/admin/push/summary');
    expect(notificationsTarget(['templates'], 'GET')).toBe('/api/admin/push/templates');
    expect(notificationsTarget(['templates'], 'POST')).toBe('/api/admin/push/templates');
    expect(notificationsTarget(['send-menu'], 'POST')).toBe('/api/admin/push/send-menu');
    expect(notificationsTarget(['test'], 'POST')).toBe('/api/admin/push/test');
  });
  it('maps one saved text by its id', () => {
    expect(notificationsTarget(['templates', '65f1a2b3c4d5e6f7a8b9c0d1'], 'PUT')).toBe('/api/admin/push/templates/65f1a2b3c4d5e6f7a8b9c0d1');
    expect(notificationsTarget(['templates', '65f1a2b3c4d5e6f7a8b9c0d1'], 'DELETE')).toBe('/api/admin/push/templates/65f1a2b3c4d5e6f7a8b9c0d1');
  });
  it('refuses wrong methods, odd ids and unknown paths', () => {
    expect(notificationsTarget(['summary'], 'POST')).toBeNull();
    expect(notificationsTarget(['send-menu'], 'GET')).toBeNull();
    expect(notificationsTarget(['templates', '../admin'], 'PUT')).toBeNull();
    expect(notificationsTarget(['templates', 'x'], 'DELETE')).toBeNull();
    expect(notificationsTarget(['anything'], 'GET')).toBeNull();
    expect(notificationsTarget(['templates', 'a', 'b'], 'PUT')).toBeNull();
  });
});
