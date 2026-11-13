/**
 * "Quantity per order" of a simple food item (admin reporting only, customers never see it).
 *
 * A shop sells "Makki Roti" only in twos, so the item is called "2 Makki Roti" and one order of it makes 2 rotis. With
 * a quantity of 2 on the item, the Kitchen Dashboard and the Kitchen Report count pieces (an order of 3 = 6 rotis) and
 * nobody has to multiply by hand. Missing, 1 or anything that is not a whole number from 2 to 99 means "one per order".
 */
export const MAX_UNIT_QUANTITY = 99;

export function cleanUnitQuantity(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 2) return 1;
  return Math.min(MAX_UNIT_QUANTITY, n);
}

/** The same lines with the ordered quantity multiplied by the item's quantity per order. Combos (lines with sections) are left alone. */
export function scaleRowsByUnitQuantity<T extends { foodId?: string | null; quantity: number; sections?: unknown }>(rows: T[], unitByFoodId: Map<string, number>): T[] {
  if (unitByFoodId.size === 0) return rows;
  return rows.map((row) => {
    if (!row.foodId || (Array.isArray(row.sections) && row.sections.length > 0)) return row;
    const unit = cleanUnitQuantity(unitByFoodId.get(row.foodId));
    return unit > 1 ? { ...row, quantity: row.quantity * unit } : row;
  });
}
