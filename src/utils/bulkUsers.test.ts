import { describe, expect, it } from 'vitest';
import { BULK_CHUNK, BULK_CREDIT_MAX_EACH, chunkIds, parseBulkRequest, summarize, summaryText } from './bulkUsers';

const id = (n: number) => n.toString(16).padStart(24, '0');

describe('parseBulkRequest', () => {
  it('accepts a simple action and removes duplicates and bad ids', () => {
    const r = parseBulkRequest({ action: 'emails_off', ids: [id(1), id(1), 'nope', 5, id(2).toUpperCase()] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.ids).toEqual([id(1), id(2)]);
  });
  it('refuses an unknown action, no ids and too many ids', () => {
    expect(parseBulkRequest({ action: 'delete_everyone', ids: [id(1)] }).ok).toBe(false);
    expect(parseBulkRequest({ action: 'texts_off', ids: [] }).ok).toBe(false);
    expect(parseBulkRequest({ action: 'credit_add', amount: 5, reason: 'x', batchId: 'batch12345', ids: Array.from({ length: BULK_CHUNK.credit_add + 1 }, (_, i) => id(i + 1)) }).ok).toBe(false);
  });
  it('store credit needs a positive amount within the limit, a reason and a batch id', () => {
    const base = { action: 'credit_add', ids: [id(1)], batchId: 'batch12345' };
    expect(parseBulkRequest({ ...base, amount: 5, reason: 'Sorry about the late delivery' }).ok).toBe(true);
    expect(parseBulkRequest({ ...base, amount: 0, reason: 'x' }).ok).toBe(false);
    expect(parseBulkRequest({ ...base, amount: -5, reason: 'x' }).ok).toBe(false);
    expect(parseBulkRequest({ ...base, amount: BULK_CREDIT_MAX_EACH + 1, reason: 'x' }).ok).toBe(false);
    expect(parseBulkRequest({ ...base, amount: 5, reason: '   ' }).ok).toBe(false);
    expect(parseBulkRequest({ action: 'credit_add', ids: [id(1)], amount: 5, reason: 'x' }).ok).toBe(false);
    expect(parseBulkRequest({ ...base, amount: 'abc', reason: 'x' }).ok).toBe(false);
  });
  it('rounds the credit to cents', () => {
    const r = parseBulkRequest({ action: 'credit_add', ids: [id(1)], batchId: 'batch12345', amount: 5.004, reason: 'x' });
    expect(r.ok && r.request.amount).toBe(5);
  });
  it('rejects a malformed batch id', () => {
    expect(parseBulkRequest({ action: 'emails_on', ids: [id(1)], batchId: 'a b' }).ok).toBe(false);
  });
});

describe('chunkIds and summary', () => {
  it('splits by the size of the action', () => {
    const ids = Array.from({ length: 60 }, (_, i) => id(i + 1));
    expect(chunkIds(ids, 'credit_add').map((c) => c.length)).toEqual([25, 25, 10]);
    expect(chunkIds(ids, 'emails_on').map((c) => c.length)).toEqual([60]);
  });
  it('counts outcomes and reasons', () => {
    const s = summarize([{ id: '1', outcome: 'done' }, { id: '2', outcome: 'skipped', note: 'No email address' }, { id: '3', outcome: 'skipped', note: 'No email address' }, { id: '4', outcome: 'failed', note: 'Could not save' }]);
    expect(s).toEqual({ done: 1, skipped: 2, failed: 1, reasons: { 'No email address': 2, 'Could not save': 1 } });
    expect(summaryText('emails_off', s)).toBe('Emails turned off for 1 customer, 2 skipped, 1 failed.');
    expect(summaryText('credit_add', { done: 3, skipped: 0, failed: 0, reasons: {} })).toBe('Store credit given to 3 customers.');
    expect(summaryText('deactivate', { done: 1, skipped: 0, failed: 0, reasons: {} })).toBe('1 customer deactivated.');
    expect(summaryText('texts_off', { done: 2, skipped: 1, failed: 0, reasons: {} })).toBe('Texts turned off for 2 customers, 1 skipped.');
  });
});
