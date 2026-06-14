/**
 * Delivery date processing utilities
 * Handles delivery dates for orders — one column per unique actual delivery date
 */
import { OrderDay } from '@/types/order';
import { formatInPST, formatPSTDate, formatPSTDateISO } from '@/utils/timezone';

/**
 * Represents a processed delivery date entry (one per unique actual delivery date)
 */
export interface ProcessedDeliveryDate {
  dateKey: string; // YYYY-MM-DD for matching columns
  date: string; // Formatted actual delivery date (e.g., 'Mar 05, 2026')
  clubbedOriginalDates: string[]; // Original dates when clubbed to a different delivery date
}

export interface DeliveryDateColumnSpec {
  dateKey: string;
  header: string;
}

function isClubbedOrderDay(orderDay: OrderDay): boolean {
  return Boolean(
    orderDay.actualDeliveryDate &&
      String(orderDay.actualDeliveryDate) !== String(orderDay.deliveryDate)
  );
}

/**
 * Processes delivery dates from order items — one entry per unique actual date
 */
export function processDeliveryDates(items: OrderDay[]): ProcessedDeliveryDate[] {
  if (!items || items.length === 0) return [];

  const dateEntries: Array<{
    dateObj: Date;
    dateKey: string;
    formattedActualDate: string;
    clubbedOriginalDate: string | null;
  }> = [];

  items.forEach((item) => {
    const actualDate = item.actualDeliveryDate || item.deliveryDate;
    if (!actualDate) return;

    const dateObj = new Date(actualDate);
    if (isNaN(dateObj.getTime())) return;

    const dateKey = formatPSTDateISO(actualDate);
    if (!dateKey) return;

    dateEntries.push({
      dateObj,
      dateKey,
      formattedActualDate: formatPSTDate(actualDate),
      clubbedOriginalDate: isClubbedOrderDay(item)
        ? formatPSTDate(item.deliveryDate)
        : null,
    });
  });

  dateEntries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const uniqueDates: ProcessedDeliveryDate[] = [];
  let currentEntry: ProcessedDeliveryDate | null = null;

  dateEntries.forEach((entry) => {
    if (currentEntry && currentEntry.dateKey === entry.dateKey) {
      if (
        entry.clubbedOriginalDate &&
        !currentEntry.clubbedOriginalDates.includes(entry.clubbedOriginalDate)
      ) {
        currentEntry.clubbedOriginalDates.push(entry.clubbedOriginalDate);
      }
    } else {
      if (currentEntry) {
        uniqueDates.push(currentEntry);
      }
      currentEntry = {
        dateKey: entry.dateKey,
        date: entry.formattedActualDate,
        clubbedOriginalDates: entry.clubbedOriginalDate ? [entry.clubbedOriginalDate] : [],
      };
    }
  });

  if (currentEntry) {
    uniqueDates.push(currentEntry);
  }

  return uniqueDates;
}

/**
 * Formats a processed delivery date for CSV/table display
 */
export function formatDeliveryDateCell(entry: ProcessedDeliveryDate): string {
  if (entry.clubbedOriginalDates.length > 0) {
    return `${entry.date} (Original: ${entry.clubbedOriginalDates.join('; ')})`;
  }
  return entry.date;
}

function getOrderDaysFromRecord(order: {
  items?: OrderDay[];
  allOrderDays?: OrderDay[];
}): OrderDay[] {
  return order.allOrderDays || order.items || [];
}

function getDayLabel(orderDay: OrderDay): string {
  const day = orderDay.day?.trim();
  if (day && !/^\d{4}-\d{2}-\d{2}/.test(day)) {
    return day;
  }

  const dateSource = orderDay.actualDeliveryDate || orderDay.deliveryDate || day;
  const weekday = formatInPST(dateSource, 'EEEE');
  return weekday || 'Day';
}

function findDayLabelForProcessedDate(
  orderDays: OrderDay[],
  processedEntry: ProcessedDeliveryDate
): string {
  for (const orderDay of orderDays) {
    const actualKey = formatPSTDateISO(orderDay.actualDeliveryDate || orderDay.deliveryDate);
    if (actualKey === processedEntry.dateKey) {
      return getDayLabel(orderDay);
    }
  }
  return 'Day';
}

/**
 * Formats a delivery date column header, e.g. "Tuesday (May 05, 2026)"
 */
export function formatDeliveryDateColumnHeader(
  dayLabel: string,
  formattedDate: string
): string {
  return `${dayLabel} (${formattedDate})`;
}

/**
 * Collects unique delivery dates across all orders for export columns (sorted chronologically)
 */
export function collectDeliveryDateColumns(
  orders: Array<{ items?: OrderDay[]; allOrderDays?: OrderDay[] }>
): DeliveryDateColumnSpec[] {
  const dateByKey = new Map<string, string>();

  for (const order of orders) {
    for (const entry of processDeliveryDates(getOrderDaysFromRecord(order))) {
      if (!dateByKey.has(entry.dateKey)) {
        dateByKey.set(entry.dateKey, entry.date);
      }
    }
  }

  const sortedKeys = [...dateByKey.keys()].sort();

  return sortedKeys.map((dateKey) => {
    const formattedDate = dateByKey.get(dateKey)!;
    let dayLabel = 'Day';

    for (const order of orders) {
      const orderDays = getOrderDaysFromRecord(order);
      const entry = processDeliveryDates(orderDays).find((e) => e.dateKey === dateKey);
      if (entry) {
        dayLabel = findDayLabelForProcessedDate(orderDays, entry);
        break;
      }
    }

    return {
      dateKey,
      header: formatDeliveryDateColumnHeader(dayLabel, formattedDate),
    };
  });
}

/**
 * Gets the maximum number of unique delivery dates across all orders
 */
export function getMaxUniqueDeliveryDays(
  orders: Array<{ items?: OrderDay[]; allOrderDays?: OrderDay[] }>
): number {
  return collectDeliveryDateColumns(orders).length;
}

/**
 * Builds delivery date column values keyed by date — blank when order has no delivery on that date
 */
export function buildDeliveryDateColumnsBySpec(
  order: { items?: OrderDay[]; allOrderDays?: OrderDay[] },
  columnSpecs: DeliveryDateColumnSpec[]
): string[] {
  const processedByKey = new Map(
    processDeliveryDates(getOrderDaysFromRecord(order)).map((entry) => [entry.dateKey, entry])
  );

  return columnSpecs.map((spec) => {
    const entry = processedByKey.get(spec.dateKey);
    return entry ? formatDeliveryDateCell(entry) : '';
  });
}

/**
 * Builds positional delivery date columns (for UI tables keyed by column index)
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
