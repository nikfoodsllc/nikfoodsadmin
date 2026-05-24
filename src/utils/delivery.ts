/**
 * Delivery date processing utilities
 * Handles delivery dates for orders — one column per food-day
 */
import { OrderDay } from '@/types/order';
import { formatPSTDate } from '@/utils/timezone';

/**
 * Represents a processed delivery date entry (one per food-day in the order)
 */
export interface ProcessedDeliveryDate {
  date: string; // Formatted actual delivery date (e.g., 'Mar 05, 2026')
  day: number; // Food-day number in the order (1-indexed)
  clubbedOriginalDate: string | null; // Formatted original date when clubbed to a different delivery date
}

function isClubbedOrderDay(orderDay: OrderDay): boolean {
  return Boolean(
    orderDay.actualDeliveryDate &&
      String(orderDay.actualDeliveryDate) !== String(orderDay.deliveryDate)
  );
}

/**
 * Processes delivery dates from order items — one entry per food-day, in order
 * @param items - OrderDay array from order.items
 * @returns Array of processed delivery dates, one per food-day (Delivery Date 1, 2, 3…)
 */
export function processDeliveryDates(items: OrderDay[]): ProcessedDeliveryDate[] {
  if (!items || items.length === 0) return [];

  return items
    .map((item, index) => {
      const actualDate = item.actualDeliveryDate || item.deliveryDate;
      if (!actualDate) return null;

      const dateObj = new Date(actualDate);
      if (isNaN(dateObj.getTime())) return null;

      return {
        date: formatPSTDate(actualDate),
        day: index + 1,
        clubbedOriginalDate: isClubbedOrderDay(item)
          ? formatPSTDate(item.deliveryDate)
          : null,
      };
    })
    .filter((entry): entry is ProcessedDeliveryDate => entry !== null);
}

/**
 * Formats a processed delivery date for CSV/table display
 * e.g. "Mar 08, 2026" or "Mar 08, 2026 (Original: Mar 06, 2026)"
 */
export function formatDeliveryDateCell(entry: ProcessedDeliveryDate): string {
  if (entry.clubbedOriginalDate) {
    return `${entry.date} (Original: ${entry.clubbedOriginalDate})`;
  }
  return entry.date;
}

function getOrderDaysFromRecord(order: {
  items?: OrderDay[];
  allOrderDays?: OrderDay[];
}): OrderDay[] {
  return order.allOrderDays || order.items || [];
}

/**
 * Gets the maximum number of food-days across all orders
 * Used to determine how many delivery date columns to display
 */
export function getMaxUniqueDeliveryDays(
  orders: Array<{ items?: OrderDay[]; allOrderDays?: OrderDay[] }>
): number {
  if (!orders || orders.length === 0) return 0;

  return orders.reduce((max, order) => {
    const dayCount = getOrderDaysFromRecord(order).length;
    return Math.max(max, dayCount);
  }, 0);
}

/**
 * Builds delivery date column values for an order
 */
export function buildDeliveryDateColumns(
  order: { items?: OrderDay[]; allOrderDays?: OrderDay[] },
  maxDeliveryDays: number
): string[] {
  const processedDates = processDeliveryDates(getOrderDaysFromRecord(order));
  const columns: string[] = [];

  for (let i = 0; i < maxDeliveryDays; i++) {
    const dateEntry = processedDates[i];
    columns.push(dateEntry ? formatDeliveryDateCell(dateEntry) : '');
  }

  return columns;
}
