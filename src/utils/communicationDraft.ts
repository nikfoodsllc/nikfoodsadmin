import { EMAIL_HTML_LIMIT, EMAIL_LIMIT, SUBJECT_LIMIT, TEXT_LIMIT, type AudienceKind, type EmailFormat } from '@/utils/communication';

/**
 * A message being written in Communication, saved as it is typed so nothing is lost and anyone on the team can carry on.
 * Pure rules shared by the screen and the routes. A draft keeps what was typed and chosen; the list of customers is looked up again
 * (Find customers) when the draft is opened, because customers and orders change.
 */
export interface DraftPerson {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface DraftContent {
  kind: AudienceKind;
  date: string;
  from: string;
  to: string;
  /** "Specific people" */
  people: DraftPerson[];
  /** "Add more customers" under the other choices */
  extra: DraftPerson[];
  email: boolean;
  text: boolean;
  subject: string;
  emailBody: string;
  emailFormat: EmailFormat;
  textBody: string;
  when: 'now' | 'later';
  /** the chosen send time as typed (Pacific, yyyy-mm-ddThh:mm), or '' */
  local: string;
}

export const MAX_DRAFT_PEOPLE = 500;
const KINDS: AudienceKind[] = ['delivery_date', 'menu_day', 'ordered_between', 'people', 'all', 'subscribers'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function people(v: unknown): DraftPerson[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: DraftPerson[] = [];
  for (const p of v) {
    const o = (p ?? {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.toLowerCase() : '';
    if (!OBJECT_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: str(o.name, 120), email: str(o.email, 200), phone: str(o.phone, 40) });
    if (out.length >= MAX_DRAFT_PEOPLE) break;
  }
  return out;
}

/** Cleans whatever the browser sent into a draft the screen can load back. Never throws. */
export function parseDraftContent(input: unknown): DraftContent {
  const b = (input ?? {}) as Record<string, unknown>;
  const kind = KINDS.includes(b.kind as AudienceKind) ? (b.kind as AudienceKind) : 'delivery_date';
  const format: EmailFormat = b.emailFormat === 'html' ? 'html' : 'text';
  return {
    kind,
    date: typeof b.date === 'string' && DAY.test(b.date) ? b.date : '',
    from: typeof b.from === 'string' && DAY.test(b.from) ? b.from : '',
    to: typeof b.to === 'string' && DAY.test(b.to) ? b.to : '',
    people: people(b.people),
    extra: people(b.extra),
    email: b.email !== false,
    text: b.text === true,
    subject: str(b.subject, SUBJECT_LIMIT),
    emailBody: str(b.emailBody, format === 'html' ? EMAIL_HTML_LIMIT : EMAIL_LIMIT),
    emailFormat: format,
    textBody: str(b.textBody, TEXT_LIMIT),
    when: b.when === 'later' ? 'later' : 'now',
    local: typeof b.local === 'string' && LOCAL.test(b.local) ? b.local : '',
  };
}

/** True when there is something worth keeping (a draft is not created for an untouched form). */
export function worthSaving(d: DraftContent): boolean {
  return Boolean(d.subject.trim() || d.emailBody.trim() || d.textBody.trim() || d.people.length || d.extra.length);
}

/** The name shown for a draft in the list. */
export function draftTitle(d: Pick<DraftContent, 'subject' | 'emailBody' | 'textBody'>): string {
  const s = d.subject.trim();
  if (s) return s;
  if (d.emailBody.trim()) return 'Untitled email';
  return d.textBody.trim() ? 'Text message' : 'Untitled message';
}

/** A short preview of the message body (HTML emails lose their tags). */
export function draftPreview(d: Pick<DraftContent, 'emailBody' | 'emailFormat' | 'textBody'>): string {
  const raw = d.emailBody.trim() ? d.emailBody : d.textBody;
  const plain = (d.emailFormat === 'html' && d.emailBody.trim() ? raw.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') : raw).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > 140 ? `${plain.slice(0, 137)}…` : plain;
}
