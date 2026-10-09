/**
 * What the admin sees about a customer's text-message agreement. The customer site stores it on the user (smsConsent) and,
 * for people who signed up on the public Text Updates page, in a record per phone number (smsSubscribers).
 */
export interface SmsConsentRecord {
  optedIn?: boolean;
  phone?: string;
  optedInAt?: Date | string | null;
  source?: string;
  version?: string;
  optedOutAt?: Date | string | null;
  optedOutVia?: string;
}

export interface SmsSubscriberRecord {
  phone?: string;
  optedIn?: boolean;
  optedInAt?: Date | string | null;
  optedOutAt?: Date | string | null;
  version?: string;
}

export type SmsStatus = 'agreed' | 'stopped' | 'never';

export interface SmsConsentView {
  status: SmsStatus;
  /** 10 digits: the only number texts are sent to */
  phone: string | null;
  /** When the customer agreed (or last agreed) */
  agreedAt: Date | null;
  /** Where they agreed, in words */
  agreedHow: string;
  /** The wording version they saw */
  version: string | null;
  stoppedAt: Date | null;
  stoppedHow: string;
}

const SOURCE_WORDS: Record<string, string> = {
  checkout: 'Checkout box',
  profile: 'My Account',
  text_reply: 'Replied START by text',
  public_form: 'Text Updates sign-up page',
};

const STOP_WORDS: Record<string, string> = {
  profile: 'Turned off in My Account',
  checkout: 'Turned off at checkout',
  text_reply: 'Replied STOP by text',
};

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function digits(value: unknown): string | null {
  const d = String(value ?? '').replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return /^\d{10}$/.test(ten) ? ten : null;
}

/**
 * Agreed = the customer ticked a box (or signed up on the public page for the number on their profile) and has not stopped.
 * Stopped = they agreed once and then withdrew. Never = nothing on record.
 */
export function smsConsentView(consent: SmsConsentRecord | null | undefined, subscriber: SmsSubscriberRecord | null | undefined, profilePhone?: unknown): SmsConsentView {
  const phone = digits(consent?.phone) ?? digits(subscriber?.phone) ?? digits(profilePhone);
  const own = consent?.optedIn ? consent : null;
  const sub = subscriber?.optedIn ? subscriber : null;
  if (own || sub) {
    const source = own ? own.source ?? '' : 'public_form';
    return {
      status: 'agreed',
      phone: own ? digits(own.phone) ?? phone : digits(sub?.phone) ?? phone,
      agreedAt: asDate(own ? own.optedInAt : sub?.optedInAt),
      agreedHow: SOURCE_WORDS[source] ?? (source || 'Unknown'),
      version: (own ? own.version : sub?.version) ?? null,
      stoppedAt: null,
      stoppedHow: '',
    };
  }
  const stoppedAt = asDate(consent?.optedOutAt) ?? asDate(subscriber?.optedOutAt);
  const everAgreed = Boolean(consent?.optedInAt || consent?.optedOutAt || subscriber?.optedInAt);
  if (everAgreed || stoppedAt) {
    const via = consent?.optedOutVia ?? (subscriber?.optedOutAt ? 'text_reply' : '');
    return {
      status: 'stopped',
      phone,
      agreedAt: asDate(consent?.optedInAt) ?? asDate(subscriber?.optedInAt),
      agreedHow: SOURCE_WORDS[consent?.source ?? (subscriber ? 'public_form' : '')] ?? '',
      version: consent?.version ?? subscriber?.version ?? null,
      stoppedAt,
      stoppedHow: STOP_WORDS[via] ?? 'Stopped',
    };
  }
  return { status: 'never', phone, agreedAt: null, agreedHow: '', version: null, stoppedAt: null, stoppedHow: '' };
}
