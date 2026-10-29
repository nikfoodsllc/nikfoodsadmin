import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { STOCK_HOLD_MINUTES, amountIn, cleanAlertPercent, cleanStockUnit, cleanThreshold, lineAmounts, stockLevel, stockSince, stockState, type StockClock, type StockLineInput, type StockState, type StockUnit } from '@/utils/stockRules';

/** Which orders use up stock: the ones the kitchen counts, plus orders waiting for payment for a short while. (Same rule as the customer site.) */
function usedStockClauses(now: Date) {
  return [
    { paymentStatus: 'paid' },
    { status: { $in: ['preparing', 'ready', 'out_for_delivery', 'partially_delivered', 'delivered'] }, paymentStatus: { $nin: ['failed', 'refunded'] } },
    { countBeforePayment: true, paymentStatus: { $nin: ['failed', 'refunded'] } },
    { paymentStatus: 'pending', createdAt: { $gte: new Date(now.getTime() - STOCK_HOLD_MINUTES * 60_000) } },
  ];
}

export interface StockedItem {
  id: string;
  since: Date;
  unit: StockUnit;
}

/** Amounts ordered of each item since its own start moment, in the base of its limit (units, or ounces), also inside combos. Items nobody ordered are 0. */
export async function orderedUnits(items: StockedItem[], now: Date = new Date()): Promise<Map<string, number>> {
  const totals = new Map<string, number>(items.map((i) => [i.id, 0]));
  if (items.length === 0) return totals;
  const ids = items.map((i) => i.id);
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const earliest = new Date(Math.min(...items.map((i) => i.since.getTime())));
  const by = new Map(items.map((i) => [i.id, i]));
  const result = await db.aggregate('orders', [
    { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: earliest }, $or: usedStockClauses(now) } },
    { $unwind: '$items' },
    { $unwind: '$items.items' },
    { $match: { $or: [{ 'items.items.food._id': { $in: [...ids, ...objectIds] } }, { 'items.items.food.sections.0': { $exists: true } }] } },
    { $project: { _id: 0, food: { _id: '$items.items.food._id', sections: '$items.items.food.sections' }, selectedPortion: '$items.items.selectedPortion', quantity: '$items.items.quantity', comboSelections: '$items.items.comboSelections', createdAt: 1 } },
  ]);
  if (!result.success) throw new Error(result.error || 'Could not count the orders');
  for (const row of (result.data ?? []) as Array<StockLineInput & { selectedPortion?: unknown; createdAt: unknown }>) {
    const at = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(String(row.createdAt)).getTime();
    for (const [foodId, amount] of lineAmounts(row)) {
      const item = by.get(foodId);
      if (!item || !(at >= item.since.getTime())) continue;
      totals.set(foodId, (totals.get(foodId) ?? 0) + amountIn(amount, item.unit));
    }
  }
  return totals;
}

export interface StockDoc extends StockClock {
  _id: unknown;
  stockThreshold?: unknown;
  stockUnit?: unknown;
  stockAlertPercent?: unknown;
}

export interface ItemStock extends StockState {
  /** the count started at this moment (the limit was set, a manual reset, or the last daily reset) */
  since: string;
  /** the share of the limit at which the team is warned (default 10) */
  alertPercent: number;
  /** 'low' once what is left is at or under the alert share, 'out' at the limit */
  level: 'none' | 'ok' | 'low' | 'out';
}

/** The limit, the units ordered since the count started, and what is left, for the items that have a limit. */
export async function stockOf(docs: StockDoc[], now: Date = new Date()): Promise<Map<string, ItemStock>> {
  const out = new Map<string, ItemStock>();
  const limited = docs.filter((d) => cleanThreshold(d.stockThreshold, cleanStockUnit(d.stockUnit)) !== null);
  if (limited.length === 0) return out;
  const items = limited.map((d) => ({ id: String(d._id), since: stockSince(d, now), unit: cleanStockUnit(d.stockUnit) }));
  const counts = await orderedUnits(items, now);
  for (const d of limited) {
    const id = String(d._id);
    const unit = cleanStockUnit(d.stockUnit);
    const state = stockState(d.stockThreshold, counts.get(id) ?? 0, unit);
    out.set(id, { ...state, since: stockSince(d, now).toISOString(), alertPercent: cleanAlertPercent(d.stockAlertPercent), level: stockLevel(state, d.stockAlertPercent) });
  }
  return out;
}
