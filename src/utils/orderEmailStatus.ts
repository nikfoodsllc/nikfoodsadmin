/**
 * What the Orders table shows for the order confirmation email: a short label with a tone (green sent, red failed,
 * amber still on its way), and a detail line (when it was sent, or the error). Orders with no record (an unpaid order,
 * an order from before the email was tracked) show a dash.
 */
export interface EmailStatusLike {
  status?: string | null;
  attempts?: number | null;
  lastAttempt?: string | Date | null;
  error?: string | null;
}

export type EmailTone = 'good' | 'bad' | 'warn' | 'none';

export interface EmailStatusView {
  label: string;
  tone: EmailTone;
  /** A second line under the label: when it was sent, how many tries, or the error */
  detail: string;
  /** The full text for a tooltip (the whole error, for example) */
  title: string;
}

const NONE: EmailStatusView = { label: '-', tone: 'none', detail: '', title: 'No confirmation email has been sent for this order' };

function when(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
}

export function orderEmailStatusView(info: EmailStatusLike | null | undefined): EmailStatusView {
  const status = typeof info?.status === 'string' ? info.status.trim().toLowerCase() : '';
  if (!info || !status) return NONE;
  const attempts = typeof info.attempts === 'number' && info.attempts > 0 ? info.attempts : 0;
  const at = when(info.lastAttempt);
  const tries = attempts > 1 ? `${attempts} tries` : '';
  if (status === 'sent') {
    return { label: 'Sent', tone: 'good', detail: [at, tries].filter(Boolean).join(' · '), title: `Confirmation email sent${at ? ` ${at} (Pacific)` : ''}${tries ? `, after ${attempts} tries` : ''}` };
  }
  if (status === 'failed') {
    const error = (info.error ?? '').trim();
    return { label: 'Failed', tone: 'bad', detail: [tries, at].filter(Boolean).join(' · '), title: `Confirmation email failed${error ? `: ${error}` : ''}` };
  }
  if (status === 'retrying') {
    return { label: 'Retrying', tone: 'warn', detail: [tries, at].filter(Boolean).join(' · '), title: `The confirmation email failed and is being tried again${info.error ? `: ${info.error}` : ''}` };
  }
  if (status === 'pending') {
    return { label: 'Pending', tone: 'warn', detail: at, title: 'The confirmation email is on its way' };
  }
  // an unknown word: show it as is rather than hide it
  return { label: status.charAt(0).toUpperCase() + status.slice(1), tone: 'warn', detail: at, title: `Confirmation email status: ${status}` };
}
