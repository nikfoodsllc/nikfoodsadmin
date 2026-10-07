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

/** What the email provider reported afterwards (kept on the order by the customer site's webhook). */
export interface EmailDeliveryLike {
  status?: string | null;
  deliveredAt?: string | Date | null;
  bouncedAt?: string | Date | null;
  bounceReason?: string | null;
  firstOpenedAt?: string | Date | null;
  lastOpenedAt?: string | Date | null;
  openCount?: number | null;
  filledFromHistory?: boolean | null;
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

export function orderEmailStatusView(info: EmailStatusLike | null | undefined, delivery?: EmailDeliveryLike | null): EmailStatusView {
  const status = typeof info?.status === 'string' ? info.status.trim().toLowerCase() : '';
  if (!info || !status) return NONE;
  const attempts = typeof info.attempts === 'number' && info.attempts > 0 ? info.attempts : 0;
  const at = when(info.lastAttempt);
  const tries = attempts > 1 ? `${attempts} tries` : '';
  if (status === 'sent' && delivery) {
    const reported = deliveryView(delivery, at);
    if (reported) return reported;
  }
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

/**
 * Once the email was sent, what Resend reported: Bounced / Spam (red), Delayed (amber), Opened (green, with the time of the last
 * open and how many times), Delivered (green, with the time). null when it reported nothing we show (the email stays 'Sent').
 */
function deliveryView(delivery: EmailDeliveryLike, sentAt: string): EmailStatusView | null {
  const state = typeof delivery.status === 'string' ? delivery.status.trim().toLowerCase() : '';
  const opens = typeof delivery.openCount === 'number' && delivery.openCount > 0 ? delivery.openCount : 0;
  if (state === 'bounced') {
    const reason = (delivery.bounceReason ?? '').trim();
    return { label: 'Bounced', tone: 'bad', detail: when(delivery.bouncedAt), title: `The email bounced${reason ? `: ${reason}` : ''}. The customer did not get it.` };
  }
  if (state === 'complained') {
    return { label: 'Spam', tone: 'bad', detail: sentAt, title: "The customer's mail provider marked the email as spam" };
  }
  if (state === 'failed') {
    return { label: 'Failed', tone: 'bad', detail: sentAt, title: 'The email provider could not deliver the email' };
  }
  if (state === 'delayed') {
    return { label: 'Delayed', tone: 'warn', detail: sentAt, title: 'The email is delayed: the customer’s mail server has not accepted it yet' };
  }
  if (opens > 0) {
    const last = when(delivery.lastOpenedAt);
    const count = opens > 1 ? `${opens}×` : '';
    return {
      label: 'Opened',
      tone: 'good',
      detail: [last, count].filter(Boolean).join(' · '),
      title: `The email was opened${opens > 1 ? ` ${opens} times` : ''}${last ? `, last ${last} (Pacific)` : ''}. An open is only a hint: some mail apps load the email on their own, and the support copy can be opened by the team.`,
    };
  }
  if (state === 'delivered') {
    const at = when(delivery.deliveredAt);
    return { label: 'Delivered', tone: 'good', detail: at || sentAt, title: `The email reached the customer's mail server${at ? ` ${at} (Pacific)` : ''}. Not opened yet, as far as we know.` };
  }
  return null;
}
