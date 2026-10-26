import { describe, expect, it } from 'vitest';
import { parseTextFilter, parseUserSort, textFilterClause, userSortSpec } from './userFilters';

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
