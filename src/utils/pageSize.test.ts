import { describe, expect, it } from 'vitest';
import { ALL_RECORDS_LIMIT, DEFAULT_PAGE_SIZE, pageSizeToLimit, parsePageSize, rangeText, totalPagesFor } from './pageSize';

describe('page size', () => {
  it('defaults to 100', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(100);
    expect(parsePageSize(null)).toBe(100);
    expect(parsePageSize(undefined)).toBe(100);
    expect(parsePageSize('7')).toBe(100);
    expect(parsePageSize('garbage')).toBe(100);
  });

  it('accepts the four choices (as text or number)', () => {
    expect(parsePageSize('10')).toBe(10);
    expect(parsePageSize(50)).toBe(50);
    expect(parsePageSize('100')).toBe(100);
    expect(parsePageSize('all')).toBe('all');
  });

  it('turns a choice into the limit sent to the API', () => {
    expect(pageSizeToLimit(10)).toBe(10);
    expect(pageSizeToLimit('all')).toBe(ALL_RECORDS_LIMIT);
  });

  it('counts pages, always at least one', () => {
    expect(totalPagesFor(0, 100)).toBe(1);
    expect(totalPagesFor(101, 100)).toBe(2);
    expect(totalPagesFor(370, 50)).toBe(8);
    expect(totalPagesFor(5000, 'all')).toBe(1);
  });

  it('shows the range', () => {
    expect(rangeText(1, 100, 370)).toBe('1–100 of 370');
    expect(rangeText(4, 100, 370)).toBe('301–370 of 370');
    expect(rangeText(1, 'all', 5310)).toBe('1–5,310 of 5,310');
    expect(rangeText(1, 100, 0)).toBe('0 records');
  });
});
