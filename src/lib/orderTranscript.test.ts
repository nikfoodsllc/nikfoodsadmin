import { describe, expect, it } from 'vitest';
import { adminIdsIn, buildOrderTranscript, dayLabel } from './orderTranscript';

const order = {
  createdAt: '2026-10-19T17:00:00Z',
  status: 'confirmed',
  paymentStatus: 'paid',
  paymentMethod: 'Credit Card',
  totalPaid: 43,
  emailStatus: { status: 'sent', lastAttempt: '2026-10-19T17:01:00Z' },
  reschedules: [
    {
      at: '2026-10-19T20:00:00Z',
      by: { id: 'a1', name: 'Nikita' },
      changes: [
        { name: 'Kadhai Chicken', quantity: 1, fromDeliveryDate: '2026-10-22', toDate: '2026-10-20' },
        { name: 'Spl. Punjabi Kadhi Pakora', quantity: 2, fromDeliveryDate: '2026-10-22', toDate: '2026-10-20' },
      ],
    },
  ],
  creditsIssued: [{ at: '2026-10-19T21:00:00Z', by: '64b7f0c2a1b2c3d4e5f60001', amount: 8, items: [{ name: 'X', quantity: 1, amount: 8 }], note: 'late' }],
  statusHistory: [{ at: '2026-10-19T22:00:00Z', by: { id: '64b7f0c2a1b2c3d4e5f60001' }, from: 'confirmed', to: 'cancelled' }],
};

describe('buildOrderTranscript', () => {
  it('lists everything newest first with who did it', () => {
    const events = buildOrderTranscript(order, { '64b7f0c2a1b2c3d4e5f60001': 'Shrey' });
    expect(events.map((e) => e.kind)).toEqual(['cancel', 'credit', 'date', 'email', 'payment', 'order']);
    expect(events[0].by).toBe('Shrey');
    expect(events[2].text).toBe('Delivery date changed: 2 items moved from Thu, Oct 22 to Tue, Oct 20');
    expect(events[2].details).toEqual(['Kadhai Chicken', '2 × Spl. Punjabi Kadhi Pakora']);
    expect(events[2].by).toBe('Nikita');
    expect(events[1].details).toContain('Note: late');
  });
  it('wording for store credit payments, an admin order, a failed email and a plain cancel', () => {
    const e = buildOrderTranscript({ createdAt: '2026-10-19T17:00:00Z', source: 'admin', createdByAdmin: 'x', paymentStatus: 'paid', totalPaid: 10, storeCreditUsed: 10, storeCreditState: 'applied', status: 'cancelled', updatedAt: '2026-10-20T00:00:00Z', emailStatus: { status: 'failed', lastAttempt: '2026-10-19T17:02:00Z', error: 'boom' } });
    const texts = e.map((x) => x.text);
    expect(texts).toContain('Paid in full with store credit ($10.00)');
    expect(texts).toContain('Order entered by an admin');
    expect(texts).toContain('Order cancelled');
    expect(texts).toContain('Confirmation email failed to send');
  });
  it('knows which admin ids to look up and formats days', () => {
    expect(adminIdsIn(order)).toEqual(['64b7f0c2a1b2c3d4e5f60001']);
    expect(dayLabel('2026-10-22')).toBe('Thu, Oct 22');
  });
});
