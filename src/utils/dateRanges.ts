/**
 * Date ranges for the admin dashboard: the fixed choices (Today, This Month, ...), custom ranges, and
 * saving/restoring the selection in the browser so it does not have to be chosen again every visit.
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
  /** Set for the fixed choices (Today, This Month, ...); absent for a custom range. */
  preset?: DateRangePreset;
}

/**
 * Validates if a given value is a valid Date object
 */
export const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Creates a timezone-safe Date object using local time components
 * This avoids timezone issues by explicitly setting all components
 */
const createSafeDate = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date => {
  const date = new Date(year, month, day, hour, minute, second);

  // Validate the created date
  if (!isValidDate(date)) {
    throw new Error(`Invalid date created: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`);
  }

  return date;
};

/**
 * Validates if the provided preset is a valid DateRangePreset
 */
const isValidDateRangePreset = (preset: string): preset is DateRangePreset => {
  const validPresets: DateRangePreset[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear'];
  return validPresets.includes(preset as DateRangePreset);
};

const buildPresetRange = (preset: DateRangePreset): DateRange => {
  // Input validation
  if (!preset || !isValidDateRangePreset(preset)) {
    console.warn(`Invalid date range preset provided: ${preset}. Defaulting to 'thisMonth'.`);
    preset = 'thisMonth';
  }

  const now = new Date();

  // Validate current date
  if (!isValidDate(now)) {
    throw new Error('Current system date is invalid');
  }

  const today = createSafeDate(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    switch (preset) {
      case 'today': {
        return {
          startDate: today,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'Today',
        };
      }
      case 'yesterday': {
        const yesterdayDate = new Date(today);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = createSafeDate(
          yesterdayDate.getFullYear(),
          yesterdayDate.getMonth(),
          yesterdayDate.getDate()
        );
        return {
          startDate: yesterday,
          endDate: createSafeDate(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59),
          label: 'Yesterday',
        };
      }
      case 'thisWeek': {
        const dayOfWeek = today.getDay();
        const startOfWeekDate = new Date(today);
        startOfWeekDate.setDate(today.getDate() - dayOfWeek);
        const startOfWeek = createSafeDate(
          startOfWeekDate.getFullYear(),
          startOfWeekDate.getMonth(),
          startOfWeekDate.getDate()
        );
        return {
          startDate: startOfWeek,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Week',
        };
      }
      case 'lastWeek': {
        const dayOfWeek = today.getDay();
        const startOfLastWeekDate = new Date(today);
        startOfLastWeekDate.setDate(today.getDate() - dayOfWeek - 7);
        const startOfLastWeek = createSafeDate(
          startOfLastWeekDate.getFullYear(),
          startOfLastWeekDate.getMonth(),
          startOfLastWeekDate.getDate()
        );

        const endOfLastWeekDate = new Date(startOfLastWeek);
        endOfLastWeekDate.setDate(startOfLastWeek.getDate() + 6);
        const endOfLastWeek = createSafeDate(
          endOfLastWeekDate.getFullYear(),
          endOfLastWeekDate.getMonth(),
          endOfLastWeekDate.getDate(),
          23, 59, 59
        );
        return {
          startDate: startOfLastWeek,
          endDate: endOfLastWeek,
          label: 'Last Week',
        };
      }
      case 'thisMonth': {
        const startOfMonth = createSafeDate(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: startOfMonth,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Month',
        };
      }
      case 'lastMonth': {
        const startOfLastMonth = createSafeDate(now.getFullYear(), now.getMonth() - 1, 1);

        // Get the last day of last month
        const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const endOfLastMonth = createSafeDate(
          lastMonth.getFullYear(),
          lastMonth.getMonth(),
          lastMonth.getDate(),
          23, 59, 59
        );
        return {
          startDate: startOfLastMonth,
          endDate: endOfLastMonth,
          label: 'Last Month',
        };
      }
      case 'thisYear': {
        const startOfYear = createSafeDate(now.getFullYear(), 0, 1);
        return {
          startDate: startOfYear,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Year',
        };
      }
      default: {
        // This should never be reached due to validation, but acts as a safety net
        console.warn(`Unhandled preset in switch statement: ${preset}. Defaulting to 'thisMonth'.`);
        const startOfMonth = createSafeDate(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: startOfMonth,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Month',
        };
      }
    }
  } catch (error) {
    console.error('Error creating date range:', error);
    // Fallback to current month as a safe default
    const startOfMonth = createSafeDate(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: startOfMonth,
      endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
      label: 'This Month',
    };
  }
};


/** The fixed choice, tagged with its preset so it can be saved by name and stay relative ("This Month" tomorrow is still this month). */
export const getDateRange = (preset: DateRangePreset): DateRange => {
  const valid = isValidDateRangePreset(preset) ? preset : 'thisMonth';
  return { ...buildPresetRange(valid), preset: valid };
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-15" -> that day at local midnight; null if it is not a real calendar day. */
export function parseDay(day: string): Date | null {
  if (typeof day !== 'string' || !DAY_PATTERN.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (!isValidDate(date) || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** A date -> "2026-10-15" in local time (what a date input uses). */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** A custom range from two days (both included: start at 00:00:00, end at 23:59:59); null if invalid or backwards. */
export function getCustomDateRange(startDay: string, endDay: string): DateRange | null {
  const start = parseDay(startDay);
  const endDate = parseDay(endDay);
  if (!start || !endDate || start.getTime() > endDate.getTime()) return null;
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
  const label =
    start.getTime() === endDate.getTime()
      ? formatDayLabel(start)
      : `${formatDayLabel(start)} – ${formatDayLabel(endDate)}`;
  return { startDate: start, endDate: end, label };
}

export const DATE_RANGE_STORAGE_KEY = 'admin_dashboard_date_range';

/** What is saved: a preset by name, or the two days of a custom range. */
export function serializeDateRange(range: DateRange): string {
  if (range.preset) return JSON.stringify({ mode: 'preset', preset: range.preset });
  return JSON.stringify({ mode: 'custom', start: toDay(range.startDate), end: toDay(range.endDate) });
}

/** Turns saved text back into a range; null if there is nothing usable (then the default applies). */
export function deserializeDateRange(raw: string | null): DateRange | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.mode === 'preset' && typeof data.preset === 'string' && isValidDateRangePreset(data.preset)) {
      return getDateRange(data.preset);
    }
    if (data?.mode === 'custom') return getCustomDateRange(data.start, data.end);
  } catch {
    // unreadable saved value: ignore it
  }
  return null;
}

export function loadStoredDateRange(): DateRange | null {
  try {
    return deserializeDateRange(localStorage.getItem(DATE_RANGE_STORAGE_KEY));
  } catch {
    return null; // storage blocked (private window etc.)
  }
}

export function saveStoredDateRange(range: DateRange): void {
  try {
    localStorage.setItem(DATE_RANGE_STORAGE_KEY, serializeDateRange(range));
  } catch {
    // storage blocked: the selection just is not remembered
  }
}

export const defaultDateRange = getDateRange('thisMonth');
