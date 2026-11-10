import { describe, expect, it } from 'vitest';
import { audienceCounts, groupNote, groupSends, hasRecipients, mergePeople, openedText, sendLabel, sentTo, splitPeople, type Person, type SendRow } from './pushOpens';

describe('openedText', () => {
  it('shows opens out of customers with a percentage', () => {
    expect(openedText(3, 12)).toBe('3 of 12 opened (25%)');
    expect(openedText(0, 5)).toBe('0 of 5 opened (0%)');
  });
  it('never goes over 100% when the customer count is behind', () => {
    expect(openedText(4, 3)).toBe('4 of 4 opened (100%)');
  });
  it('is a dash when nothing was sent', () => {
    expect(openedText(0, 0)).toBe('–');
  });
});

describe('sendLabel', () => {
  it('prefers the automatic event, then the kind', () => {
    expect(sendLabel({ kind: 'orders', event: 'delivered' })).toBe('Delivered');
    expect(sendLabel({ kind: 'menu', event: '' })).toBe('Menu alert');
    expect(sendLabel({ kind: 'x', event: '' })).toBe('Message');
  });
});

describe('hasRecipients', () => {
  it('needs a phone or a customer', () => {
    expect(hasRecipients({ sent: 0, customers: 0 })).toBe(false);
    expect(hasRecipients({ sent: 2, customers: 1 })).toBe(true);
  });
});

const person = (id: string, opened: boolean): Person => ({ userId: id, name: id, email: '', opened, firstOpenedAt: opened ? '2026-11-09T18:00:00Z' : null, openCount: opened ? 1 : 0 });

describe('who got it', () => {
  it('counts and splits the list', () => {
    const people = [person('a', true), person('b', false), person('c', false)];
    expect(audienceCounts(people)).toEqual({ total: 3, opened: 1, notOpened: 2 });
    const s = splitPeople(people);
    expect(s.opened.map((p) => p.userId)).toEqual(['a']);
    expect(s.notOpened.map((p) => p.userId)).toEqual(['b', 'c']);
  });
  it('an empty list is all zeros', () => {
    expect(audienceCounts([])).toEqual({ total: 0, opened: 0, notOpened: 0 });
  });
  it('sentTo prefers who it reached', () => {
    expect(sentTo({ reached: 5, customers: 36 })).toBe(5);
    expect(sentTo({ reached: null, customers: 36 })).toBe(36);
    expect(sentTo({ customers: 12 })).toBe(12);
  });
});

describe('groupSends / mergePeople', () => {
  const row = (pushId: string, event: string, sentAt: string, sent: number, openedBy: number, kind = 'orders'): SendRow => ({ pushId, kind, event, title: '', sentAt, sent, customers: sent, reached: sent, openedBy });
  it('rolls automatic events into one row per type per Pacific day, leaves manual ones alone', () => {
    const rows = [
      row('a', 'confirmed', '2026-11-10T17:03:00Z', 1, 0),
      row('b', 'confirmed', '2026-11-10T16:51:00Z', 1, 1),
      row('c', 'confirmed', '2026-11-10T06:00:00Z', 1, 0), // Nov 9 10 PM Pacific
      row('d', 'on_the_way', '2026-11-10T18:00:00Z', 1, 0),
      row('e', '', '2026-11-10T17:30:00Z', 37, 0, 'updates'),
    ];
    const g = groupSends(rows);
    expect(g.map((x) => x.pushIds.join())).toEqual(['d', 'e', 'a,b', 'c']);
    const day = g.find((x) => x.pushIds.length === 2)!;
    expect(day.sent).toBe(2);
    expect(day.openedBy).toBe(1);
    expect(day.sentAt).toBe('2026-11-10T17:03:00Z');
    expect(groupNote(day)).toBe('2 sent');
    expect(groupNote(g[0])).toBe('');
  });
  it('merges people: opened if any, counts added', () => {
    const p = (userId: string, opened: boolean, n: number, at: string | null): Person => ({ userId, name: userId, email: '', opened, firstOpenedAt: at, openCount: n });
    const m = mergePeople([[p('x', false, 0, null), p('y', true, 1, '2026-11-10T10:00:00Z')], [p('x', true, 2, '2026-11-10T09:00:00Z')]]);
    expect(m.map((q) => q.userId)).toEqual(['x', 'y']);
    expect(m[0]).toMatchObject({ opened: true, openCount: 2, firstOpenedAt: '2026-11-10T09:00:00Z' });
  });
});
