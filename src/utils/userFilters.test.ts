import { describe, expect, it } from 'vitest';
import { emailFilterClause, emailStatusFor, parseEmailFilter, parseTextFilter, parseUserSort, textFilterClause, userSortSpec } from './userFilters';

const none = { agreed: [], stopped: [] };

describe('userFilters', () => {
  it('ignores unknown values', () => {
    expect(parseTextFilter('x')).toBe('all');
    expect(parseTextFilter('agreed')).toBe('agreed');
    expect(parseUserSort('zzz')).toBe('newest');
    expect(parseUserSort('name_asc')).toBe('name_asc');
  });

  it('has no condition for all', () => {
    expect(textFilterClause('all', none)).toBeNull();
  });

  it('agreed = own box or public sign-up phone', () => {
    expect(textFilterClause('agreed', none)).toEqual({ $or: [{ 'smsConsent.optedIn': true }] });
    expect(textFilterClause('agreed', { agreed: ['2065550100'], stopped: [] })).toEqual({
      $or: [{ 'smsConsent.optedIn': true }, { phone: { $in: ['2065550100'] } }],
    });
  });

  it('stopped and never exclude the agreed ones', () => {
    const stopped = textFilterClause('stopped', { agreed: ['1'], stopped: ['2'] }) as { $and: unknown[] };
    expect(JSON.stringify(stopped.$and[0])).toContain('$nor');
    expect(JSON.stringify(stopped.$and[1])).toContain('"2"');
    const never = textFilterClause('never', none) as { $and: unknown[] };
    expect(never.$and).toHaveLength(2);
  });

  it('sorts newest first by default with stable ties', () => {
    expect(userSortSpec('newest')).toEqual({ createdAt: -1, _id: -1 });
    expect(userSortSpec('name_desc')).toEqual({ name: -1, _id: 1 });
  });
});

describe('email choice', () => {
  const lists = { agreedEmails: new Set(['a@x.com', 'b@x.com']), agreedIds: new Set(['id3']), stoppedEmails: new Set(['b@x.com']) };
  it('parses the filter', () => {
    expect(parseEmailFilter('agreed')).toBe('agreed');
    expect(parseEmailFilter('nope')).toBe('all');
  });
  it('stopped wins over agreed, agreed by email or account, else never', () => {
    expect(emailStatusFor({ _id: 'id1', email: 'A@X.com ' }, lists)).toBe('agreed');
    expect(emailStatusFor({ _id: 'id2', email: 'b@x.com' }, lists)).toBe('stopped');
    expect(emailStatusFor({ _id: 'id3', email: 'c@x.com' }, lists)).toBe('agreed');
    expect(emailStatusFor({ _id: 'id4', email: 'd@x.com' }, lists)).toBe('never');
    expect(emailStatusFor({ _id: 'id5' }, lists)).toBe('never');
  });
  it('builds the conditions', () => {
    const arr = { agreedEmails: ['a@x.com'], agreedIds: ['id3'], stoppedEmails: ['b@x.com'] };
    const id = (v: string) => `oid:${v}`;
    expect(emailFilterClause('all', arr, id)).toBeNull();
    expect(emailFilterClause('stopped', arr, id)).toEqual({ email: { $in: ['b@x.com'] } });
    expect(emailFilterClause('agreed', arr, id)).toEqual({ $and: [{ $or: [{ email: { $in: ['a@x.com'] } }, { _id: { $in: ['oid:id3'] } }] }, { email: { $nin: ['b@x.com'] } }] });
    expect(emailFilterClause('never', arr, id)).toEqual({ $and: [{ $nor: [{ email: { $in: ['a@x.com'] } }, { _id: { $in: ['oid:id3'] } }] }, { email: { $nin: ['b@x.com'] } }] });
  });
});
