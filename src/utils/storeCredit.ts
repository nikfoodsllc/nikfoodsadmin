/**
 * Store credit for items of an order (admin). The live site does the crediting
 * (see livesite/src/lib/storeCredit.ts and lib/server/storeCreditIssue.ts): keep these rules in step.
 *
 * A credited item is worth its price (portion and eco container included, as stored on the order line) x quantity,
 * plus, only when the admin chooses, the 10.3% tax charged on it (withheld by default). The Platform Fee, the tax on it and the tip are never credited.
 */
export const CREDIT_TAX_RATE = 0.103;

export const toCents = (dollars: number): number => Math.round((Number(dollars) || 0) * 100 + 1e-9);

export function creditForItemCents(unitPrice: number, quantity: number, includeTax = false): number {
  const base = toCents(unitPrice) * Math.max(0, Math.floor(Number(quantity) || 0));
  return includeTax ? base + Math.round(base * CREDIT_TAX_RATE) : base;
}

export interface CreditOrderLike {
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  user?: string | null;
  items?: Array<{ items?: Array<{ quantity?: number | null; price?: number | null; food?: { name?: string | null } | null }> | null }> | null;
  creditsIssued?: Array<{ items?: Array<{ line: number; item: number; quantity: number }> | null }> | null;
}

/** Why credit cannot be given on this order, or null when it can (the same rule the live site applies). */
export function whyNotCreditable(order: CreditOrderLike): string | null {
  if (order.paymentStatus !== 'paid') return 'Credit can only be given for a paid order.';
  if (order.status === 'cancelled') return 'This order is cancelled.';
  if (String(order.paymentMethod ?? '').toLowerCase() === 'quote') return 'A quote was never charged, so there is nothing to credit.';
  if (!order.user) return 'This order has no customer account to give credit to.';
  if (!order.items || order.items.length === 0) return 'This order has no items.';
  return null;
}

/** How many of each item (key 'line:item') were already credited. */
export function creditedQuantities(order: CreditOrderLike): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of order.creditsIssued ?? []) {
    for (const it of entry.items ?? []) {
      const key = `${it.line}:${it.item}`;
      map.set(key, (map.get(key) ?? 0) + (Number(it.quantity) || 0));
    }
  }
  return map;
}

/** How many of an item can still be credited. */
export function creditLeft(order: CreditOrderLike, line: number, item: number): number {
  const ordered = order.items?.[line]?.items?.[item]?.quantity ?? 0;
  return Math.max(0, ordered - (creditedQuantities(order).get(`${line}:${item}`) ?? 0));
}

export interface CreditPick {
  line: number;
  item: number;
  name: string;
  quantity: number;
  left: number;
  cents: number;
}

/** The picked items ('line:item' keys) with how much each is worth; items already credited in full are skipped. */
export function creditPicks(order: CreditOrderLike, keys: Iterable<string>, quantities: Record<string, number> = {}, includeTax = false): CreditPick[] {
  const picks: CreditPick[] = [];
  for (const key of keys) {
    const [line, item] = key.split(':').map(Number);
    const dayItem = order.items?.[line]?.items?.[item];
    if (!dayItem) continue;
    const left = creditLeft(order, line, item);
    if (left === 0) continue;
    const quantity = Math.min(left, Math.max(1, Math.floor(quantities[key] ?? left)));
    picks.push({ line, item, name: dayItem.food?.name ?? 'Item', quantity, left, cents: creditForItemCents(dayItem.price ?? 0, quantity, includeTax) });
  }
  return picks.sort((a, b) => a.line - b.line || a.item - b.item);
}

export const centsToMoney = (cents: number): string => `$${(Math.round(cents) / 100).toFixed(2)}`;
