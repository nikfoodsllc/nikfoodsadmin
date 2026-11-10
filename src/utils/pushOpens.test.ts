import { describe, expect, it } from 'vitest';
import { audienceCounts, hasRecipients, openedText, sendLabel, sentTo, splitPeople, type Person } from './pushOpens';

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
