import { describe, expect, it } from 'vitest';
import { dateOnly, orderDayHeading, weekdayOf } from './orderDays';

describe('orderDayHeading', () => {
  it('keeps the menu day with its own date and notes the real delivery day (the ORD-1791393876046886 case)', () => {
    const h = orderDayHeading({ day: 'Thursday', deliveryDate: '2026-10-08', actualDeliveryDate: '2026-10-09' });
    expect(h.menuDay).toBe('Thursday');
    expect(h.menuDate).toBe('2026-10-08');
    expect(h.deliveredOn).toEqual({ date: '2026-10-09', weekday: 'Friday' });
  });

  it('has no delivery note when delivered on the menu day, or with no actual date', () => {
    expect(orderDayHeading({ day: 'Friday', deliveryDate: '2026-10-09', actualDeliveryDate: '2026-10-09' }).deliveredOn).toBeNull();
    expect(orderDayHeading({ day: 'Friday', deliveryDate: '2026-10-09' }).deliveredOn).toBeNull();
  });

  it('compares days, not how the dates were stored', () => {
    expect(orderDayHeading({ day: 'Friday', deliveryDate: new Date('2026-10-09T00:00:00Z'), actualDeliveryDate: '2026-10-09T00:00:00.000Z' }).deliveredOn).toBeNull();
    expect(orderDayHeading({ day: 'Thursday', deliveryDate: new Date('2026-10-08T00:00:00Z'), actualDeliveryDate: new Date('2026-10-09T00:00:00Z') }).deliveredOn?.weekday).toBe('Friday');
  });

  it('falls back to the weekday of the date when the day name is missing', () => {
    expect(orderDayHeading({ deliveryDate: '2026-10-08' }).menuDay).toBe('Thursday');
  });

  it('helpers handle odd input', () => {
    expect(dateOnly(undefined)).toBe('');
    expect(dateOnly('garbage')).toBe('');
    expect(dateOnly(new Date('x'))).toBe('');
    expect(weekdayOf('nope')).toBe('');
    expect(weekdayOf('2026-10-09')).toBe('Friday');
  });
});
