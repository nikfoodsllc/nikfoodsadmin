/**
 * Backfill of the combo item quantity (Chapati x 4) onto orders that are placed but not yet delivered.
 *
 * An order keeps its own frozen copy of the combo, so orders placed before the quantity was set in the combo editor still say
 * "1 Chapati". This works out, for those orders, which options of the frozen copy should get the combo's CURRENT quantity.
 * Pure functions (no database, no network) so they can be checked on their own. Past orders are never touched.
 */
import { toDayString } from './kitchenDashboard';

/** The combo as it is now in the food items: its options and how many of each come with one combo. */
export interface CurrentCombo {
  id: string;
  sections: Array<{ _id?: string; title?: string; options: Array<{ itemId: string; quantity: number }> }>;
}

interface SnapshotOption {
  item?: { _id?: unknown } | null;
  quantity?: unknown;
}

export interface OrderLike {
  orderId?: string;
  status?: string;
  paymentStatus?: string;
  items?: Array<{
    deliveryDate?: unknown;
    actualDeliveryDate?: unknown;
    items?: Array<{
      food?: {
        _id?: unknown;
        name?: string;
        hasCombo?: boolean;
        sections?: Array<{ _id?: unknown; title?: string; selectedItems?: SnapshotOption[] }>;
      } | null;
    }>;
  }>;
}

export interface PlannedChange {
  orderId: string;
  combo: string;
  /** Where the quantity goes in the order document, e.g. items.0.items.1.food.sections.2.selectedItems.0.quantity */
  path: string;
  /** The option's food item id at that place: the write only happens when it is still there (so a changed order is never hit by mistake) */
  guardPath: string;
  guardId: string;
  quantity: number;
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const clean = (v: unknown): string => str(v).replace(/\s+/g, ' ').trim();

/** Orders that no longer go out: nothing to fix there. */
export function isLiveOrder(order: Pick<OrderLike, 'status' | 'paymentStatus'>): boolean {
  const status = clean(order.status).toLowerCase();
  const pay = clean(order.paymentStatus).toLowerCase();
  if (['cancelled', 'canceled', 'delivered', 'failed'].includes(status)) return false;
  if (['failed', 'refunded'].includes(pay)) return false;
  return true;
}

/** The current section that matches an order's section: same id, else the same title. */
function matchSection(current: CurrentCombo, snap: { _id?: unknown; title?: string }, index: number) {
  const id = str(snap._id);
  if (id) {
    const byId = current.sections.find((s) => str(s._id) === id);
    if (byId) return byId;
  }
  const title = clean(snap.title).toLowerCase();
  const sameTitle = current.sections.filter((s) => clean(s.title).toLowerCase() === title);
  if (sameTitle.length === 1) return sameTitle[0];
  return current.sections[index] && clean(current.sections[index].title).toLowerCase() === title ? current.sections[index] : undefined;
}

/**
 * What to write for one order: every option of a combo line (delivered on `fromDate` or later) whose frozen copy has no quantity
 * while the combo now says more than 1 for that item. Options that already carry a quantity are left as they were ordered.
 */
export function planOrderChanges(order: OrderLike, combosById: Map<string, CurrentCombo>, fromDate: string): PlannedChange[] {
  if (!order.orderId || !isLiveOrder(order)) return [];
  const changes: PlannedChange[] = [];
  (order.items ?? []).forEach((day, i) => {
    const delivery = toDayString(day.actualDeliveryDate) ?? toDayString(day.deliveryDate);
    if (!delivery || delivery < fromDate) return;
    (day.items ?? []).forEach((line, j) => {
      const food = line.food;
      const combo = food?._id ? combosById.get(str(food._id)) : undefined;
      if (!food || !combo || !Array.isArray(food.sections)) return;
      food.sections.forEach((section, k) => {
        const match = matchSection(combo, section, k);
        if (!match) return;
        (section.selectedItems ?? []).forEach((option, m) => {
          if (option.quantity !== undefined && option.quantity !== null) return; // ordered with a quantity: keep it
          const itemId = str(option.item?._id);
          const wanted = match.options.find((o) => o.itemId === itemId)?.quantity ?? 1;
          if (!itemId || wanted <= 1) return;
          const base = `items.${i}.items.${j}.food.sections.${k}.selectedItems.${m}`;
          changes.push({ orderId: order.orderId as string, combo: clean(food.name), path: `${base}.quantity`, guardPath: `${base}.item._id`, guardId: itemId, quantity: wanted });
        });
      });
    });
  });
  return changes;
}

export interface BackfillSummary {
  ordersChecked: number;
  ordersToChange: number;
  optionsToChange: number;
  /** per combo name: how many options and orders */
  byCombo: Array<{ combo: string; options: number; orders: number }>;
  /** the order numbers that would change / changed (order ids only) */
  orderIds: string[];
}

export function summarizeChanges(changes: PlannedChange[], ordersChecked: number): BackfillSummary {
  const orders = new Set(changes.map((c) => c.orderId));
  const per = new Map<string, { options: number; orders: Set<string> }>();
  for (const c of changes) {
    const entry = per.get(c.combo) ?? { options: 0, orders: new Set<string>() };
    entry.options += 1;
    entry.orders.add(c.orderId);
    per.set(c.combo, entry);
  }
  return {
    ordersChecked,
    ordersToChange: orders.size,
    optionsToChange: changes.length,
    byCombo: [...per.entries()].map(([combo, v]) => ({ combo, options: v.options, orders: v.orders.size })).sort((a, b) => a.combo.localeCompare(b.combo)),
    orderIds: [...orders].sort(),
  };
}
