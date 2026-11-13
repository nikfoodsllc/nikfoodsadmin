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

/** The food item ids of the options inside a combo line's sections. */
export function comboPartIds(sections: unknown): string[] {
  const ids: string[] = [];
  if (!Array.isArray(sections)) return ids;
  for (const section of sections as Array<{ selectedItems?: Array<{ item?: { _id?: unknown } | null }> }>) {
    for (const option of section?.selectedItems ?? []) {
      const id = option?.item?._id;
      if (id) ids.push(String(id));
    }
  }
  return ids;
}

/**
 * The same lines counting pieces: a plain line's ordered quantity is multiplied by the item's quantity per order; a combo line keeps its
 * quantity and gets `partUnits` (the quantity per order of the items inside it), which the combo's parts are multiplied by.
 */
export function scaleRowsByUnitQuantity<T extends { foodId?: string | null; quantity: number; sections?: unknown; partUnits?: Record<string, number> | null }>(rows: T[], unitByFoodId: Map<string, number>): T[] {
  if (unitByFoodId.size === 0) return rows;
  return rows.map((row) => {
    if (Array.isArray(row.sections) && row.sections.length > 0) {
      const partUnits: Record<string, number> = {};
      for (const id of comboPartIds(row.sections)) {
        const unit = cleanUnitQuantity(unitByFoodId.get(id));
        if (unit > 1) partUnits[id] = unit;
      }
      return Object.keys(partUnits).length > 0 ? { ...row, partUnits } : row;
    }
    if (!row.foodId) return row;
    const unit = cleanUnitQuantity(unitByFoodId.get(row.foodId));
    return unit > 1 ? { ...row, quantity: row.quantity * unit } : row;
  });
}
