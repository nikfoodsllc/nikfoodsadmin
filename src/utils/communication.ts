/**
 * Communication tab: the pure helpers behind the screen (labels, counts, the Pacific time of a scheduled send).
 * The server (customer site) decides who gets what; nothing here sends anything.
 */

export type AudienceKind = 'delivery_date' | 'menu_day' | 'ordered_between' | 'people' | 'all' | 'subscribers';

export interface AudienceFilter {
  kind: AudienceKind;
  date?: string;
  from?: string;
  to?: string;
  /** people: the accounts picked by hand */
  userIds?: string[];
  /** every other choice: accounts added by hand on top of the filter (they get the message whatever the filter finds) */
  alsoUserIds?: string[];
}

export interface AudienceCustomer {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  orders: string[];
  textOk: boolean;
  textReason: string | null;
  /** on the unsubscribe list: no emails are sent to this customer */
  unsubscribed?: boolean;
  /** added by hand on top of the filter */
  added?: boolean;
}

export const TEXT_LIMIT = 320;
export const SUBJECT_LIMIT = 150;
export const EMAIL_LIMIT = 5000;
/** A custom HTML email: Gmail cuts a message off at about 102 KB */
export const EMAIL_HTML_LIMIT = 90_000;
export type EmailFormat = 'text' | 'html';
export const PLACEHOLDERS = ['{firstName}', '{orderNumber}', '{date}'] as const;

/** Which placeholders make sense for a choice: {orderNumber} needs orders, {date} needs one day. */
export function placeholdersFor(kind: AudienceKind): string[] {
  if (kind === 'delivery_date' || kind === 'menu_day') return [...PLACEHOLDERS];
  if (kind === 'ordered_between') return ['{firstName}', '{orderNumber}'];
  return ['{firstName}'];
}

const dayLong = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function audienceTitle(f: AudienceFilter): string {
  const more = f.kind !== 'people' && (f.alsoUserIds?.length ?? 0) > 0 ? ` + ${f.alsoUserIds?.length} added` : '';
  return `${baseAudienceTitle(f)}${more}`;
}

function baseAudienceTitle(f: AudienceFilter): string {
  if (f.kind === 'all') return 'Everyone';
  if (f.kind === 'subscribers') return 'Agreed to get emails';
  if (f.kind === 'people') return `${f.userIds?.length ?? 0} chosen ${(f.userIds?.length ?? 0) === 1 ? 'person' : 'people'}`;
  if (f.kind === 'delivery_date' && f.date) return `Due for delivery ${dayLong(f.date)}`;
  if (f.kind === 'menu_day' && f.date) return `Ordered for the ${dayLong(f.date)} menu`;
  if (f.kind === 'ordered_between' && f.from && f.to) return f.from === f.to ? `Ordered on ${dayLong(f.from)}` : `Ordered ${dayLong(f.from)} to ${dayLong(f.to)}`;
  return 'Customers';
}

/** True when the filter has what it needs (real days, start not after end). */
export function filterReady(f: AudienceFilter): boolean {
  const real = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));
  if (f.kind === 'all' || f.kind === 'subscribers') return true;
  if (f.kind === 'people') return (f.userIds?.length ?? 0) > 0;
  if (f.kind === 'ordered_between') return real(f.from) && real(f.to) && (f.from as string) <= (f.to as string);
  return real(f.date);
}

/** Today in Pacific time, YYYY-MM-DD. */
export function pacificToday(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The instant for a time typed in the schedule box ('2026-11-08T09:30', read as Pacific time, whatever zone the browser is in).
 * Returns null for something that is not a time.
 */
export function pacificLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  for (const offset of ['-07:00', '-08:00']) {
    const candidate = new Date(`${y}-${mo}-${d}T${h}:${mi}:00${offset}`);
    if (Number.isNaN(candidate.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(candidate);
    const g = (t: string) => parts.find((p) => p.type === t)?.value;
    if (`${g('year')}-${g('month')}-${g('day')}T${String(Number(g('hour')) % 24).padStart(2, '0')}:${g('minute')}` === local) return candidate.toISOString();
  }
  return null;
}

/** 'Sat, Nov 7 at 9:30 AM' (Pacific). */
export function pacificText(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
  return `${day} at ${time}`;
}

/** The hour (0 to 23) in Pacific time of an instant. */
export function pacificHourOf(iso: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(new Date(iso))) % 24;
}

/** Texts leave only between 8 AM and 9 PM Pacific. */
export function textTimeOk(iso: string): boolean {
  const h = pacificHourOf(iso);
  return h >= 8 && h < 21;
}

// ---------------------------------------------------------------------------------------------------------------
// Who is picked

export interface Reach {
  customers: number;
  email: number;
  noEmail: number;
  text: number;
  noText: number;
}

export function reachOf(customers: AudienceCustomer[], picked: Set<string>): Reach {
  const chosen = customers.filter((c) => picked.has(c.key));
  const email = chosen.filter((c) => c.email && !c.unsubscribed).length;
  const text = chosen.filter((c) => c.textOk).length;
  return { customers: chosen.length, email, noEmail: chosen.length - email, text, noText: chosen.length - text };
}

/** Message counts for a card in History: what was sent, what went wrong, what is still waiting. */
export function countLine(counts: Record<string, number> | undefined): string {
  const c = counts ?? {};
  const sent = (c.sent ?? 0) + (c.delivered ?? 0) + (c.delayed ?? 0);
  const problems = (c.bounced ?? 0) + (c.complained ?? 0) + (c.failed ?? 0);
  const waiting = (c.queued ?? 0) + (c.sending ?? 0);
  const parts = [`${sent} sent`];
  if (c.delivered) parts.push(`${c.delivered} delivered`);
  if (problems) parts.push(`${problems} failed`);
  if (waiting) parts.push(`${waiting} waiting`);
  if (c.skipped) parts.push(`${c.skipped} skipped`);
  return parts.join(' · ');
}

export function totalOf(counts: Record<string, number> | undefined): number {
  return Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
}

/** Adds a placeholder at the end of the text with a space in between when needed. */
export function withPlaceholder(text: string, placeholder: string): string {
  if (!text) return placeholder;
  return /\s$/.test(text) ? `${text}${placeholder}` : `${text} ${placeholder}`;
}

/** A sample of what one customer gets, for the preview (the first customer picked, else a made-up one). */
export function previewValues(first?: AudienceCustomer, filter?: AudienceFilter): { firstName: string; orderNumber: string; date: string } {
  const firstName = (first?.name ?? '').trim().split(/\s+/)[0] || 'Alex';
  return { firstName, orderNumber: (first?.orders?.[0] ?? 'ORD-0000000000000').replace(/^#/, ''), date: filter?.date ? new Date(`${filter.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '' };
}

export function fillPlaceholders(text: string, v: { firstName: string; orderNumber: string; date: string }): string {
  return text.replace(/\{firstName\}/g, v.firstName).replace(/\{orderNumber\}/g, v.orderNumber).replace(/\{date\}/g, v.date);
}

/** When a message goes out or went out: 'Goes out ...', 'Was scheduled for ...' (stopped before it started), 'Started ...'. */
export function whenText(c: { status: string; scheduledFor?: string; startedAt?: string }): string {
  if (c.status === 'scheduled' && c.scheduledFor) return `Goes out ${pacificText(c.scheduledFor)}`;
  if (!c.startedAt && c.scheduledFor) return `Was scheduled for ${pacificText(c.scheduledFor)}`;
  return c.startedAt ? `Started ${pacificText(c.startedAt)}` : '';
}

/** What may not be in a custom HTML email (the server refuses the same things). Null when it is fine. */
export function htmlProblem(html: string): string | null {
  const tag = html.match(/<\s*(script|iframe|object|embed|form|input|button|textarea|select|link|base)\b/i);
  if (tag) return `Remove the <${tag[1].toLowerCase()}> tag: email apps do not allow it.`;
  if (/\son[a-z]+\s*=/i.test(html)) return 'Remove the onclick-style attributes (onclick, onload, ...): email apps do not allow them.';
  if (/javascript\s*:/i.test(html)) return 'Remove the javascript: link: email apps do not allow it.';
  return null;
}

/** The logo the emails attach as cid:nikfoods-logo; the preview cannot attach, so it loads the same picture from the site. */
export const PREVIEW_LOGO_URL = 'https://www.nikfoods.com/images/logo.png';
/** The App Store badge the emails attach as cid:app-store-badge; the preview loads the same picture from the site. */
export const PREVIEW_BADGE_URL = 'https://www.nikfoods.com/images/app-store-badge.png';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The page shown in the preview frame: placeholders filled (escaped, like the real send), logo and App Store badge from the site, wrapped when it is a snippet. */
export function previewHtml(html: string, v: { firstName: string; orderNumber: string; date: string }): string {
  const filled = html
    .replace(/\{firstName\}/g, esc(v.firstName))
    .replace(/\{orderNumber\}/g, esc(v.orderNumber))
    .replace(/\{date\}/g, v.date)
    .replace(/\{unsubscribeUrl\}/g, '#')
    .replace(/cid:nikfoods-logo/g, PREVIEW_LOGO_URL)
    .replace(/cid:app-store-badge/g, PREVIEW_BADGE_URL);
  return /<html[\s>]/i.test(filled) ? filled : `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;">${filled}</body></html>`;
}
