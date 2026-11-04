import { describe, expect, it } from 'vitest';
import { recentReminders, waitingNote, type RecentReminders } from './abandonedWaiting';

const now = new Date('2026-10-22T20:00:00Z');
const none: RecentReminders = { byUser: new Map(), byEmail: new Map() };
const row = (over: Partial<{ userId: string; email: string; lastActivityAt: string; noItemDetails: boolean }> = {}) => ({
  userId: 'u1',
  email: 'a@example.com',
  lastActivityAt: '2026-10-22T16:00:00Z',
  noItemDetails: false,
  ...over,
});

describe('waitingNote', () => {
  it('says waiting when nothing holds the reminder back', () => {
    expect(waitingNote(row(), none, now)).toEqual({ code: 'waiting', text: 'Waiting for the reminder email' });
  });
  it('says the reminder is not due yet in the first 30 minutes', () => {
    expect(waitingNote(row({ lastActivityAt: '2026-10-22T19:45:00Z' }), none, now).code).toBe('soon');
  });
  it('explains the 2-day gap with the date of the earlier reminder, by person or by email', () => {
    const at = new Date('2026-10-21T16:00:00Z').getTime();
    const byUser: RecentReminders = { byUser: new Map([['u1', [at]]]), byEmail: new Map() };
    expect(waitingNote(row(), byUser, now)).toEqual({ code: 'gap', text: 'No reminder: already emailed Oct 21 (one every 2 days)' });
    const byEmail: RecentReminders = { byUser: new Map(), byEmail: new Map([['a@example.com', [at]]]) };
    expect(waitingNote(row({ email: 'A@Example.com' }), byEmail, now).code).toBe('gap');
  });
  it('says too old after 24 hours, no email, no items', () => {
    expect(waitingNote(row({ lastActivityAt: '2026-10-21T10:00:00Z' }), none, now).code).toBe('too_old');
    expect(waitingNote(row({ email: '' }), none, now).code).toBe('no_email');
    expect(waitingNote(row({ noItemDetails: true }), none, now).code).toBe('no_items');
  });
  it('checks no email before everything else', () => {
    const at = new Date('2026-10-21T16:00:00Z').getTime();
    expect(waitingNote(row({ email: undefined }), { byUser: new Map([['u1', [at]]]), byEmail: new Map() }, now).code).toBe('no_email');
  });
});

describe('waitingNote past 24 hours', () => {
  const day = (iso: string) => new Date(iso).getTime();
  it('blames the 2-day rule when an earlier reminder kept the whole window blocked (the Nov 1 / Nov 2 case)', () => {
    const recent: RecentReminders = { byUser: new Map([['u1', [day('2026-11-01T21:00:00Z')]]]), byEmail: new Map() };
    const n = waitingNote(row({ lastActivityAt: '2026-11-02T20:01:00Z' }), recent, new Date('2026-11-04T19:00:00Z'));
    expect(n).toEqual({ code: 'gap', text: 'No reminder: already emailed Nov 1 (one every 2 days)' });
  });
  it('says too old when the earlier reminder was long before the window', () => {
    const recent: RecentReminders = { byUser: new Map([['u1', [day('2026-10-28T21:00:00Z')]]]), byEmail: new Map() };
    expect(waitingNote(row({ lastActivityAt: '2026-11-02T20:01:00Z' }), recent, new Date('2026-11-04T19:00:00Z')).code).toBe('too_old');
  });
  it('says too old when the gap ended inside the window (a reminder could have gone)', () => {
    const recent: RecentReminders = { byUser: new Map([['u1', [day('2026-10-31T10:00:00Z')]]]), byEmail: new Map() };
    expect(waitingNote(row({ lastActivityAt: '2026-11-02T20:01:00Z' }), recent, new Date('2026-11-04T19:00:00Z')).code).toBe('too_old');
  });
});

describe('recentReminders', () => {
  it('keeps the newest reminder per person and email, and ignores failed ones', () => {
    const r = recentReminders([
      { userId: 'u1', customer: { email: 'A@x.com' }, reminderEmail: { claimedAt: '2026-10-20T10:00:00Z', status: 'delivered' } },
      { userId: 'u1', customer: { email: 'a@x.com' }, reminderEmail: { claimedAt: '2026-10-21T10:00:00Z', status: 'sent' } },
      { userId: 'u2', customer: { email: 'b@x.com' }, reminderEmail: { claimedAt: '2026-10-21T10:00:00Z', status: 'failed' } },
      { userId: 'u3', customer: { email: 'c@x.com' } },
    ]);
    expect(r.byUser.get('u1')).toEqual([new Date('2026-10-20T10:00:00Z').getTime(), new Date('2026-10-21T10:00:00Z').getTime()]);
    expect(r.byEmail.get('a@x.com')).toEqual([new Date('2026-10-20T10:00:00Z').getTime(), new Date('2026-10-21T10:00:00Z').getTime()]);
    expect(r.byUser.has('u2')).toBe(false);
    expect(r.byUser.has('u3')).toBe(false);
  });
});
