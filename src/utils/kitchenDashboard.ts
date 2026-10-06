/**
 * Kitchen dashboard: week math and the per-day production counts.
 *
 * Everything here is pure (no database, no browser) so it can be tested on its own.
 * Days are plain 'YYYY-MM-DD' strings. An order item "belongs" to the menu day it was picked for
 * (order day `deliveryDate`), which is the day the kitchen produces it, even when a short day was
 * later combined into another delivery day.
 */

export type WeekPreset = 'thisWeek' | 'lastWeek' | 'weekBeforeLast' | 'custom';

export interface DayRange {
  startDate: string; // inclusive
  endDate: string; // inclusive
}

export const MAX_RANGE_DAYS = 62;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayString(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, amount: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export function weekdayName(day: string): string {
  return WEEKDAYS[toUtc(day).getUTCDay()];
}

/** The Monday of the week that contains `day` (weeks run Monday to Sunday). */
export function mondayOf(day: string): string {
  const dow = toUtc(day).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** Monday..Sunday of the week `weeksAgo` weeks before the week containing `today`. */
export function getWeekRange(today: string, weeksAgo = 0): DayRange {
  const monday = addDays(mondayOf(today), -7 * weeksAgo);
  return { startDate: monday, endDate: addDays(monday, 6) };
}

export function getPresetRange(preset: Exclude<WeekPreset, 'custom'>, today: string): DayRange {
  const weeksAgo = preset === 'thisWeek' ? 0 : preset === 'lastWeek' ? 1 : 2;
  return getWeekRange(today, weeksAgo);
}

/** Every day from start to end, inclusive. Empty when the range is invalid or backwards. */
export function enumerateDays(range: DayRange): string[] {
  if (!isDayString(range.startDate) || !isDayString(range.endDate)) return [];
  if (range.startDate > range.endDate) return [];
  const days: string[] = [];
  let current = range.startDate;
  while (current <= range.endDate && days.length <= MAX_RANGE_DAYS) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/** Why a custom range cannot be used, or null when it is fine. */
export function validateRange(range: DayRange): string | null {
  if (!isDayString(range.startDate) || !isDayString(range.endDate)) return 'Pick a start and an end date.';
  if (range.startDate > range.endDate) return 'The start date must not be after the end date.';
  if (enumerateDays(range).length > MAX_RANGE_DAYS) return `Pick at most ${MAX_RANGE_DAYS} days at a time.`;
  return null;
}

/** 'Mon, Oct 5' for a day string. */
export function formatDayShort(day: string): string {
  const d = toUtc(day);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${weekdayName(day).slice(0, 3)}, ${month} ${d.getUTCDate()}`;
}

/** 'Oct 5 – Oct 11, 2026' (or both years when the range crosses a year). */
export function formatRangeLabel(range: DayRange): string {
  const s = toUtc(range.startDate);
  const e = toUtc(range.endDate);
  const m = (d: Date) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const sy = s.getUTCFullYear();
  const ey = e.getUTCFullYear();
  const start = `${m(s)} ${s.getUTCDate()}${sy !== ey ? `, ${sy}` : ''}`;
  return `${start} – ${m(e)} ${e.getUTCDate()}, ${ey}`;
}

// ---------------------------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------------------------

/** One ordered line (one item of one order day), flattened for counting. */
export interface KitchenRow {
  orderId: string;
  day: string; // the menu day the item belongs to, 'YYYY-MM-DD'
  name: string;
  quantity: number;
  portion?: string | null;
  spiceLevel?: string | null;
  isEco?: boolean;
  /** Combo definition snapshot: sections with their selectable options. */
  sections?: Array<{
    _id?: string;
    selectedItems?: Array<{ _id?: string; portion?: string | null; item?: { name?: string } | null }>;
  }> | null;
  /** What the customer picked: { sectionId: [option ids] }. */
  comboSelections?: Record<string, string[]> | null;
}

export interface CountLine {
  label: string;
  quantity: number;
}

export interface KitchenItem {
  name: string;
  /** Everything to cook of this item: ordered on its own plus the parts of combos. */
  quantity: number;
  /** How much of `quantity` is a part of a combo. */
  inCombos: number;
  portions: CountLine[];
  spice: CountLine[];
}

export interface KitchenCombo {
  name: string;
  quantity: number;
  spice: CountLine[];
  /** What the customers picked inside this combo (one part per combo ordered). */
  parts: Array<{ name: string; portion: string | null; quantity: number }>;
}

export interface KitchenDay {
  day: string;
  weekday: string;
  items: KitchenItem[];
  combos: KitchenCombo[];
  totals: { units: number; orders: number; ecoContainers: number };
}

const clean = (v: string | null | undefined): string => (typeof v === 'string' ? v.trim() : '');

function bump(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function toLines(map: Map<string, number>): CountLine[] {
  return [...map.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));
}

/** The picked options of a combo line, as name + portion. Unknown ids are skipped. */
export function comboParts(row: Pick<KitchenRow, 'sections' | 'comboSelections'>): Array<{ name: string; portion: string | null }> {
  if (!row.sections?.length || !row.comboSelections) return [];
  const parts: Array<{ name: string; portion: string | null }> = [];
  for (const section of row.sections) {
    const picked = (section._id && row.comboSelections[section._id]) || [];
    for (const id of picked) {
      const option = section.selectedItems?.find((si) => si._id === id);
      const name = clean(option?.item?.name);
      if (!name) continue;
      parts.push({ name, portion: clean(option?.portion) || null });
    }
  }
  return parts;
}

interface ItemAcc {
  total: number;
  inCombos: number;
  portions: Map<string, number>;
  spice: Map<string, number>;
}

/**
 * Group the flattened order lines of the given days into one block per day.
 * Every day in `days` gets a block, even when nothing is ordered for it.
 */
export function buildKitchenDays(rows: KitchenRow[], days: string[]): KitchenDay[] {
  const byDay = new Map<string, KitchenRow[]>();
  for (const row of rows) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0 || !clean(row.name)) continue;
    const list = byDay.get(row.day) ?? [];
    list.push(row);
    byDay.set(row.day, list);
  }

  return days.map((day) => {
    const dayRows = byDay.get(day) ?? [];
    const items = new Map<string, ItemAcc>();
    const combos = new Map<string, { quantity: number; spice: Map<string, number>; parts: Map<string, { name: string; portion: string | null; quantity: number }> }>();
    const orderIds = new Set<string>();
    let ecoContainers = 0;

    const itemAcc = (name: string): ItemAcc => {
      let acc = items.get(name);
      if (!acc) {
        acc = { total: 0, inCombos: 0, portions: new Map(), spice: new Map() };
        items.set(name, acc);
      }
      return acc;
    };

    for (const row of dayRows) {
      orderIds.add(row.orderId);
      if (row.isEco) ecoContainers += row.quantity;
      const name = clean(row.name);
      const spice = clean(row.spiceLevel);
      const parts = comboParts(row);

      if (parts.length > 0) {
        // a combo: counted as a combo, and each chosen part is also something to cook
        let combo = combos.get(name);
        if (!combo) {
          combo = { quantity: 0, spice: new Map(), parts: new Map() };
          combos.set(name, combo);
        }
        combo.quantity += row.quantity;
        if (spice) bump(combo.spice, spice, row.quantity);
        for (const part of parts) {
          const key = `${part.name}\u0000${part.portion ?? ''}`;
          const existing = combo.parts.get(key);
          if (existing) existing.quantity += row.quantity;
          else combo.parts.set(key, { name: part.name, portion: part.portion, quantity: row.quantity });

          const acc = itemAcc(part.name);
          acc.total += row.quantity;
          acc.inCombos += row.quantity;
          bump(acc.portions, part.portion ?? 'No size', row.quantity);
        }
      } else {
        const acc = itemAcc(name);
        acc.total += row.quantity;
        const portion = clean(row.portion);
        bump(acc.portions, portion || 'No size', row.quantity);
        if (spice) bump(acc.spice, spice, row.quantity);
      }
    }

    const itemList: KitchenItem[] = [...items.entries()]
      .map(([name, acc]) => {
        const portions = toLines(acc.portions);
        // a single "No size" line adds nothing to the total, so it is left out
        const showPortions = portions.length > 1 || (portions.length === 1 && portions[0].label !== 'No size');
        return {
          name,
          quantity: acc.total,
          inCombos: acc.inCombos,
          portions: showPortions ? portions : [],
          spice: toLines(acc.spice),
        };
      })
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

    const comboList: KitchenCombo[] = [...combos.entries()]
      .map(([name, c]) => ({
        name,
        quantity: c.quantity,
        spice: toLines(c.spice),
        parts: [...c.parts.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

    return {
      day,
      weekday: weekdayName(day),
      items: itemList,
      combos: comboList,
      totals: {
        units: itemList.reduce((sum, i) => sum + i.quantity, 0) - itemList.reduce((s, i) => s + i.inCombos, 0) + comboList.reduce((s, c) => s + c.quantity, 0),
        orders: orderIds.size,
        ecoContainers,
      },
    };
  });
}

/** Normalise an order-day date (string or Date) to 'YYYY-MM-DD'; null when unusable. */
export function toDayString(value: unknown): string | null {
  if (typeof value === 'string') {
    const head = value.slice(0, 10);
    return isDayString(head) ? head : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return null;
}
