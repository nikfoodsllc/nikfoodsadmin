/**
 * The portion to show for an ordered item, or null when there is nothing to show.
 *
 * Newer orders store the portion's name in `selectedPortion`. Older orders stored an index into the
 * food item's `portions` list. Items without portions have `portions: null` (or no field at all),
 * which used to be printed as "Portion: #null".
 */
export interface ItemWithPortion {
  selectedPortion?: string | null;
  portions?: number | null;
  food?: { portions?: string[] | null } | null;
}

export function getItemPortionLabel(item: ItemWithPortion): string | null {
  const name = typeof item.selectedPortion === 'string' ? item.selectedPortion.trim() : '';
  if (name) return name;

  const index = item.portions;
  if (typeof index !== 'number' || !Number.isFinite(index)) return null; // no portion on this item

  const fromList = item.food?.portions?.[index];
  if (typeof fromList === 'string' && fromList.trim()) return fromList.trim();

  return `#${index}`; // an old index with no name to look up (kept as before)
}
