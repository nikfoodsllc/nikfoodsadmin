import { describe, it, expect } from 'vitest';
import { EMAIL_DESIGN_GUIDE } from './emailDesignGuide';
import { EMAIL_TEMPLATES } from './emailTemplates';
import { splitEmails, htmlProblem, previewHtml, placeholdersFor, whenText, addDays, audienceTitle, countLine, fillPlaceholders, filterReady, pacificLocalToIso, pacificText, previewValues, reachOf, textTimeOk, withPlaceholder, type AudienceCustomer } from './communication';

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

describe('when a message goes out', () => {
  it('says what is true for each state', () => {
    expect(whenText({ status: 'scheduled', scheduledFor: '2026-11-08T17:30:00.000Z' })).toBe('Goes out Sun, Nov 8 at 9:30 AM');
    expect(whenText({ status: 'cancelled', scheduledFor: '2026-11-08T17:30:00.000Z' })).toBe('Was scheduled for Sun, Nov 8 at 9:30 AM');
    expect(whenText({ status: 'done', startedAt: '2026-11-08T17:30:00.000Z' })).toBe('Started Sun, Nov 8 at 9:30 AM');
    expect(whenText({ status: 'sending' })).toBe('');
  });
});

describe('specific people and everyone', () => {
  it('titles and readiness', () => {
    expect(audienceTitle({ kind: 'all' })).toBe('Everyone');
    expect(audienceTitle({ kind: 'people', userIds: ['a'] })).toBe('1 chosen person');
    expect(audienceTitle({ kind: 'people', userIds: ['a', 'b'] })).toBe('2 chosen people');
    expect(filterReady({ kind: 'all' })).toBe(true);
    expect(filterReady({ kind: 'people', userIds: [] })).toBe(false);
    expect(filterReady({ kind: 'people' })).toBe(false);
    expect(filterReady({ kind: 'people', userIds: ['a'] })).toBe(true);
  });
  it('offers only the placeholders that make sense', () => {
    expect(placeholdersFor('delivery_date')).toEqual(['{firstName}', '{orderNumber}', '{date}']);
    expect(placeholdersFor('menu_day')).toEqual(['{firstName}', '{orderNumber}', '{date}']);
    expect(placeholdersFor('ordered_between')).toEqual(['{firstName}', '{orderNumber}']);
    expect(placeholdersFor('people')).toEqual(['{firstName}']);
    expect(placeholdersFor('all')).toEqual(['{firstName}']);
  });
});

describe('custom HTML email', () => {
  it('refuses what mail apps block', () => {
    expect(htmlProblem('<p>a</p><script>x()</script>')).toMatch(/script/);
    expect(htmlProblem('<a onclick="x()">a</a>')).toMatch(/onclick/);
    expect(htmlProblem('<a href="javascript:x()">a</a>')).toMatch(/javascript/);
    expect(htmlProblem('<form></form>')).toMatch(/form/);
    expect(htmlProblem('<p>Press the button below</p>')).toBeNull();
  });
  it('fills placeholders safely and swaps the logo for the preview', () => {
    const out = previewHtml('<img src="cid:nikfoods-logo">Hi {firstName}', { firstName: '<b>x</b>', orderNumber: '', date: '' });
    expect(out).toContain('https://www.nikfoods.com/images/logo.png');
    expect(out).toContain('Hi &lt;b&gt;x&lt;/b&gt;');
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
  });
  it('keeps a full page as it is', () => {
    expect(previewHtml('<html><body>x</body></html>', { firstName: 'A', orderNumber: '', date: '' })).toBe('<html><body>x</body></html>');
  });
  it('every ready-made design is clean, uses the logo and only known placeholders', () => {
    for (const t of EMAIL_TEMPLATES) {
      expect(htmlProblem(t.html)).toBeNull();
      expect(t.html).toContain('cid:nikfoods-logo');
      expect(t.html.length).toBeLessThan(30_000);
      const names = [...t.html.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1]);
      for (const n of names) expect(['firstName', 'orderNumber', 'date', 'unsubscribeUrl']).toContain(n);
      expect(t.html).toContain('{unsubscribeUrl}');
    }
  });
  it('the new audience has a title and needs nothing else', () => {
    expect(audienceTitle({ kind: 'subscribers' })).toBe('Agreed to get emails');
    expect(filterReady({ kind: 'subscribers' })).toBe(true);
    expect(placeholdersFor('subscribers')).toEqual(['{firstName}']);
  });
});

describe('unsubscribed customers', () => {
  it('are not counted as reachable by email', () => {
    const list: AudienceCustomer[] = [
      { key: 'a', name: 'A', email: 'a@x.com', phone: null, orders: [], textOk: false, textReason: null },
      { key: 'b', name: 'B', email: 'b@x.com', phone: null, orders: [], textOk: false, textReason: null, unsubscribed: true },
    ];
    expect(reachOf(list, new Set(['a', 'b']))).toEqual({ customers: 2, email: 1, noEmail: 1, text: 0, noText: 2 });
  });
});

describe('App Store invitation in every email', () => {
  const badge = '<a href="https://apps.apple.com/us/app/id6767141830"><img src="cid:app-store-badge" alt="Download on the App Store" width="120" height="40"></a>';
  it('the AI instructions require it, with the exact badge, link and one-line rule', () => {
    for (const w of ['ALWAYS INVITE PEOPLE TO GET THE APP', 'every email, no exception', 'cid:app-store-badge', 'https://apps.apple.com/us/app/id6767141830', 'under 8 words', 'ONLY link allowed besides the main button']) expect(EMAIL_DESIGN_GUIDE).toContain(w);
  });
  it('never mentions the old app link that differs from the one the site uses', () => {
    expect(EMAIL_DESIGN_GUIDE).not.toContain('apps.apple.com/app/id');
  });
  it('a design with the badge passes the checks and the preview shows the badge from the site', () => {
    expect(htmlProblem(`<html><body><p>Hi</p>${badge}<a href="{unsubscribeUrl}">Unsubscribe</a></body></html>`)).toBeNull();
    const shown = previewHtml(badge, { firstName: 'A', orderNumber: '', date: '' });
    expect(shown).toContain('https://www.nikfoods.com/images/app-store-badge.png');
    expect(shown).not.toContain('cid:app-store-badge');
  });
});

describe('AI design instructions', () => {
  it('state the rules the server enforces', () => {
    for (const w of ['cid:nikfoods-logo', '{unsubscribeUrl}', '{firstName}', '90,000', '<script>', 'bgcolor', 'support@nikfoods.com']) expect(EMAIL_DESIGN_GUIDE).toContain(w);
  });
});

describe('typed email addresses', () => {
  it('splits pasted text on commas, semicolons, spaces and new lines', () => {
    const r = splitEmails('Ann@Gmail.com, bob@x.org;\ncara@y.com  <dev@z.io> ann@gmail.com');
    expect(r.valid).toEqual(['ann@gmail.com', 'bob@x.org', 'cara@y.com', 'dev@z.io']);
    expect(r.invalid).toEqual([]);
  });
  it('reports what is not an address and refuses test domains', () => {
    const r = splitEmails('good@x.com nope a@b test@example.com z@q.invalid');
    expect(r.valid).toEqual(['good@x.com']);
    expect(r.invalid).toEqual(['nope', 'a@b', 'test@example.com', 'z@q.invalid']);
  });
  it('an empty box gives nothing', () => {
    expect(splitEmails('  ')).toEqual({ valid: [], invalid: [] });
  });
  it('a filter with only typed addresses is ready, and its title says so', () => {
    expect(filterReady({ kind: 'people', userIds: [], alsoEmails: ['a@b.com'] })).toBe(true);
    expect(filterReady({ kind: 'people', userIds: [] })).toBe(false);
    expect(audienceTitle({ kind: 'people', userIds: [], alsoEmails: ['a@b.com'] })).toBe('Email addresses you typed');
    expect(audienceTitle({ kind: 'all', alsoEmails: ['a@b.com', 'c@d.com'] })).toBe('Everyone + 2 email addresses');
    expect(audienceTitle({ kind: 'delivery_date', date: '2026-11-14', alsoUserIds: ['x'], alsoEmails: ['a@b.com'] })).toContain('+ 1 added + 1 email address');
  });
  it('the preview greets a customer without a name with "there", the sample name only when there is no customer', () => {
    expect(previewValues({ key: 'a@b.com', name: '', email: 'a@b.com', phone: null, orders: [], textOk: false, textReason: 'Email only' }).firstName).toBe('there');
    expect(previewValues(undefined).firstName).toBe('Alex');
  });
});
