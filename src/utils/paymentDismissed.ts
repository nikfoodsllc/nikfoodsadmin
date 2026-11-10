/**
 * The iPhone app tells the server when a customer closes the payment screen without paying (stage 'dismissed'). It is not an error, so the
 * order details show it on its own line, apart from the real errors.
 */
export const DISMISSED_STAGE = 'dismissed';

interface ReportLike {
  stage: string;
  at: Date | string;
}

export function splitClientReports<T extends ReportLike>(reports: T[] | undefined): { errors: T[]; dismissed: { count: number; lastAt: Date | string } | null } {
  const list = reports ?? [];
  const closed = list.filter((r) => r.stage === DISMISSED_STAGE);
  const errors = list.filter((r) => r.stage !== DISMISSED_STAGE);
  if (closed.length === 0) return { errors, dismissed: null };
  const last = closed.reduce((a, b) => (new Date(b.at).getTime() > new Date(a.at).getTime() ? b : a));
  return { errors, dismissed: { count: closed.length, lastAt: last.at } };
}

/** 'Closed the payment screen without paying (2 times, last Nov 9, 6:50 PM)' */
export function dismissedText(d: { count: number; lastAt: Date | string }): string {
  const when = new Date(d.lastAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
  return d.count > 1 ? `Closed the payment screen without paying (${d.count} times, last ${when} PT)` : `Closed the payment screen without paying (${when} PT)`;
}
