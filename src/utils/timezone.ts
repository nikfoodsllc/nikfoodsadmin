/**
 * Centralized timezone utility module for PST (Pacific Standard Time) conversions.
 * Uses date-fns-tz library for timezone-aware date operations.
 *
 * Timezone: America/Los_Angeles (PST/PDT)
 */

import { format, toDate } from 'date-fns-tz';

/**
 * PST Timezone constant
 */
export const PST_TIMEZONE = 'America/Los_Angeles';

/**
 * Type for valid date input
 */
export type DateInput = Date | string | number | null | undefined;

/**
 * Converts a date to PST timezone Date object
 * @param date - Date to convert (Date, string, timestamp, or null/undefined)
 * @returns Date object in PST timezone, or null if input is invalid
 */
export function toPSTDate(date: DateInput): Date | null {
  if (!date) return null;

  try {
    let dateString = date;

    // Handle YYYY-MM-DD format specifically to avoid timezone shift issues
    // When creating a Date from 'YYYY-MM-DD' string, JavaScript treats it as UTC midnight
    // Converting to PST (UTC-8/UTC-7) shifts it to the previous day
    // Solution: Append 'T12:00:00' to create noon time, ensuring it stays within the correct day
    if (typeof date === 'string') {
      const yyyyMmDdRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      if (yyyyMmDdRegex.test(date)) {
        dateString = `${date}T12:00:00`;
      }
    }

    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return null;

    return toDate(dateObj, { timeZone: PST_TIMEZONE });
  } catch (error) {
    console.error('Error converting to PST date:', error);
    return null;
  }
}

/**
 * Formats a date in PST timezone with a custom format string
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @param formatStr - Format string (e.g., 'yyyy-MM-dd', 'MMM dd, yyyy')
 * @returns Formatted date string in PST timezone, or empty string if input is invalid
 *
 * @example
 * formatInPST('2025-01-15', 'yyyy-MM-dd') // '2025-01-15'
 * formatInPST(new Date(), 'MMM dd, yyyy HH:mm') // 'Jan 15, 2025 14:30'
 */
export function formatInPST(date: DateInput, formatStr: string): string {
  const pstDate = toPSTDate(date);
  if (!pstDate) return '';

  try {
    return format(pstDate, formatStr, { timeZone: PST_TIMEZONE });
  } catch (error) {
    console.error('Error formatting date in PST:', error);
    return '';
  }
}

/**
 * Formats a date as "MMM DD, YYYY" in PST timezone (e.g., "Jan 15, 2025")
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @returns Formatted date string, or empty string if input is invalid
 */
export function formatPSTDate(date: DateInput): string {
  return formatInPST(date, 'MMM dd, yyyy');
}

/**
 * Formats a date with time as "MMM DD, YYYY HH:MM" in PST timezone (e.g., "Jan 15, 2025 14:30")
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @returns Formatted date-time string, or empty string if input is invalid
 */
export function formatPSTDateTime(date: DateInput): string {
  return formatInPST(date, 'MMM dd, yyyy HH:mm');
}

/**
 * Formats a time as "HH:MM" in PST timezone (e.g., "14:30")
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @returns Formatted time string, or empty string if input is invalid
 */
export function formatPSTTime(date: DateInput): string {
  return formatInPST(date, 'HH:mm');
}

/**
 * Formats a date as "YYYY-MM-DD" in PST timezone (e.g., "2025-01-15")
 * Useful for database storage and API responses
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @returns Formatted date string in ISO format, or empty string if input is invalid
 */
export function formatPSTDateISO(date: DateInput): string {
  return formatInPST(date, 'yyyy-MM-dd');
}

/**
 * Formats a date as "Day (MMM DD)" in PST timezone (e.g., "Sat (Jan 3)")
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @returns Formatted date string with day name, or empty string if input is invalid
 */
export function formatPSTDateWithDay(date: DateInput): string {
  return formatInPST(date, 'EEE (MMM dd)');
}

/**
 * Formats a date as "MMM DD" in PST timezone (e.g., "Jan 15")
 * @param date - Date to format (Date, string, timestamp, or null/undefined)
 * @returns Formatted date string (month and day only), or empty string if input is invalid
 */
export function formatPSTDateShort(date: DateInput): string {
  return formatInPST(date, 'MMM dd');
}

/**
 * Gets the current time in PST timezone
 * @returns Current Date object in PST timezone
 */
export function getCurrentPSTDate(): Date {
  return toDate(new Date(), { timeZone: PST_TIMEZONE });
}

/**
 * Checks if a date is valid
 * @param date - Date to validate (Date, string, timestamp, or null/undefined)
 * @returns true if date is valid, false otherwise
 */
export function isValidPSTDate(date: DateInput): boolean {
  if (!date) return false;

  try {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
}
