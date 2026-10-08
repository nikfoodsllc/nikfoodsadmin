import { describe, expect, it } from 'vitest';
import { addDays, isDateKey, isTodayOrLater, kitchenWeekStart, lockedItemPlacement, weekdayIndex } from './lockedMenu';

// Oct 8 2026 is a Thursday, Oct 9 a Friday
const thuFri = [{ day: '2026-10-08', sequence: 3 }, { day: '2026-10-09', sequence: 5 }];

describe('helpers', () => {
  it('weekday and date maths', () => {
    expect(weekdayIndex('2026-10-08')).toBe(4);
    expect(weekdayIndex('2026-10-09')).toBe(5);
    expect(addDays('2026-10-09', 7)).toBe('2026-10-16');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('kitchen weeks run Saturday to Friday', () => {
    expect(kitchenWeekStart('2026-10-08')).toBe('2026-10-03'); // Thursday -> Saturday before
    expect(kitchenWeekStart('2026-10-03')).toBe('2026-10-03'); // Saturday
    expect(kitchenWeekStart('2026-10-09')).toBe('2026-10-03'); // Friday
    expect(kitchenWeekStart('2026-10-10')).toBe('2026-10-10');
    expect(kitchenWeekStart('2026-10-11')).toBe('2026-10-10'); // Sunday
  });
  it('date keys', () => {
    expect(isDateKey('2026-10-08')).toBe(true);
    expect(isDateKey('Thursday')).toBe(false);
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});

describe('lockedItemPlacement', () => {
  it('Thursday and Friday carry to the next Thursday and Friday, keeping the position', () => {
    expect(lockedItemPlacement('2026-10-15', thuFri)).toEqual({ sequence: 3 });
    expect(lockedItemPlacement('2026-10-16', thuFri)).toEqual({ sequence: 5 });
  });
  it('other weekdays get nothing', () => {
    for (const d of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-17', '2026-10-18']) expect(lockedItemPlacement(d, thuFri)).toBeNull();
  });
  it('works two weeks ahead too (the pattern is the last week it was on)', () => {
    expect(lockedItemPlacement('2026-10-22', thuFri)).toEqual({ sequence: 3 });
    expect(lockedItemPlacement('2026-10-23', thuFri)).toEqual({ sequence: 5 });
  });
  it('follows the most recent week when the pattern changed', () => {
    const changed = [...thuFri, { day: '2026-10-15', sequence: 1 }]; // last week only Thursday
    expect(lockedItemPlacement('2026-10-22', changed)).toEqual({ sequence: 1 });
    expect(lockedItemPlacement('2026-10-23', changed)).toBeNull(); // Friday dropped out of the latest week
  });
  it('chains: after Thursday is added Friday still follows (its own week is ignored)', () => {
    const chain = [...thuFri, { day: '2026-10-15', sequence: 3 }];
    expect(lockedItemPlacement('2026-10-16', chain)).toEqual({ sequence: 5 });
  });
  it('a later week that was changed by hand becomes the pattern for the week after', () => {
    const both = [...thuFri, { day: '2026-10-15', sequence: 3 }, { day: '2026-10-16', sequence: 5 }];
    expect(lockedItemPlacement('2026-10-22', both)).toEqual({ sequence: 3 });
    expect(lockedItemPlacement('2026-10-23', both)).toEqual({ sequence: 5 });
  });
  it('a weekend day in the target week uses the same previous week', () => {
    expect(lockedItemPlacement('2026-10-10', thuFri)).toBeNull(); // Saturday: not a weekday of the item
  });
  it('never before the first assignment, never on a day it is already on', () => {
    expect(lockedItemPlacement('2026-10-01', thuFri)).toBeNull();
    expect(lockedItemPlacement('2026-10-08', thuFri)).toBeNull();
    expect(lockedItemPlacement('2026-10-15', [])).toBeNull();
  });
  it('ignores assignments that are not calendar dates', () => {
    expect(lockedItemPlacement('2026-10-15', [{ day: 'Thursday', sequence: 0 }])).toBeNull();
    expect(lockedItemPlacement('not a date', thuFri)).toBeNull();
  });
  it('a gap of weeks still uses the last week it was on', () => {
    expect(lockedItemPlacement('2026-11-05', thuFri)).toEqual({ sequence: 3 });
  });
});

describe('isTodayOrLater (Pacific time)', () => {
  const nineThirtyPm = new Date('2026-10-08T04:30:00Z'); // 9:30 PM on Wed Oct 7 in Seattle (already Oct 8 in UTC)
  it('today counts, even late in the evening when it is already tomorrow in UTC', () => {
    expect(isTodayOrLater('2026-10-07', nineThirtyPm)).toBe(true);
  });
  it('yesterday and earlier do not, tomorrow and later do', () => {
    expect(isTodayOrLater('2026-10-06', nineThirtyPm)).toBe(false);
    expect(isTodayOrLater('2026-10-08', nineThirtyPm)).toBe(true);
    expect(isTodayOrLater('2026-12-31', nineThirtyPm)).toBe(true);
  });
  it('early morning Pacific is still the same Pacific day', () => {
    expect(isTodayOrLater('2026-10-07', new Date('2026-10-07T08:00:00Z'))).toBe(true);
  });
  it('not a date', () => {
    expect(isTodayOrLater('Thursday', nineThirtyPm)).toBe(false);
  });
});
