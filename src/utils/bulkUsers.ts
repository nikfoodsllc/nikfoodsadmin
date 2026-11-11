/**
 * Bulk update in All Users: what can be done to many customers at once, the limits, and the checks on a request.
 * Pure rules, shared by the screen and the route.
 */
export type BulkAction = 'emails_on' | 'emails_off' | 'texts_off' | 'credit_add' | 'deactivate';

export const BULK_ACTIONS: BulkAction[] = ['emails_on', 'emails_off', 'texts_off', 'credit_add', 'deactivate'];

/** Customers handled in one request (the screen sends bigger selections in several requests). */
export const BULK_CHUNK: Record<BulkAction, number> = { emails_on: 200, emails_off: 200, texts_off: 200, credit_add: 25, deactivate: 200 };
/** The most customers one bulk update can name in one go on the screen. */
export const BULK_MAX_CUSTOMERS = 2000;
/** Store credit given to each customer in one bulk update: more than 0, at most this much. */
export const BULK_CREDIT_MAX_EACH = 100;

export const ACTION_LABEL: Record<BulkAction, string> = {
  emails_on: 'Turn emails on (subscribe)',
  emails_off: 'Turn emails off (unsubscribe)',
  texts_off: 'Turn texts off',
  credit_add: 'Give store credit',
  deactivate: 'Deactivate accounts',
};

export const ACTION_HELP: Record<BulkAction, string> = {
  emails_on: 'Puts each customer on the emails list again (and takes them off the unsubscribe list). Use it only for people who asked for emails.',
  emails_off: 'Puts each customer on the unsubscribe list, so no Communication emails go to them. Order emails are never affected.',
  texts_off: 'Stops marketing texts to each customer, the same as if they had replied STOP. Texts cannot be turned back on here: only the customer can agree to texts again.',
  credit_add: 'Adds the same store credit to each customer. A reason is required. The customer sees it in My Orders.',
  deactivate: 'Switches the accounts off: they disappear from All Users and cannot be found here again. Orders already placed are not changed.',
};

export interface BulkRequest {
  action: BulkAction;
  ids: string[];
  /** credit_add: dollars given to each customer */
  amount?: number;
  /** credit_add: why (shown in the credit history) */
  reason?: string;
  /** the same batch id on every request of one bulk update, so a repeated request never gives credit twice */
  batchId?: string;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const BATCH_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Checks a bulk request body; returns what to do or a message for the admin. */
export function parseBulkRequest(input: unknown): { ok: true; request: BulkRequest } | { ok: false; error: string } {
  const b = (input ?? {}) as Record<string, unknown>;
  const action = b.action as BulkAction;
  if (!BULK_ACTIONS.includes(action)) return { ok: false, error: 'Choose what to change.' };
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((v): v is string => typeof v === 'string' && OBJECT_ID.test(v)).map((v) => v.toLowerCase()))] : [];
  if (ids.length === 0) return { ok: false, error: 'Select at least one customer.' };
  if (ids.length > BULK_CHUNK[action]) return { ok: false, error: `Send at most ${BULK_CHUNK[action]} customers at a time.` };
  const request: BulkRequest = { action, ids };
  if (typeof b.batchId === 'string') {
    if (!BATCH_ID.test(b.batchId)) return { ok: false, error: 'Not a valid batch.' };
    request.batchId = b.batchId;
  }
  if (action === 'credit_add') {
    const amount = Math.round(Number(b.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter how much credit to give each customer.' };
    if (amount > BULK_CREDIT_MAX_EACH) return { ok: false, error: `Give at most $${BULK_CREDIT_MAX_EACH} to each customer at once.` };
    const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 200) : '';
    if (!reason) return { ok: false, error: 'Write a reason.' };
    if (!request.batchId) return { ok: false, error: 'Missing batch.' };
    request.amount = amount;
    request.reason = reason;
  }
  return { ok: true, request };
}

/** Splits ids into requests of the allowed size. */
export function chunkIds(ids: string[], action: BulkAction): string[][] {
  const size = BULK_CHUNK[action];
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export type BulkOutcome = 'done' | 'skipped' | 'failed';

export interface BulkResultRow {
  id: string;
  outcome: BulkOutcome;
  /** why it was skipped or failed (no customer details) */
  note?: string;
}

export interface BulkSummary {
  done: number;
  skipped: number;
  failed: number;
  /** how many times each reason came up */
  reasons: Record<string, number>;
}

export function summarize(rows: BulkResultRow[]): BulkSummary {
  const s: BulkSummary = { done: 0, skipped: 0, failed: 0, reasons: {} };
  for (const r of rows) {
    s[r.outcome] += 1;
    if (r.outcome !== 'done' && r.note) s.reasons[r.note] = (s.reasons[r.note] ?? 0) + 1;
  }
  return s;
}

/** The line shown under a finished bulk update. */
export function summaryText(action: BulkAction, s: BulkSummary): string {
  const who = `${s.done} ${s.done === 1 ? 'customer' : 'customers'}`;
  const lead: Record<BulkAction, string> = {
    emails_on: `Emails turned on for ${who}`,
    emails_off: `Emails turned off for ${who}`,
    texts_off: `Texts turned off for ${who}`,
    credit_add: `Store credit given to ${who}`,
    deactivate: `${who} deactivated`,
  };
  const parts = [lead[action]];
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  if (s.failed) parts.push(`${s.failed} failed`);
  return parts.join(', ') + '.';
}
