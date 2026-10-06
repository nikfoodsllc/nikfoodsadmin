/**
 * Which weekdays the Kitchen Dashboard shows and in what order. The layout is saved per weekday (not
 * per date) so it still applies next week. Pure helpers, no React; the saved order/hidden lists use the
 * same shape as the table column layouts (src/utils/columnPreferences.ts).
 */
import type { ColumnDef } from '@/utils/columnPreferences';

/** Weekdays in kitchen-week order (Saturday to Friday). The key is the lower-case weekday name. */
export const KITCHEN_DAY_DEFS: ColumnDef[] = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
].map((label) => ({ key: label.toLowerCase(), label, defaultWidth: 1 }));

export const weekdayKey = (weekday: string): string => weekday.trim().toLowerCase();

/**
 * The days to show: hidden weekdays removed, then ordered by the saved weekday order (`orderedKeys`
 * lists every weekday), and by date within the same weekday (a custom range can span several weeks).
 * With the default order this is plain date order. The input is not changed.
 */
export function arrangeKitchenDays<T extends { day: string; weekday: string }>(days: T[], orderedKeys: string[], hiddenKeys: ReadonlySet<string>): T[] {
  const rank = new Map(orderedKeys.map((k, i) => [k, i]));
  return days
    .filter((d) => !hiddenKeys.has(weekdayKey(d.weekday)))
    .sort((a, b) => {
      const ra = rank.get(weekdayKey(a.weekday)) ?? orderedKeys.length;
      const rb = rank.get(weekdayKey(b.weekday)) ?? orderedKeys.length;
      return ra !== rb ? ra - rb : a.day.localeCompare(b.day);
    });
}
