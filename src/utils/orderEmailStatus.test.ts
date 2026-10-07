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
