/**
 * Lays out what a person left in checkout the way the website's cart and the Orders details do: one block per MENU day
 * (the day the items were picked for), with the day the block is really DELIVERED on. A day that is under the zip's
 * minimum is delivered with the last day of the cart (cart clubbing, the same rule as the customer site's
 * `calculateCartClubbing`): if at least one day meets the minimum, the days under it go to the last day; if none does
 * but the whole cart does, every day goes to the last day; if the whole cart is under the minimum nothing is combined
 * (the customer could not have paid).
 */
import type { DraftItem } from './abandonedCheckouts';

export const DEFAULT_MIN_CART_VALUE = 25;

export interface CheckoutDay {
  /** YYYY-MM-DD the items were picked for ('' when the draft did not save a day) */
  date: string;
  weekday: string;
  items: DraftItem[];
  dayTotal: number;
  /** YYYY-MM-DD it is delivered on when that is another day than `date` (combined into the last day), else null */
  deliveredOn: string | null;
}

export interface CheckoutLayout {
  days: CheckoutDay[];
  /** The whole cart is under the minimum: it could not have been paid */
  belowMinimum: boolean;
  minCartValue: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const cents = (n: number) => Math.round(n * 100) / 100;

export function weekdayName(date: string): string {
  return DAY_RE.test(date) ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '';
}

export function layoutCheckoutDays(items: DraftItem[], minCartValue?: number | null): CheckoutLayout {
  const min = typeof minCartValue === 'number' && Number.isFinite(minCartValue) && minCartValue >= 0 ? minCartValue : DEFAULT_MIN_CART_VALUE;
  const byDate = new Map<string, DraftItem[]>();
  for (const item of items) {
    const date = DAY_RE.test(String(item.date ?? '')) ? String(item.date) : '';
    byDate.set(date, [...(byDate.get(date) ?? []), item]);
  }
  const days: CheckoutDay[] = [...byDate.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([date, list]) => ({
      date,
      weekday: weekdayName(date) || String(list.find((i) => i.day)?.day ?? ''),
      items: list,
      dayTotal: cents(list.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0)),
      deliveredOn: null,
    }));
  const dated = days.filter((d) => d.date);
  if (dated.length === 0) return { days, belowMinimum: false, minCartValue: min };

  const last = dated[dated.length - 1];
  const total = cents(dated.reduce((sum, d) => sum + d.dayTotal, 0));
  const anyMeets = dated.some((d) => d.dayTotal >= min);
  if (anyMeets || total >= min) {
    for (const d of dated) {
      if (d.date === last.date) continue;
      if (!anyMeets || d.dayTotal < min) d.deliveredOn = last.date;
    }
    return { days, belowMinimum: false, minCartValue: min };
  }
  return { days, belowMinimum: true, minCartValue: min };
}
