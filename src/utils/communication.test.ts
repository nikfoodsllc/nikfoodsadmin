import { describe, it, expect } from 'vitest';
import { addDays, audienceTitle, countLine, fillPlaceholders, filterReady, pacificLocalToIso, pacificText, previewValues, reachOf, textTimeOk, withPlaceholder, type AudienceCustomer } from './communication';

const c = (key: string, o: Partial<AudienceCustomer> = {}): AudienceCustomer => ({ key, name: key, email: `${key}@x.com`, phone: null, orders: ['ORD-1'], textOk: false, textReason: null, ...o });

describe('filters', () => {
  it('titles', () => {
    expect(audienceTitle({ kind: 'delivery_date', date: '2026-11-06' })).toBe('Due for delivery Fri, Nov 6');
    expect(audienceTitle({ kind: 'menu_day', date: '2026-11-05' })).toBe('Ordered for the Thu, Nov 5 menu');
    expect(audienceTitle({ kind: 'ordered_between', from: '2026-11-01', to: '2026-11-01' })).toBe('Ordered on Sun, Nov 1');
    expect(audienceTitle({ kind: 'ordered_between', from: '2026-11-01', to: '2026-11-03' })).toBe('Ordered Sun, Nov 1 to Tue, Nov 3');
  });
  it('is ready only with real days in order', () => {
    expect(filterReady({ kind: 'delivery_date', date: '2026-11-06' })).toBe(true);
    expect(filterReady({ kind: 'delivery_date' })).toBe(false);
    expect(filterReady({ kind: 'ordered_between', from: '2026-11-05', to: '2026-11-01' })).toBe(false);
    expect(filterReady({ kind: 'ordered_between', from: '2026-11-01', to: '2026-11-05' })).toBe(true);
  });
  it('adds days', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01'));
});

describe('Pacific time of a scheduled send', () => {
  it('reads the typed time as Pacific whatever the browser zone is', () => {
    expect(pacificLocalToIso('2026-11-08T09:30')).toBe('2026-11-08T17:30:00.000Z'); // PST
    expect(pacificLocalToIso('2026-07-01T09:30')).toBe('2026-07-01T16:30:00.000Z'); // PDT
  });
  it('handles the days daylight saving changes', () => {
    expect(pacificLocalToIso('2026-11-01T12:00')).toBe('2026-11-01T20:00:00.000Z'); // PST after the change at 2 AM
    expect(pacificLocalToIso('2026-03-08T12:00')).toBe('2026-03-08T19:00:00.000Z'); // PDT after the change
  });
  it('refuses things that are not a time', () => {
    expect(pacificLocalToIso('')).toBeNull();
    expect(pacificLocalToIso('2026-11-08')).toBeNull();
    expect(pacificLocalToIso('2026-13-08T09:30')).toBeNull();
  });
  it('writes it back and checks the text window', () => {
    expect(pacificText('2026-11-08T17:30:00.000Z')).toBe('Sun, Nov 8 at 9:30 AM');
    expect(textTimeOk('2026-11-08T16:00:00.000Z')).toBe(true); // 8:00 AM PST
    expect(textTimeOk('2026-11-08T15:59:00.000Z')).toBe(false);
    expect(textTimeOk('2026-11-09T05:00:00.000Z')).toBe(false); // 9:00 PM PST
  });
});

describe('who is reached', () => {
  const list = [c('a', { textOk: true }), c('b', { email: null }), c('d')];
  it('counts email and text among the picked ones only', () => {
    expect(reachOf(list, new Set(['a', 'b', 'd']))).toEqual({ customers: 3, email: 2, noEmail: 1, text: 1, noText: 2 });
    expect(reachOf(list, new Set(['b']))).toEqual({ customers: 1, email: 0, noEmail: 1, text: 0, noText: 1 });
    expect(reachOf(list, new Set())).toEqual({ customers: 0, email: 0, noEmail: 0, text: 0, noText: 0 });
  });
});

describe('history counts', () => {
  it('reads like a sentence', () => {
    expect(countLine({ sent: 3, delivered: 40, bounced: 1, failed: 1, queued: 5, skipped: 2 })).toBe('43 sent · 40 delivered · 2 failed · 5 waiting · 2 skipped');
    expect(countLine(undefined)).toBe('0 sent');
  });
});

describe('message helpers', () => {
  it('adds a placeholder with one space', () => {
    expect(withPlaceholder('', '{firstName}')).toBe('{firstName}');
    expect(withPlaceholder('Hi', '{firstName}')).toBe('Hi {firstName}');
    expect(withPlaceholder('Hi ', '{firstName}')).toBe('Hi {firstName}');
  });
  it('fills a preview from the first customer or a sample', () => {
    const v = previewValues(c('x', { name: 'Asha Rao', orders: ['ORD-9'] }), { kind: 'delivery_date', date: '2026-11-06' });
    expect(fillPlaceholders('Hi {firstName}, {orderNumber} on {date}', v)).toBe('Hi Asha, ORD-9 on Friday, November 6');
    expect(previewValues(undefined, { kind: 'ordered_between', from: '2026-11-01', to: '2026-11-02' })).toEqual({ firstName: 'Alex', orderNumber: 'ORD-0000000000000', date: '' });
  });
});
