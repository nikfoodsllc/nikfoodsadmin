import { describe, expect, it } from 'vitest';
import { KITCHEN_DAY_DEFS, arrangeKitchenDays } from './kitchenDayLayout';
import { orderedColumns, moveColumnInPrefs, emptyColumnPrefs, sanitizeColumnPrefs } from './columnPreferences';

const d = (day: string, weekday: string) => ({ day, weekday });
const week = [d('2026-10-03', 'Saturday'), d('2026-10-04', 'Sunday'), d('2026-10-05', 'Monday'), d('2026-10-06', 'Tuesday'), d('2026-10-07', 'Wednesday'), d('2026-10-08', 'Thursday'), d('2026-10-09', 'Friday')];
const names = (days: Array<{ weekday: string }>) => days.map((x) => x.weekday.slice(0, 3)).join(' ');
const defaultKeys = orderedColumns(KITCHEN_DAY_DEFS, emptyColumnPrefs()).map((c) => c.key);

describe('arrangeKitchenDays', () => {
  it('keeps date order with the default layout', () => {
    expect(names(arrangeKitchenDays(week, defaultKeys, new Set()))).toBe('Sat Sun Mon Tue Wed Thu Fri');
  });

  it('hides weekdays', () => {
    expect(names(arrangeKitchenDays(week, defaultKeys, new Set(['saturday', 'sunday', 'monday'])))).toBe('Tue Wed Thu Fri');
  });

  it('follows a saved weekday order made with the same helpers the menu uses', () => {
    const prefs = moveColumnInPrefs(KITCHEN_DAY_DEFS, emptyColumnPrefs(), 'friday', 0);
    const keys = orderedColumns(KITCHEN_DAY_DEFS, prefs).map((c) => c.key);
    expect(names(arrangeKitchenDays(week, keys, new Set()))).toBe('Fri Sat Sun Mon Tue Wed Thu');
  });

  it('keeps dates in order inside one weekday when the range spans two weeks', () => {
    const two = [d('2026-10-13', 'Tuesday'), d('2026-10-06', 'Tuesday'), d('2026-10-09', 'Friday')];
    expect(arrangeKitchenDays(two, defaultKeys, new Set()).map((x) => x.day)).toEqual(['2026-10-06', '2026-10-13', '2026-10-09']);
  });

  it('ignores junk in a stored layout and does not change the input', () => {
    const prefs = sanitizeColumnPrefs({ order: ['friday', 'nope', 'friday'], hidden: ['saturday', 'bogus'], widths: { friday: 999 } }, KITCHEN_DAY_DEFS);
    expect(prefs.hidden).toEqual(['saturday']);
    const copy = JSON.stringify(week);
    arrangeKitchenDays(week, orderedColumns(KITCHEN_DAY_DEFS, prefs).map((c) => c.key), new Set(prefs.hidden));
    expect(JSON.stringify(week)).toBe(copy);
  });

  it('shows days with an unknown weekday name last instead of dropping them', () => {
    expect(arrangeKitchenDays([d('2026-10-03', 'Samstag'), d('2026-10-09', 'Friday')], defaultKeys, new Set()).map((x) => x.weekday)).toEqual(['Friday', 'Samstag']);
  });
});
