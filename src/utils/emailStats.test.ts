import { describe, expect, it } from 'vitest';
import { csvCell, emailStats, filterCounts, matchesFilter, percent, recipientsCsv, type StatRecipient } from './emailStats';

const r = (o: Partial<StatRecipient>): StatRecipient => ({ name: 'A', channel: 'email', status: 'delivered', openCount: 0, ...o });

describe('emailStats', () => {
  it('computes the rates from the status counts', () => {
    const s = emailStats({ delivered: 118, bounced: 2, delayed: 0, queued: 0 }, 46);
    expect(s).toMatchObject({ sent: 120, delivered: 118, opened: 46, bounced: 2, openRate: 39, deliveryRate: 98, problemRate: 2 });
  });
  it('is all zero and never divides by zero for an empty message', () => {
    const s = emailStats(undefined, undefined);
    expect(s).toMatchObject({ sent: 0, delivered: 0, opened: 0, openRate: 0, deliveryRate: 0, problemRate: 0 });
  });
  it('counts delayed and sent-but-not-delivered as sent, and waiting separately', () => {
    const s = emailStats({ sent: 3, delayed: 1, delivered: 2, queued: 4, sending: 1, skipped: 2, failed: 1 }, 1);
    expect(s).toMatchObject({ sent: 6, waiting: 5, skipped: 2, failed: 1 });
  });
  it('never shows more opens than deliveries (an open can only follow a delivery)', () => {
    expect(emailStats({ delivered: 2 }, 5).opened).toBe(2);
    expect(emailStats({ delivered: 2 }, 5).openRate).toBe(100);
  });
  it('counts opens even before the delivery event arrives', () => {
    const s = emailStats({ sent: 2 }, 1);
    expect(s.opened).toBe(1);
  });
  it('rounds percentages', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });
});

describe('filters', () => {
  const rows = [r({ openCount: 2 }), r({ status: 'sent' }), r({ status: 'bounced' }), r({ status: 'complained', openCount: 0 }), r({ status: 'queued' }), r({ status: 'skipped' }), r({ status: 'failed' })];
  it('splits opened, not opened and problems', () => {
    expect(filterCounts(rows)).toEqual({ all: 7, opened: 1, not_opened: 1, problems: 3 });
    expect(matchesFilter(rows[0], 'opened')).toBe(true);
    expect(matchesFilter(rows[2], 'not_opened')).toBe(false);
    expect(matchesFilter(rows[2], 'problems')).toBe(true);
  });
  it('a customer who opened and later complained still counts as opened and as a problem', () => {
    const x = r({ status: 'complained', openCount: 1 });
    expect(matchesFilter(x, 'opened')).toBe(true);
    expect(matchesFilter(x, 'problems')).toBe(true);
    expect(matchesFilter(x, 'not_opened')).toBe(false);
  });
});

describe('CSV', () => {
  it('quotes commas and quotes, and defuses formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(5)).toBe('5');
    expect(csvCell(undefined)).toBe('');
  });
  it('writes a header, a BOM and one row per customer', () => {
    const csv = recipientsCsv([r({ name: 'Priya, S', email: 'p@x.test', openCount: 2, firstOpenedAt: '2026-11-10T20:00:00Z' })], (iso) => (iso ? 'Nov 10' : ''));
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('Name,Email,Status,Opened,Times opened,First opened (Pacific),Delivered (Pacific),Note');
    expect(lines[1]).toBe('"Priya, S",p@x.test,delivered,Yes,2,Nov 10,,');
  });
});
