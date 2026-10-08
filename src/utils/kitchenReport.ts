/**
 * The Kitchen Report: what the kitchen cooks (one block per cooked item, who ordered it, how much), the ready-to-eat
 * items to pack with a sticker, and what is still unclassified. It reads the same order lines as the Kitchen Dashboard
 * (an item belongs to the menu day it was picked for), so the numbers agree.
 *
 * - A combo is not an item to cook: its chosen parts (chapati, rice, a curry ...) are, each with its own size, and they
 *   say which combo they came with.
 * - How an item is prepared (cooked or ready to eat) is a setting of the food item. Items without one go to a separate
 *   "not set yet" list instead of being dropped, so nothing is silently missing from the report.
 *
 * Pure functions with no database access.
 */
import {
  addAmount,
  amountTextOf,
  comboParts,
  emptyAmount,
  formatAmount,
  matchesSearch,
  parsePortionAmount,
  sizeRank,
  spiceRank,
  type KitchenRow,
} from './kitchenDashboard';
import type { PreparationType } from './preparationType';

export type PrepGroup = 'cooked' | 'ready_to_eat' | 'not_set';

/** One order line of an item: who ordered it, how much, which spice. */
export interface PrepLine {
  orderId: string;
  customerName: string;
  /** The day the order was placed */
  orderedOn: string | null;
  /** The menu (kitchen) day */
  day: string;
  /** The day it is delivered, when that is later than the kitchen day */
  deliveredOn: string | null;
  /** The day it is delivered: the kitchen day, or the later day it was combined into or moved to */
  deliveryDate: string;
  /** Set when an admin moved this item to another date: the kitchen day it was first picked for */
  movedFrom: string | null;
  quantity: number;
  portion: string | null;
  spice: string | null;
  isEco: boolean;
  /** Set when the item is a chosen part of a combo: the combo's name and the spice level of that combo */
  viaCombo: string | null;
  viaSpice: string | null;
  /** Size times quantity ('32 oz (2 lb)'), '' when the item has no readable size */
  amountText: string;
}

export interface PrepBlock {
  name: string;
  group: PrepGroup;
  /** Units to make */
  quantity: number;
  /** Total amount where the sizes are known ('84 oz (5.25 lb)'), '' when no size is known (then `quantity` is the number of pieces) */
  totalText: string;
  /** Units without a readable size, so not in `totalText` */
  unsized: number;
  /** Units that come in an eco container */
  eco: number;
  lines: PrepLine[];
}

export interface StickerLine {
  item: string;
  customerName: string;
  orderId: string;
  orderedOn: string | null;
  day: string;
  deliveredOn: string | null;
  deliveryDate: string;
  movedFrom: string | null;
  portion: string | null;
  quantity: number;
  spice: string | null;
  isEco: boolean;
  viaCombo: string | null;
}

export interface KitchenReport {
  cooked: PrepBlock[];
  notSet: PrepBlock[];
  readyToEat: PrepBlock[];
  /** The ready-to-eat items, one line per customer order line, in the order they go out */
  stickers: StickerLine[];
}

/** How an item is prepared, looked up by its id (when the order has one) or its name. */
export type TypeLookup = (food: { id?: string | null; name: string }) => PreparationType | null;

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

interface Atom {
  name: string;
  id: string | null;
  line: PrepLine;
}

/** Every thing to make or pack: the items ordered on their own and the parts chosen inside combos. */
function atomsOf(rows: KitchenRow[]): Atom[] {
  const atoms: Atom[] = [];
  for (const row of rows) {
    const name = clean(row.name);
    if (!Number.isFinite(row.quantity) || row.quantity <= 0 || !name) continue;
    const base = {
      orderId: row.orderId,
      customerName: clean(row.customerName) || 'Unknown customer',
      orderedOn: row.orderedOn ?? null,
      day: row.day,
      deliveredOn: row.deliveredOn && row.deliveredOn !== row.day ? row.deliveredOn : null,
      deliveryDate: row.deliveredOn || row.day,
      movedFrom: row.movedFrom && row.movedFrom !== row.day ? row.movedFrom : null,
    };
    const parts = comboParts(row);
    if (parts.length > 0) {
      for (const part of parts) {
        atoms.push({
          name: part.name,
          id: part.id ?? null,
          line: { ...base, quantity: row.quantity, portion: part.portion, spice: null, isEco: false, viaCombo: name, viaSpice: clean(row.spiceLevel) || null, amountText: amountTextOf(part.portion, row.quantity) },
        });
      }
    } else {
      atoms.push({
        name,
        id: row.foodId ? String(row.foodId) : null,
        line: { ...base, quantity: row.quantity, portion: clean(row.portion) || null, spice: clean(row.spiceLevel) || null, isEco: Boolean(row.isEco), viaCombo: null, viaSpice: null, amountText: amountTextOf(row.portion, row.quantity) },
      });
    }
  }
  return atoms;
}

/** Spice level first (mild to hot, none last), then the size smallest first (8, 12, 16, 32 like Kunal's sheet), then the customer's name, then everything else so the order is stable. */
function compareLines(a: PrepLine, b: PrepLine): number {
  return (
    spiceRank(a.spice) - spiceRank(b.spice) ||
    clean(a.spice).localeCompare(clean(b.spice)) ||
    sizeRank(a.portion) - sizeRank(b.portion) ||
    a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }) ||
    b.quantity - a.quantity ||
    a.day.localeCompare(b.day) ||
    a.orderId.localeCompare(b.orderId)
  );
}

function blockOf(name: string, group: PrepGroup, lines: PrepLine[]): PrepBlock {
  const amount = emptyAmount();
  let quantity = 0;
  let sized = 0;
  let eco = 0;
  for (const line of lines) {
    quantity += line.quantity;
    if (line.isEco) eco += line.quantity;
    const size = parsePortionAmount(line.portion);
    if (size) {
      addAmount(amount, size, line.quantity);
      sized += line.quantity;
    }
  }
  const totalText = formatAmount(amount);
  return { name, group, quantity, totalText, unsized: sized > 0 ? quantity - sized : 0, eco, lines: [...lines].sort(compareLines) };
}

export function buildKitchenReport(rows: KitchenRow[], typeOf: TypeLookup): KitchenReport {
  const groups = new Map<string, { name: string; group: PrepGroup; lines: PrepLine[] }>();
  const stickers: StickerLine[] = [];
  for (const atom of atomsOf(rows)) {
    const type = typeOf({ id: atom.id, name: atom.name });
    const group: PrepGroup = type === 'cooked' ? 'cooked' : type === 'ready_to_eat' ? 'ready_to_eat' : 'not_set';
    // two different food items can share a name; one block per name and way of preparing
    const key = `${group}\u0000${atom.name}`;
    const entry = groups.get(key) ?? { name: atom.name, group, lines: [] };
    entry.lines.push(atom.line);
    groups.set(key, entry);
    if (group === 'ready_to_eat') {
      stickers.push({
        item: atom.name,
        customerName: atom.line.customerName,
        orderId: atom.line.orderId,
        orderedOn: atom.line.orderedOn,
        day: atom.line.day,
        deliveredOn: atom.line.deliveredOn,
        deliveryDate: atom.line.deliveryDate,
        movedFrom: atom.line.movedFrom,
        portion: atom.line.portion,
        quantity: atom.line.quantity,
        spice: atom.line.spice,
        isEco: atom.line.isEco,
        viaCombo: atom.line.viaCombo,
      });
    }
  }
  const blocks = [...groups.values()].map((g) => blockOf(g.name, g.group, g.lines)).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  stickers.sort(
    (a, b) =>
      a.deliveryDate.localeCompare(b.deliveryDate) ||
      a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }) ||
      a.item.localeCompare(b.item, undefined, { sensitivity: 'base' }) ||
      a.orderId.localeCompare(b.orderId)
  );
  return {
    cooked: blocks.filter((b) => b.group === 'cooked'),
    notSet: blocks.filter((b) => b.group === 'not_set'),
    readyToEat: blocks.filter((b) => b.group === 'ready_to_eat'),
    stickers,
  };
}

/** What to write as an item's total: the amount ('300 oz (18.75 lb)') or, without sizes, the number of pieces. */
export function blockTotal(block: Pick<PrepBlock, 'totalText' | 'quantity'>): string {
  return block.totalText || `${block.quantity} ${block.quantity === 1 ? 'unit' : 'units'}`;
}

// ---------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------

/**
 * Keeps the item cards that match a search: by the item's name (then every line stays), or by a customer, the order
 * number or the combo a line came with (then only those lines stay). An empty query keeps everything.
 */
export function filterBlocksBySearch(blocks: PrepBlock[], query: string): PrepBlock[] {
  if (!query.trim()) return blocks;
  const out: PrepBlock[] = [];
  for (const block of blocks) {
    if (matchesSearch(block.name, query)) {
      out.push(block);
      continue;
    }
    const lines = block.lines.filter((l) => matchesSearch(`${l.customerName} ${l.orderId} ${l.viaCombo ?? ''}`, query));
    if (lines.length > 0) out.push({ ...block, lines, quantity: lines.reduce((s, l) => s + l.quantity, 0), eco: lines.filter((l) => l.isEco).reduce((s, l) => s + l.quantity, 0), totalText: sumText(lines), unsized: 0 });
  }
  return out;
}

export function filterStickersBySearch(stickers: StickerLine[], query: string): StickerLine[] {
  if (!query.trim()) return stickers;
  return stickers.filter((s) => matchesSearch(`${s.item} ${s.customerName} ${s.orderId} ${s.viaCombo ?? ''}`, query));
}

function sumText(lines: PrepLine[]): string {
  const amount = emptyAmount();
  for (const line of lines) {
    const size = parsePortionAmount(line.portion);
    if (size) addAmount(amount, size, line.quantity);
  }
  return formatAmount(amount);
}

/** A number with the unit it is written in (oz, lb or units). */
export interface Measured {
  n: number;
  unit: 'oz' | 'lb' | 'units';
}

/**
 * The numbers for an item's box in the Excel file, like Kunal's sheet but with the unit written next to every number:
 * every line's amount in ounces and the item's total in pounds when all sizes are ounces / pounds; the number of
 * units for an item without sizes; otherwise the text.
 */
export function sheetAmounts(block: Pick<PrepBlock, 'lines' | 'totalText' | 'quantity'>): { values: Array<Measured | string>; total: Measured | string } {
  const sizes = block.lines.map((l) => parsePortionAmount(l.portion));
  const round = (n: number) => Math.round(n * 100) / 100;
  if (sizes.every((s) => s && s.oz > 0 && s.grams === 0 && s.pieces === 0)) {
    const ounces = block.lines.map((l, k) => round((sizes[k] as { oz: number }).oz * l.quantity));
    return { values: ounces.map((n) => ({ n, unit: 'oz' as const })), total: { n: round(ounces.reduce((a, b) => a + b, 0) / 16), unit: 'lb' } };
  }
  if (sizes.every((s) => !s)) {
    return { values: block.lines.map((l) => ({ n: l.quantity, unit: 'units' as const })), total: { n: block.quantity, unit: 'units' } };
  }
  return { values: block.lines.map((l) => l.amountText || `${l.quantity} ${l.quantity === 1 ? 'unit' : 'units'}`), total: blockTotal(block) };
}
