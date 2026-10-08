/**
 * The day headings in an order's details. Each block of items is for a MENU day (the weekday name and date it was picked
 * for). When that day was combined into a later delivery (cart clubbing), the order also carries the day it is really
 * delivered on. The heading must keep the menu day's name and its own date together ("Thursday - Oct 08"), and say
 * separately when it is delivered another day ("Delivered on Friday, Oct 09").
 */
export interface OrderDayDates {
  day?: string | null;
  deliveryDate?: Date | string | null;
  actualDeliveryDate?: Date | string | null;
}

export interface OrderDayHeading {
  /** The weekday name of the menu day, as stored (e.g. Thursday) */
  menuDay: string;
  /** YYYY-MM-DD the items were picked for */
  menuDate: string;
  /** Set when the delivery is on another day than the menu day: the real delivery date and its weekday */
  deliveredOn: { date: string; weekday: string } | null;
}

/** YYYY-MM-DD of a stored date (a string keeps its date part, a Date uses its UTC day). */
export function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}

export function weekdayOf(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function orderDayHeading(day: OrderDayDates): OrderDayHeading {
  const menuDate = dateOnly(day.deliveryDate);
  const actual = dateOnly(day.actualDeliveryDate);
  const clubbed = Boolean(actual) && actual !== menuDate;
  return {
    menuDay: String(day.day ?? '').trim() || weekdayOf(menuDate),
    menuDate,
    deliveredOn: clubbed ? { date: actual, weekday: weekdayOf(actual) } : null,
  };
}
