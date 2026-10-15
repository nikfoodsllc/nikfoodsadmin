import { describe, expect, it } from 'vitest';
import { deliveryProgressLines, partialDeliveryTitle } from './deliveryProgress';

describe('deliveryProgressLines', () => {
  it('Wednesday delivered, Friday still to come', () => {
    const lines = deliveryProgressLines([{ date: '2026-10-16', status: 'pending' }, { date: '2026-10-14', status: 'delivered', at: '2026-10-14T20:05:00' }]);
    expect(lines.map((l) => [l.label, l.state, l.text])).toEqual([
      ['Wed, Oct 14', 'delivered', 'Delivered'],
      ['Fri, Oct 16', 'pending', 'Not delivered yet'],
    ]);
  });
  it('a failed day says so, an unknown status counts as not delivered yet', () => {
    const lines = deliveryProgressLines([{ date: '2026-10-14', status: 'failed' }, { date: '2026-10-15', status: 'weird' }, { date: '2026-10-16' }]);
    expect(lines.map((l) => l.state)).toEqual(['failed', 'pending', 'pending']);
  });
  it('skips records without a valid date and copes with nothing', () => {
    expect(deliveryProgressLines([{ date: 'x', status: 'delivered' }, { status: 'delivered' }, null as never])).toEqual([]);
    expect(deliveryProgressLines(undefined)).toEqual([]);
    expect(deliveryProgressLines(null)).toEqual([]);
  });
});

describe('partialDeliveryTitle', () => {
  it('one line per day', () => {
    expect(partialDeliveryTitle([{ date: '2026-10-14', status: 'delivered' }, { date: '2026-10-16', status: 'pending' }])).toBe('Wed, Oct 14: Delivered\nFri, Oct 16: Not delivered yet');
  });
  it('without a record it still explains', () => {
    expect(partialDeliveryTitle(undefined)).toContain('still to come');
  });
});
