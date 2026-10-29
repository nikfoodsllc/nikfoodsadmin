/**
 * Inventory limits ("thresholds") on food items. The admin sets an order limit on an item (Food Items > edit); every unit ordered
 * since the count started counts (also the units inside combos); when the count reaches the limit the item is sold out on the
 * website and in the app and cannot be ordered. No limit (blank) means unlimited.
 *
 * The count starts when the limit is set and again at every manual reset. With "Reset (Custom Time)" it also starts again every
 * day at a time of day the admin chose (Pacific time).
 *
 * This file is the same in the customer site and the admin (src/lib/stockRules.ts and src/utils/stockRules.ts): keep them identical.
 */

/** An order waiting for its payment holds its units for this long, then lets them go again (an abandoned checkout). */
export const STOCK_HOLD_MINUTES = 30;

export type StockUnit = 'units' | 'lb' | 'oz';
export const cleanStockUnit = (value: unknown): StockUnit => (value === 'lb' || value === 'oz' ? value : 'units');

/**
 * A usable limit: whole units or whole ounces (at least 1), or pounds (at least 0.25, up to 2 decimals). Anything else (blank, 0,
 * text) means "no limit".
 */
export function cleanThreshold(value: unknown, unit: StockUnit = 'units'): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n > 100000) return null;
  if (unit === 'lb') {
    const rounded = Math.round(n * 100) / 100;
    return rounded >= 0.25 ? rounded : null;
  }
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** What the counts are kept in: units, or ounces for a limit in pounds or ounces. */
export const baseOf = (unit: StockUnit): 'units' | 'oz' => (unit === 'units' ? 'units' : 'oz');

/** A limit as an amount in the base (pounds become ounces). */
export const limitInBase = (limit: number, unit: StockUnit): number => (unit === 'lb' ? Math.round(limit * 16 * 100) / 100 : limit);

/** An amount in the base shown in the limit's unit ("32 lb", "8 oz", "12"). */
export function formatAmount(base: number, unit: StockUnit): string {
  if (unit === 'lb') return `${Math.round((base / 16) * 100) / 100} lb`;
  if (unit === 'oz') return `${Math.round(base * 100) / 100} oz`;
  return String(Math.round(base * 100) / 100);
}

export interface StockState {
  limit: number | null;
  unit: StockUnit;
  /** in the limit's unit */
  ordered: number;
  /** in the limit's unit (never below 0); null when there is no limit */
  remaining: number | null;
  /** the same amounts in the base (units or ounces) */
  orderedBase: number;
  remainingBase: number | null;
  soldOut: boolean;
}

/** `orderedBase` is what was ordered in the base (units, or ounces for a weight limit). */
export function stockState(limit: unknown, orderedBase: number, unit: StockUnit = 'units'): StockState {
  const t = cleanThreshold(limit, unit);
  const used = Math.max(0, Number(orderedBase) || 0);
  const shown = (base: number) => (unit === 'lb' ? Math.round((base / 16) * 100) / 100 : Math.round(base * 100) / 100);
  if (t === null) return { limit: null, unit, ordered: shown(used), remaining: null, orderedBase: used, remainingBase: null, soldOut: false };
  const cap = limitInBase(t, unit);
  const left = Math.max(0, Math.round((cap - used) * 100) / 100);
  return { limit: t, unit, ordered: shown(used), remaining: shown(left), orderedBase: used, remainingBase: left, soldOut: used >= cap - 1e-9 };
}

export type ResetMode = 'manual' | 'daily';
export const cleanResetMode = (value: unknown): ResetMode => (value === 'daily' ? 'daily' : 'manual');

/** 'HH:MM' on a 24 hour clock, or null. */
export function cleanResetTime(value: unknown): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(typeof value === 'string' ? value.trim() : '');
  return m ? `${m[1]}:${m[2]}` : null;
}

const PACIFIC = 'America/Los_Angeles';
const partsInPacific = (at: Date) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour), mm: Number(p.minute) };
};

/** The instant a Pacific wall-clock time happens (handles daylight saving). */
export function pacificWallToDate(y: number, m: number, d: number, hh: number, mm: number): Date {
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 3; i += 1) {
    const seen = partsInPacific(new Date(guess));
    const shown = Date.UTC(seen.y, seen.m - 1, seen.d, seen.hh, seen.mm);
    const wanted = Date.UTC(y, m - 1, d, hh, mm);
    if (shown === wanted) break;
    guess += wanted - shown;
  }
  return new Date(guess);
}

/** The most recent moment it was `time` (Pacific) at or before `now`. */
export function lastDailyBoundary(now: Date, time: string): Date {
  const t = cleanResetTime(time) ?? '00:00';
  const [hh, mm] = t.split(':').map(Number);
  const today = partsInPacific(now);
  let boundary = pacificWallToDate(today.y, today.m, today.d, hh, mm);
  if (boundary.getTime() > now.getTime()) {
    const yesterday = partsInPacific(new Date(now.getTime() - 24 * 3600_000));
    boundary = pacificWallToDate(yesterday.y, yesterday.m, yesterday.d, hh, mm);
  }
  return boundary;
}

/** The cart raises this (a browser event) when it stops a quantity at what is left; the site shows "Only N left". */
export const STOCK_LIMIT_EVENT = 'nikfoods-stock-limit';
export interface StockLimitDetail {
  name: string;
  /** what is left, in words: "2", "8 oz", "1.5 lb" */
  leftText: string;
  /** 0 = sold out */
  left: number;
}

export interface StockClock {
  stockResetAt?: unknown;
  createdAt?: unknown;
  stockResetMode?: unknown;
  stockResetTime?: unknown;
}

const asDate = (v: unknown): Date | null => {
  if (v === undefined || v === null || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Units ordered before this moment do not count: the later of (set / last manual reset) and (the last daily reset time). */
export function stockSince(doc: StockClock, now: Date = new Date()): Date {
  const base = asDate(doc.stockResetAt) ?? asDate(doc.createdAt) ?? new Date(0);
  if (cleanResetMode(doc.stockResetMode) !== 'daily') return base;
  const time = cleanResetTime(doc.stockResetTime);
  if (!time) return base;
  const daily = lastDailyBoundary(now, time);
  return daily.getTime() > base.getTime() ? daily : base;
}

/** The next daily reset (for the admin to read: "next reset Oct 30, 3:00 AM"). */
export function nextDailyBoundary(now: Date, time: string): Date {
  const last = lastDailyBoundary(now, time);
  const t = cleanResetTime(time) ?? '00:00';
  const [hh, mm] = t.split(':').map(Number);
  const after = partsInPacific(new Date(last.getTime() + 26 * 3600_000));
  return pacificWallToDate(after.y, after.m, after.d, hh, mm);
}

// ---------------------------------------------------------------------------------------------
// Which units a line uses up
// ---------------------------------------------------------------------------------------------

interface ComboOption {
  _id?: unknown;
  quantity?: unknown;
  item?: { _id?: unknown } | null;
}
interface LineFood {
  _id?: unknown;
  sections?: Array<{ _id?: unknown; selectedItems?: ComboOption[] }> | null;
}
/** An order line or a cart line (the food is `food` in an order and `foodItem` in a cart). */
export interface StockLineInput {
  food?: LineFood | null;
  foodItem?: LineFood | null;
  quantity?: unknown;
  comboSelections?: Record<string, unknown> | null;
}

const partCount = (value: unknown): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : 1;
};

const SIZE_RE = /^\s*(?:(\d+)\s+)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(oz|ounces?|lbs?|pounds?|kgs?|gms?|grams?|g)\b/i;

/** How many ounces one serving of a size label holds: "12Oz" 12, "1/2Lb" 8, "1Lb" 16, "1Kg" 35.27. Labels without a weight ("6Pcs", "Full") give null. */
export function portionOunces(label: unknown): number | null {
  const m = typeof label === 'string' ? SIZE_RE.exec(label) : null;
  if (!m) return null;
  const whole = m[1] ? Number(m[1]) : 0;
  let value = Number(m[2]);
  if (m[3]) {
    const denominator = Number(m[3]);
    if (!denominator) return null;
    value = whole + value / denominator;
  } else if (whole) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[4].toLowerCase();
  if (unit.startsWith('oz') || unit.startsWith('ounce')) return value;
  if (unit.startsWith('lb') || unit.startsWith('pound')) return value * 16;
  if (unit.startsWith('kg')) return value * 35.27396;
  return value * 0.03527396; // grams
}

export interface LineAmount {
  units: number;
  ounces: number;
}

interface ComboOptionWithSize extends ComboOption {
  portion?: unknown;
}

/**
 * What a line uses up of each food item: units, and ounces (from the size of the serving). It is the item itself, plus (for a combo)
 * every picked option's item, times how many of it come with one combo, times the quantity ordered.
 */
export function lineAmounts(line: StockLineInput & { selectedPortion?: unknown }): Map<string, LineAmount> {
  const out = new Map<string, LineAmount>();
  const qty = Math.floor(Number(line.quantity));
  if (!Number.isFinite(qty) || qty <= 0) return out;
  const food = line.food ?? line.foodItem ?? null;
  const add = (id: unknown, units: number, ounces: number) => {
    const key = id === undefined || id === null ? '' : String(id);
    if (!key) return;
    const cur = out.get(key) ?? { units: 0, ounces: 0 };
    cur.units += units;
    cur.ounces += ounces;
    out.set(key, cur);
  };
  add(food?._id, qty, (portionOunces(line.selectedPortion) ?? 0) * qty);
  for (const section of food?.sections ?? []) {
    const picked = section?._id !== undefined && line.comboSelections ? line.comboSelections[String(section._id)] : undefined;
    const ids = Array.isArray(picked) ? picked : picked ? [picked] : [];
    for (const optionId of ids) {
      const option = (section.selectedItems ?? []).find((o) => String(o._id) === String(optionId)) as ComboOptionWithSize | undefined;
      if (option?.item?._id) {
        const pieces = qty * partCount(option.quantity);
        add(option.item._id, pieces, (portionOunces(option.portion) ?? 0) * pieces);
      }
    }
  }
  return out;
}

/** Units only (kept for callers that do not care about weight). */
export function lineUnits(line: StockLineInput & { selectedPortion?: unknown }): Map<string, number> {
  return new Map([...lineAmounts(line)].map(([id, a]) => [id, a.units]));
}

/** The amount of a line in the base of an item's limit. */
export const amountIn = (a: LineAmount | undefined, unit: StockUnit): number => (a ? (baseOf(unit) === 'units' ? a.units : a.ounces) : 0);

/** How much of the base ONE unit of a serving uses (1 for a unit limit; the ounces of the size for a weight limit; 0 when the size has no weight). */
export const perUnitAmount = (portion: unknown, unit: StockUnit): number => (baseOf(unit) === 'units' ? 1 : portionOunces(portion) ?? 0);

/** The most units that fit in `room` of the base when one unit uses `per` (no cap when `per` is 0: a size without a weight cannot be weighed). */
export const unitsThatFit = (room: number, per: number): number => (per > 0 ? Math.max(0, Math.floor(room / per + 1e-9)) : Number.POSITIVE_INFINITY);

/** The low-stock alert starts when this share of the limit is left, unless the admin chose another one. */
export const DEFAULT_ALERT_PERCENT = 10;

/** A usable alert share: a whole number from 1 to 99. Anything else (blank, text, 0, 100) means the default (10). */
export function cleanAlertPercent(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 99 ? n : DEFAULT_ALERT_PERCENT;
}

export type StockLevel = 'none' | 'ok' | 'low' | 'out';

/**
 * Where an item with an order limit stands: 'out' at the limit, 'low' once what is left is the alert share of the limit or less,
 * 'ok' above that, 'none' when there is no limit.
 */
export function stockLevel(state: Pick<StockState, 'limit' | 'unit' | 'remainingBase' | 'soldOut'>, alertPercent: unknown): StockLevel {
  if (state.limit === null || state.remainingBase === null) return 'none';
  if (state.soldOut) return 'out';
  const cap = limitInBase(state.limit, state.unit);
  return state.remainingBase <= (cap * cleanAlertPercent(alertPercent)) / 100 + 1e-9 ? 'low' : 'ok';
}
