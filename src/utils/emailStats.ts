/**
 * Delivery and open numbers for the emails sent from Communication: the summary on each History card, the filter in the detail view and
 * its CSV. Pure rules. An "open" is only a hint (some mail apps open messages by themselves), and clicks are not tracked.
 */

export interface EmailStats {
  /** emails that left us (sent, delivered, delayed, bounced or marked as spam) */
  sent: number;
  delivered: number;
  /** customers who opened at least once */
  opened: number;
  bounced: number;
  complained: number;
  /** we could not send (before it reached the mail provider) */
  failed: number;
  /** still going out */
  waiting: number;
  skipped: number;
  /** percent of delivered that opened (0 when nothing was delivered) */
  openRate: number;
  /** percent of sent that were delivered */
  deliveryRate: number;
  /** percent of sent that bounced or were marked as spam */
  problemRate: number;
}

export function percent(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function emailStats(counts: Record<string, number> | undefined, opened: number | undefined): EmailStats {
  const c = counts ?? {};
  const delivered = c.delivered ?? 0;
  const bounced = c.bounced ?? 0;
  const complained = c.complained ?? 0;
  const sent = (c.sent ?? 0) + delivered + (c.delayed ?? 0) + bounced + complained;
  const open = Math.min(Math.max(opened ?? 0, 0), delivered || Math.max(opened ?? 0, 0));
  return {
    sent,
    delivered,
    opened: open,
    bounced,
    complained,
    failed: c.failed ?? 0,
    waiting: (c.queued ?? 0) + (c.sending ?? 0),
    skipped: c.skipped ?? 0,
    openRate: percent(open, delivered),
    deliveryRate: percent(delivered, sent),
    problemRate: percent(bounced + complained, sent),
  };
}

export interface StatRecipient {
  name: string;
  channel: 'email' | 'text';
  email?: string;
  status: string;
  error?: string;
  reason?: string;
  deliveredAt?: string;
  firstOpenedAt?: string;
  openCount: number;
}

export type RecipientFilter = 'all' | 'opened' | 'not_opened' | 'problems';

export const FILTER_LABEL: Record<RecipientFilter, string> = { all: 'All', opened: 'Opened', not_opened: 'Not opened', problems: 'Bounced / problems' };

const PROBLEM = new Set(['bounced', 'complained', 'failed']);

export function matchesFilter(r: StatRecipient, f: RecipientFilter): boolean {
  if (f === 'all') return true;
  if (f === 'opened') return r.openCount > 0;
  if (f === 'problems') return PROBLEM.has(r.status);
  // not opened: it reached them (or at least left us) and there is no open yet
  return r.openCount === 0 && !PROBLEM.has(r.status) && r.status !== 'skipped' && r.status !== 'queued';
}

export function filterCounts(rows: StatRecipient[]): Record<RecipientFilter, number> {
  const out: Record<RecipientFilter, number> = { all: rows.length, opened: 0, not_opened: 0, problems: 0 };
  for (const r of rows) {
    if (matchesFilter(r, 'opened')) out.opened += 1;
    if (matchesFilter(r, 'not_opened')) out.not_opened += 1;
    if (matchesFilter(r, 'problems')) out.problems += 1;
  }
  return out;
}

/** A cell that spreadsheets will not run as a formula, quoted when needed. */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The CSV of a recipient list (BOM first so Excel reads accents; dates already formatted by the caller). */
export function recipientsCsv(rows: StatRecipient[], when: (iso?: string) => string): string {
  const header = ['Name', 'Email', 'Status', 'Opened', 'Times opened', 'First opened (Pacific)', 'Delivered (Pacific)', 'Note'];
  const lines = rows.map((r) => [r.name, r.email ?? '', r.status, r.openCount > 0 ? 'Yes' : 'No', r.openCount, when(r.firstOpenedAt), when(r.deliveredAt), r.error || r.reason || ''].map(csvCell).join(','));
  return '﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}
