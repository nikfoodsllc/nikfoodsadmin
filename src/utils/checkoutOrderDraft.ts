/**
 * Turns the cart a customer left in checkout (the saved `cartLines` of their checkout draft) into the picks the Create Order
 * form starts from, so an admin can make the order for them. Only the choices travel (item, day, size, spice, eco container,
 * combo parts, note, quantity): the form works out prices and tags from the live menu.
 */

export interface DraftCartLine {
  date?: string;
  foodItem?: { _id?: unknown };
  quantity?: number;
  selectedPortion?: string;
  selectedSpiceLevel?: string;
  isEcoFriendlyContainer?: boolean;
  comboSelections?: Record<string, string[]>;
  notes?: string;
}

export interface OrderDraftLine {
  date: string;
  foodItemId: string;
  quantity: number;
  selectedPortion?: string;
  selectedSpiceLevel?: string;
  isEcoFriendlyContainer?: boolean;
  comboSelections?: Record<string, string[]>;
  notes?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function orderDraftLines(cartLines: DraftCartLine[] | undefined): OrderDraftLine[] {
  const out: OrderDraftLine[] = [];
  for (const l of cartLines ?? []) {
    const id = l.foodItem?._id;
    const date = String(l.date ?? '').slice(0, 10);
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(l.quantity) || 1)));
    if (id === undefined || id === null || !DAY_RE.test(date)) continue;
    const combo = Object.fromEntries(Object.entries(l.comboSelections ?? {}).filter(([, ids]) => Array.isArray(ids) && ids.length > 0));
    out.push({
      date,
      foodItemId: String(id),
      quantity,
      ...(l.selectedPortion ? { selectedPortion: l.selectedPortion } : {}),
      ...(l.selectedSpiceLevel ? { selectedSpiceLevel: l.selectedSpiceLevel } : {}),
      ...(l.isEcoFriendlyContainer ? { isEcoFriendlyContainer: true } : {}),
      ...(Object.keys(combo).length > 0 ? { comboSelections: combo } : {}),
      ...(l.notes ? { notes: String(l.notes).slice(0, 300) } : {}),
    });
  }
  return out;
}
