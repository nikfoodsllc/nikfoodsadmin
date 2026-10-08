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

/**
 * The Saturday that starts the week containing `day`. A kitchen week runs Saturday to Friday: the new menu
 * goes out on Friday night and deliveries run through the Friday of the following week.
 */
export function weekStartOf(day: string): string {
  const dow = toUtc(day).getUTCDay(); // 0 = Sunday ... 6 = Saturday
  return addDays(day, -((dow + 1) % 7));
}

/** Saturday..Friday of the week `weeksAgo` weeks before the week containing `today`. */
export function getWeekRange(today: string, weeksAgo = 0): DayRange {
  const start = addDays(weekStartOf(today), -7 * weeksAgo);
  return { startDate: start, endDate: addDays(start, 6) };
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
    title?: string;
    selectedItems?: Array<{ _id?: string; portion?: string | null; item?: { name?: string } | null }>;
  }> | null;
  /** What the customer picked: { sectionId: [option ids] }. */
  comboSelections?: Record<string, string[]> | null;
  /** Only filled when tracing an item back to the people who ordered it. */
  customerName?: string | null;
  /** The day the items are finally delivered (it can differ from `day` when a day was combined into another). */
  deliveredOn?: string | null;
  orderStatus?: string | null;
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
  /** Sizes ordered, biggest first (16Oz, 12Oz, 8Oz; no size last) */
  portions: CountLine[];
  /** Spice levels ordered, mild to hot */
  spice: CountLine[];
  /** How many of the units ordered on their own come in an eco container (parts inside a combo count on the combo). */
  eco: number;
  /** The same eco containers by size ('16Oz' × 3), biggest size first (not most-ordered first); a unit without a size counts under 'No size', last. */
  ecoBySize: CountLine[];
  /** Total amount to cook where the sizes are known, as text ('84 oz (5.25 lb)'); '' when no size is known. */
  totalText: string;
  /** Units of this item that carry no readable size, so they are not in `totalText`. */
  unsized: number;
  /** Units that are cooked on this day but delivered on a LATER day (a small day combined into a later delivery, or moved by an admin): one line per delivery date ('YYYY-MM-DD'), oldest first. */
  deliveries: CountLine[];
}

export interface KitchenCombo {
  name: string;
  quantity: number;
  spice: CountLine[];
  /** How many of these combos come in an eco container. */
  eco: number;
  /** What the customers picked inside this combo (one part per combo ordered). */
  parts: Array<{ name: string; portion: string | null; quantity: number }>;
  /** Combos cooked on this day but delivered on another day, by delivery date ('YYYY-MM-DD'), oldest first. */
  deliveries: CountLine[];
}

export interface KitchenDay {
  day: string;
  weekday: string;
  items: KitchenItem[];
  combos: KitchenCombo[];
  totals: { units: number; orders: number; ecoContainers: number };
}

// ---------------------------------------------------------------------------------------------
// Sizes: the amount written in a portion label ("8Oz", "1/2Lb", "100gms", "6Pcs")
// ---------------------------------------------------------------------------------------------

/** An amount of food. Weights in ounces and grams are kept apart, and so are pieces. */
export interface Amount {
  oz: number;
  grams: number;
  pieces: number;
}

export const emptyAmount = (): Amount => ({ oz: 0, grams: 0, pieces: 0 });

const SIZE_RE = /^\s*(?:(\d+)\s+)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(oz|ounces?|lbs?|pounds?|kgs?|gms?|grams?|g|pcs?|pieces?)\b/i;

/**
 * What one serving of a portion label holds. "12Oz" is 12 ounces, "1/2Lb" is 8 ounces, "1Lb" is 16,
 * "100gms" is 100 grams, "6Pcs" is 6 pieces. Labels without a size ("Full", "Serves 4") give null.
 */
export function parsePortionAmount(label: string | null | undefined): Amount | null {
  const match = typeof label === 'string' ? SIZE_RE.exec(label) : null;
  if (!match) return null;
  const whole = match[1] ? Number(match[1]) : 0;
  let value = Number(match[2]);
  if (match[3]) {
    const denominator = Number(match[3]);
    if (!denominator) return null;
    value = whole + value / denominator;
  } else if (whole) {
    return null; // "1 2Oz" is not a size
  }
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[4].toLowerCase();
  const out = emptyAmount();
  if (unit.startsWith('oz') || unit.startsWith('ounce')) out.oz = value;
  else if (unit.startsWith('lb') || unit.startsWith('pound')) out.oz = value * 16;
  else if (unit.startsWith('kg')) out.grams = value * 1000;
  else if (unit.startsWith('g')) out.grams = value;
  else out.pieces = value;
  return out;
}

export function addAmount(into: Amount, add: Amount, times = 1): void {
  into.oz += add.oz * times;
  into.grams += add.grams * times;
  into.pieces += add.pieces * times;
}

const trim2 = (n: number): string => String(Math.round(n * 100) / 100);

/** '36 oz (2.25 lb)', '8 oz (0.5 lb)', '300 g', '12 pcs', or '' when there is nothing. Mixed units are joined with ' + '. */
export function formatAmount(amount: Amount): string {
  const parts: string[] = [];
  if (amount.oz > 0) {
    // ounces and pounds side by side, pounds as a decimal: 300 oz is 18.75 lb, 8 oz is 0.5 lb
    const oz = Math.round(amount.oz * 100) / 100;
    parts.push(`${trim2(oz)} oz (${trim2(oz / 16)} lb)`);
  }
  if (amount.grams > 0) {
    parts.push(amount.grams >= 1000 ? `${trim2(amount.grams)} g (${trim2(amount.grams / 1000)} kg)` : `${trim2(amount.grams)} g`);
  }
  if (amount.pieces > 0) parts.push(`${trim2(amount.pieces)} pcs`);
  return parts.join(' + ');
}

const clean = (v: string | null | undefined): string => (typeof v === 'string' ? v.trim() : '');

function bump(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Counts by size, the biggest size first (16Oz, 12Oz, 8Oz), so the same sizes always read in the same order; unsized last. */
function toSizeLines(map: Map<string, number>): CountLine[] {
  return [...map.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => sizeRank(b.label === 'No size' ? null : b.label) - sizeRank(a.label === 'No size' ? null : a.label) || a.label.localeCompare(b.label));
}

/** The short name of a spice level for the cards ('Mild (Kid Friendly)' -> 'Mild', 'Medium Spice' -> 'Medium'); other names stay as they are. */
export function shortSpiceLabel(label: string): string {
  const s = clean(label);
  if (/^mild\b/i.test(s)) return 'Mild';
  if (/^medium\b/i.test(s)) return 'Medium';
  return s;
}

/** The spice line of a card on one line: '🌶️ Mild × 9, Normal × 5, Medium × 3, Spicy × 2'; '' when there is no spice. */
export function spiceLineText(spice: CountLine[]): string {
  if (spice.length === 0) return '';
  return `🌶️ ${spice.map((s) => `${shortSpiceLabel(s.label)} × ${s.quantity}`).join(', ')}`;
}

/** Counts by spice level, mild to hot (the same order as the who-ordered list); levels we do not know come last. */
function toSpiceLines(map: Map<string, number>): CountLine[] {
  return [...map.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => spiceRank(a.label) - spiceRank(b.label) || a.label.localeCompare(b.label));
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
  eco: number;
  ecoBySize: Map<string, number>;
  amount: Amount;
  sized: number;
  /** units delivered on another day than the kitchen day, by delivery date */
  deliveries: Map<string, number>;
}

/** The day a line is delivered on when that is later than the day it is cooked, otherwise null. */
function laterDelivery(row: Pick<KitchenRow, 'day' | 'deliveredOn'>): string | null {
  const delivered = clean(row.deliveredOn);
  return delivered && delivered !== row.day ? delivered : null;
}

/** Delivery dates with their units, oldest date first. */
function toDateLines(map: Map<string, number>): CountLine[] {
  return [...map.entries()].map(([label, quantity]) => ({ label, quantity })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The line shown under an item (or combo) that is delivered on another day than it is cooked: "Delivered Wed, Oct 14"
 * when all of it is, "1 of 3 delivered Wed, Oct 14" when only some of it is. '' when nothing is.
 */
export function deliveryNote(deliveries: CountLine[] | undefined, total: number): string {
  const lines = (deliveries ?? []).filter((d) => d.quantity > 0);
  if (lines.length === 0) return '';
  return lines.map((d) => (d.quantity >= total ? `Delivered ${formatDayShort(d.label)}` : `${d.quantity} of ${total} delivered ${formatDayShort(d.label)}`)).join(' · ');
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
    const block = buildKitchenBlock(byDay.get(day) ?? []);
    return { day, weekday: weekdayName(day), ...block };
  });
}

/** Everything the kitchen has to make for a set of lines, whatever their days: the same counting as one day. */
export interface KitchenBlock {
  items: KitchenItem[];
  combos: KitchenCombo[];
  totals: { units: number; orders: number; ecoContainers: number };
}

/**
 * The totals for the whole date range as one block, ignoring which menu day or delivery day each line
 * belongs to (the "week total"). Uses exactly the counting of a single day, so a week's quantity of an
 * item is the sum of its daily quantities.
 */
export function buildKitchenWeek(rows: KitchenRow[]): KitchenBlock {
  return buildKitchenBlock(rows.filter((row) => Number.isFinite(row.quantity) && row.quantity > 0 && clean(row.name)));
}

function buildKitchenBlock(dayRows: KitchenRow[]): KitchenBlock {
  const items = new Map<string, ItemAcc>();
  const combos = new Map<string, { quantity: number; eco: number; spice: Map<string, number>; parts: Map<string, { name: string; portion: string | null; quantity: number }>; deliveries: Map<string, number> }>();
  const orderIds = new Set<string>();
  let ecoContainers = 0;

  const itemAcc = (name: string): ItemAcc => {
    let acc = items.get(name);
    if (!acc) {
      acc = { total: 0, inCombos: 0, portions: new Map(), spice: new Map(), eco: 0, ecoBySize: new Map(), amount: emptyAmount(), sized: 0, deliveries: new Map() };
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
    // delivered on a different day than it is cooked: counted by delivery date
    const later = laterDelivery(row);

    if (parts.length > 0) {
      // a combo: counted as a combo, and each chosen part is also something to cook
      let combo = combos.get(name);
      if (!combo) {
        combo = { quantity: 0, eco: 0, spice: new Map(), parts: new Map(), deliveries: new Map() };
        combos.set(name, combo);
      }
      combo.quantity += row.quantity;
      if (later) bump(combo.deliveries, later, row.quantity);
      if (row.isEco) combo.eco += row.quantity;
      if (spice) bump(combo.spice, spice, row.quantity);
      for (const part of parts) {
        const key = `${part.name}\u0000${part.portion ?? ''}`;
        const existing = combo.parts.get(key);
        if (existing) existing.quantity += row.quantity;
        else combo.parts.set(key, { name: part.name, portion: part.portion, quantity: row.quantity });

        const acc = itemAcc(part.name);
        acc.total += row.quantity;
        acc.inCombos += row.quantity;
        if (later) bump(acc.deliveries, later, row.quantity);
        bump(acc.portions, part.portion ?? 'No size', row.quantity);
        const partSize = parsePortionAmount(part.portion);
        if (partSize) {
          addAmount(acc.amount, partSize, row.quantity);
          acc.sized += row.quantity;
        }
      }
    } else {
      const acc = itemAcc(name);
      acc.total += row.quantity;
      if (later) bump(acc.deliveries, later, row.quantity);
      const portion = clean(row.portion);
      bump(acc.portions, portion || 'No size', row.quantity);
      if (spice) bump(acc.spice, spice, row.quantity);
      if (row.isEco) {
        acc.eco += row.quantity;
        bump(acc.ecoBySize, portion || 'No size', row.quantity);
      }
      const size = parsePortionAmount(portion);
      if (size) {
        addAmount(acc.amount, size, row.quantity);
        acc.sized += row.quantity;
      }
    }
  }

  const itemList: KitchenItem[] = [...items.entries()]
    .map(([name, acc]) => {
      const portions = toSizeLines(acc.portions);
      // a single "No size" line adds nothing to the total, so it is left out
      const showPortions = portions.length > 1 || (portions.length === 1 && portions[0].label !== 'No size');
      return {
        name,
        quantity: acc.total,
        inCombos: acc.inCombos,
        portions: showPortions ? portions : [],
        spice: toSpiceLines(acc.spice),
        eco: acc.eco,
        ecoBySize: toSizeLines(acc.ecoBySize),
        totalText: formatAmount(acc.amount),
        unsized: acc.sized > 0 ? acc.total - acc.sized : 0,
        deliveries: toDateLines(acc.deliveries),
      };
    })
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

  const comboList: KitchenCombo[] = [...combos.entries()]
    .map(([name, c]) => ({
      name,
      quantity: c.quantity,
      spice: toSpiceLines(c.spice),
      eco: c.eco,
      parts: [...c.parts.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
      deliveries: toDateLines(c.deliveries),
    }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

  return {
    items: itemList,
    combos: comboList,
    totals: {
      units: itemList.reduce((sum, i) => sum + i.quantity, 0) - itemList.reduce((s, i) => s + i.inCombos, 0) + comboList.reduce((s, c) => s + c.quantity, 0),
      orders: orderIds.size,
      ecoContainers,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Tracing an item back to the people who ordered it
// ---------------------------------------------------------------------------------------------

export interface ItemOrderLine {
  orderId: string;
  customerName: string;
  /** The menu day the item was picked for. */
  day: string;
  /** The day it is finally delivered (the same as `day` unless that day was combined into another). */
  deliveredOn: string | null;
  quantity: number;
  /** The size of this item in this order, when it has one. */
  portion: string | null;
  spice: string | null;
  isEco: boolean;
  /** Set when the item is a chosen part of this combo rather than ordered on its own. */
  viaCombo: string | null;
  /** How much food this order line is, size times quantity ('32 oz (2 lb)'); '' when the item has no readable size (a combo, 'Serves 4'). */
  amountText: string;
  /** For a combo ordered on its own: what this customer picked in it, one line per section ('Veg Curry of the Day: Kale Chane (12Oz)'). */
  choices: string[];
  orderStatus: string | null;
}

/**
 * The order lines behind the number of one item: orders that contain it on its own, and orders where it
 * is a chosen part of a combo. A combo itself can be traced the same way (by the combo's name). Optionally
 * only one menu day. The quantities add up to the item's quantity in the kitchen counts.
 */
export function buildItemOrders(rows: KitchenRow[], itemName: string, day?: string): ItemOrderLine[] {
  const wanted = clean(itemName);
  if (!wanted) return [];
  const lines: ItemOrderLine[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0 || !clean(row.name)) continue;
    if (day && row.day !== day) continue;
    const base = {
      orderId: row.orderId,
      customerName: clean(row.customerName) || 'Unknown customer',
      day: row.day,
      deliveredOn: row.deliveredOn ?? null,
      isEco: Boolean(row.isEco),
      orderStatus: row.orderStatus ?? null,
    };
    const parts = comboParts(row);
    if (parts.length > 0) {
      if (clean(row.name) === wanted) {
        lines.push({ ...base, quantity: row.quantity, portion: null, spice: clean(row.spiceLevel) || null, viaCombo: null, amountText: '', choices: comboChoiceLines(row) });
      }
      for (const part of parts) {
        if (part.name === wanted) {
          lines.push({ ...base, quantity: row.quantity, portion: part.portion, spice: null, viaCombo: clean(row.name), amountText: amountTextOf(part.portion, row.quantity), choices: [] });
        }
      }
    } else if (clean(row.name) === wanted) {
      lines.push({ ...base, quantity: row.quantity, portion: clean(row.portion) || null, spice: clean(row.spiceLevel) || null, viaCombo: null, amountText: amountTextOf(row.portion, row.quantity), choices: [] });
    }
  }
  // spice level first (mild to hot, no spice last), then the size on the order (16Oz before 12Oz before 8Oz, no size
  // last), then the customer's name, so all the orders of one person for the same spice and size sit together; every
  // order line is listed (nothing is merged)
  return lines.sort(
    (a, b) =>
      spiceRank(a.spice) - spiceRank(b.spice) ||
      clean(a.spice).localeCompare(clean(b.spice)) ||
      sizeRank(b.portion) - sizeRank(a.portion) ||
      a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }) ||
      b.quantity - a.quantity ||
      a.day.localeCompare(b.day) ||
      a.orderId.localeCompare(b.orderId)
  );
}

/** The food amount of an order line as text ('32 oz (2 lb)'), '' without a readable size. */
function amountTextOf(portion: string | null | undefined, quantity: number): string {
  const size = parsePortionAmount(portion);
  if (!size) return '';
  const total = emptyAmount();
  addAmount(total, size, quantity);
  return formatAmount(total);
}

/** How big a size label is, for sorting (ounces; grams count as ounces too); labels with no readable size are the smallest. */
export function sizeRank(portion: string | null | undefined): number {
  const amount = parsePortionAmount(portion);
  if (!amount) return -1;
  return amount.oz + amount.grams / 28.3495 + amount.pieces;
}

/** Where a spice level stands from mild to hot; levels we do not know come after the known ones, no spice last. */
export function spiceRank(level: string | null | undefined): number {
  const s = clean(level).toLowerCase();
  if (!s) return 99;
  if (s.includes('mild')) return 1;
  if (s.includes('normal') || s.includes('regular')) return 2;
  if (s.includes('medium')) return 3;
  if (s.includes('extra') || s.includes('very')) return 6;
  if (s.includes('spicy')) return 4;
  if (s.includes('hot')) return 5;
  return 50;
}

/** What one customer picked inside a combo, one line per section: 'Veg Curry of the Day: Kale Chane (12Oz)'. */
export function comboChoiceLines(row: Pick<KitchenRow, 'sections' | 'comboSelections'>): string[] {
  if (!row.sections?.length || !row.comboSelections) return [];
  const lines: string[] = [];
  for (const section of row.sections) {
    const picked = (section._id && row.comboSelections[section._id]) || [];
    const names: string[] = [];
    for (const id of picked) {
      const option = section.selectedItems?.find((si) => si._id === id);
      const name = clean(option?.item?.name);
      if (!name) continue;
      const portion = clean(option?.portion);
      names.push(portion ? `${name} (${portion})` : name);
    }
    if (names.length > 0) lines.push(`${clean(section.title) || 'Choice'}: ${names.join(', ')}`);
  }
  return lines;
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
