/**
 * Delivery date processing utilities
 * Handles sorting and merging of delivery dates for orders
 */
import { OrderDay } from '@/types/order';
import { formatPSTDate } from '@/utils/timezone';

/**
 * Represents a processed delivery date entry
 */
export interface ProcessedDeliveryDate {
  date: string; // Formatted date string (e.g., 'Mar 05, 2026')
  originalDays: number[]; // Original day numbers that have this date (e.g., [1, 2])
}

/**
 * Processes delivery dates from order items to sort and merge duplicates
 * @param items - OrderDay array from order.items
 * @returns Array of processed delivery dates sorted chronologically with duplicates merged
 */
export function processDeliveryDates(items: OrderDay[]): ProcessedDeliveryDate[] {
  if (!items || items.length === 0) return [];

  // Create array of date entries with their original day numbers
  const dateEntries: Array<{
    dateObj: Date;
    formattedDate: string;
    originalDay: number;
  }> = [];

  items.forEach((item, index) => {
    const date = item.actualDeliveryDate || item.deliveryDate;
    if (date) {
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        dateEntries.push({
          dateObj,
          formattedDate: formatPSTDate(date),
          originalDay: index + 1, // Day numbers are 1-indexed
        });
      }
    }
  });

  // Sort by date chronologically
  dateEntries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  // Merge duplicate dates
  const mergedDates: ProcessedDeliveryDate[] = [];
  let currentEntry: ProcessedDeliveryDate | null = null;

  dateEntries.forEach((entry) => {
    if (currentEntry && currentEntry.date === entry.formattedDate) {
      // Same date as previous, add to originalDays
      currentEntry.originalDays.push(entry.originalDay);
    } else {
      // New date, create new entry
      if (currentEntry) {
        mergedDates.push(currentEntry);
      }
      currentEntry = {
        date: entry.formattedDate,
        originalDays: [entry.originalDay],
      };
    }
  });

  // Don't forget the last entry
  if (currentEntry) {
    mergedDates.push(currentEntry);
  }

  return mergedDates;
}

/**
 * Gets the maximum number of unique delivery days across all orders
 * This is used to determine how many delivery date columns to display
 * @param orders - Array of orders
 * @returns Maximum number of unique delivery dates
 */
export function getMaxUniqueDeliveryDays(orders: any[]): number {
  if (!orders || orders.length === 0) return 0;
  
  return orders.reduce((max, order) => {
    const processedDates = processDeliveryDates(order.items || []);
    return Math.max(max, processedDates.length);
  }, 0);
}
