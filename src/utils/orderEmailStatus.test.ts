import { describe, expect, it } from 'vitest';
import { orderEmailStatusView } from './orderEmailStatus';

describe('order confirmation email status for the Orders table', () => {
  it('no record: a dash', () => {
    expect(orderEmailStatusView(undefined)).toMatchObject({ label: '-', tone: 'none', detail: '' });
    expect(orderEmailStatusView(null)).toMatchObject({ label: '-', tone: 'none' });
    expect(orderEmailStatusView({})).toMatchObject({ label: '-', tone: 'none' });
    expect(orderEmailStatusView({ status: '  ' })).toMatchObject({ label: '-', tone: 'none' });
  });
  it('sent: green with the Pacific time of the last send', () => {
    const v = orderEmailStatusView({ status: 'sent', attempts: 1, lastAttempt: '2026-10-07T21:24:53.000Z' });
    expect(v).toMatchObject({ label: 'Sent', tone: 'good', detail: 'Oct 7, 2:24 PM' });
    expect(v.title).toContain('Oct 7, 2:24 PM');
  });
  it('sent after several tries says so', () => {
    const v = orderEmailStatusView({ status: 'sent', attempts: 3, lastAttempt: new Date('2026-10-07T21:24:53.000Z') });
    expect(v.detail).toBe('Oct 7, 2:24 PM · 3 tries');
    expect(v.title).toContain('after 3 tries');
  });
  it('failed: red, the error in the tooltip', () => {
    const v = orderEmailStatusView({ status: 'failed', attempts: 2, lastAttempt: '2026-10-07T21:24:53.000Z', error: 'Mailbox full' });
    expect(v).toMatchObject({ label: 'Failed', tone: 'bad' });
    expect(v.detail).toBe('2 tries · Oct 7, 2:24 PM');
    expect(v.title).toBe('Confirmation email failed: Mailbox full');
    expect(orderEmailStatusView({ status: 'failed', attempts: 1 }).title).toBe('Confirmation email failed');
  });
  it('retrying and pending: amber', () => {
    expect(orderEmailStatusView({ status: 'retrying', attempts: 2 })).toMatchObject({ label: 'Retrying', tone: 'warn', detail: '2 tries' });
    expect(orderEmailStatusView({ status: 'pending', attempts: 0 })).toMatchObject({ label: 'Pending', tone: 'warn' });
  });
  it('status words are case-insensitive and a strange one is shown, not hidden', () => {
    expect(orderEmailStatusView({ status: 'SENT' }).label).toBe('Sent');
    expect(orderEmailStatusView({ status: 'bounced' })).toMatchObject({ label: 'Bounced', tone: 'warn' });
  });
  it('a bad date or attempts value does not break it', () => {
    expect(orderEmailStatusView({ status: 'sent', attempts: -1, lastAttempt: 'not a date' })).toMatchObject({ label: 'Sent', detail: '' });
    expect(orderEmailStatusView({ status: 'sent', attempts: null, lastAttempt: null })).toMatchObject({ label: 'Sent', detail: '' });
  });
});

describe('what the email provider reported (delivery record)', () => {
  const sent = { status: 'sent', attempts: 1, lastAttempt: '2026-10-07T21:24:53.000Z' };
  it('no record: still Sent', () => {
    expect(orderEmailStatusView(sent, undefined).label).toBe('Sent');
    expect(orderEmailStatusView(sent, null).label).toBe('Sent');
    expect(orderEmailStatusView(sent, {}).label).toBe('Sent');
  });
  it('delivered: green with the delivery time', () => {
    const v = orderEmailStatusView(sent, { status: 'delivered', deliveredAt: '2026-10-07T21:24:55.000Z' });
    expect(v).toMatchObject({ label: 'Delivered', tone: 'good', detail: 'Oct 7, 2:24 PM' });
  });
  it('opened wins over delivered: green, last open time and the number of opens', () => {
    const v = orderEmailStatusView(sent, { status: 'delivered', openCount: 3, firstOpenedAt: '2026-10-07T22:00:00.000Z', lastOpenedAt: '2026-10-07T23:10:00.000Z' });
    expect(v).toMatchObject({ label: 'Opened', tone: 'good', detail: 'Oct 7, 4:10 PM · 3×' });
    expect(v.title).toContain('3 times');
    expect(orderEmailStatusView(sent, { status: 'delivered', openCount: 1, lastOpenedAt: '2026-10-07T23:10:00.000Z' }).detail).toBe('Oct 7, 4:10 PM');
  });
  it('opened with no times (filled from Resend history) still says Opened', () => {
    expect(orderEmailStatusView(sent, { status: 'delivered', openCount: 1, filledFromHistory: true })).toMatchObject({ label: 'Opened', tone: 'good' });
  });
  it('bounced and spam are red; the reason is in the tooltip', () => {
    const b = orderEmailStatusView(sent, { status: 'bounced', bounceReason: 'Mailbox does not exist' });
    expect(b).toMatchObject({ label: 'Bounced', tone: 'bad' });
    expect(b.title).toContain('Mailbox does not exist');
    expect(orderEmailStatusView(sent, { status: 'complained' })).toMatchObject({ label: 'Spam', tone: 'bad' });
    expect(orderEmailStatusView(sent, { status: 'failed' })).toMatchObject({ label: 'Failed', tone: 'bad' });
  });
  it('a bounce beats an earlier open; delayed is amber', () => {
    expect(orderEmailStatusView(sent, { status: 'bounced', openCount: 2 }).label).toBe('Bounced');
    expect(orderEmailStatusView(sent, { status: 'delayed' })).toMatchObject({ label: 'Delayed', tone: 'warn' });
  });
  it('the delivery record only refines a sent email: failed/pending/retrying/none stay as they are', () => {
    expect(orderEmailStatusView({ status: 'failed', attempts: 3 }, { status: 'delivered' }).label).toBe('Failed');
    expect(orderEmailStatusView({ status: 'pending' }, { status: 'delivered' }).label).toBe('Pending');
    expect(orderEmailStatusView(undefined, { status: 'delivered' }).label).toBe('-');
  });
  it('an unknown delivery status or bad counts leave it at Sent', () => {
    expect(orderEmailStatusView(sent, { status: 'whatever' }).label).toBe('Sent');
    expect(orderEmailStatusView(sent, { status: 'delivered', openCount: -2, deliveredAt: 'nope' }).label).toBe('Delivered');
  });
});
