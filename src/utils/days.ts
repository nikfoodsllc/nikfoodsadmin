import { AvailableDay } from '@/hooks/useAvailableDays';
import {
  formatPSTDate,
  formatPSTDateShort,
  formatPSTDateWithDay,
  formatPSTDateISO,
  PST_TIMEZONE,
  formatInPST,
  formatPSTDateTime,
  formatPSTTime,
  toPSTDate,
  getCurrentPSTDate,
  isValidPSTDate,
} from '@/utils/timezone';

// Re-export PST timezone constant and utilities for backward compatibility
export { PST_TIMEZONE };
export type { DateInput } from '@/utils/timezone';
export {
  formatInPST,
  formatPSTDateTime,
  formatPSTTime,
  toPSTDate,
  getCurrentPSTDate,
  isValidPSTDate,
} from '@/utils/timezone';

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export function getDefaultDays(): AvailableDay[] {
  return DAYS_OF_WEEK.map((day, index) => ({
    id: (index + 1).toString(),
    day: day.toLowerCase(),
    label: day,
    enabled: true,
    sequence: index + 1
  }));
}

export function formatDayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

export function getDayAbbreviation(day: string): string {
  return day.slice(0, 3).toUpperCase();
}

// Date formatting utilities for calendar-based system
// All functions now use PST timezone for consistent formatting

/**
 * Formats a date label in PST timezone as "MMM DD, YYYY" (e.g., "Jan 15, 2025")
 * @param dateString - Date string in YYYY-MM-DD format or any valid date format
 * @returns Formatted date string in PST timezone
 */
export function formatDateLabel(dateString: string): string {
  const formatted = formatPSTDate(dateString);
  return formatted || dateString; // Return original if invalid
}

/**
 * Formats a date in PST timezone as "MMM DD" (e.g., "Jan 15")
 * @param dateString - Date string in YYYY-MM-DD format or any valid date format
 * @returns Formatted date string (month and day only) in PST timezone
 */
export function formatDateShort(dateString: string): string {
  const formatted = formatPSTDateShort(dateString);
  return formatted || dateString;
}

/**
 * Formats a date with day name in PST timezone as "Day (MMM DD)" (e.g., "Sat (Jan 3)")
 * @param dateString - Date string in YYYY-MM-DD format or any valid date format
 * @returns Formatted date string with day name in PST timezone
 */
export function formatDateWithDay(dateString: string): string {
  const formatted = formatPSTDateWithDay(dateString);
  return formatted || dateString;
}

/**
 * Formats a date in ISO format in PST timezone as "YYYY-MM-DD" (e.g., "2025-01-15")
 * Useful for consistent date representation across the application
 * @param dateString - Date string in any valid date format
 * @returns Formatted date string in ISO format (PST timezone)
 */
export function formatDateISO(dateString: string): string {
  const formatted = formatPSTDateISO(dateString);
  return formatted || dateString;
}

export function isDateString(value: string): boolean {
  // Check if the string is in YYYY-MM-DD format
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!regex.test(value)) {
    return false;
  }

  // Validate it's a real date
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function isDayName(value: string): boolean {
  // Check if the string is a day name (Monday, Tuesday, etc.)
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return dayNames.includes(value);
}