/**
 * How many of an item come with ONE combo (set per item in the admin's combo editor, e.g. Chapati x 4).
 * Missing, zero or odd values mean 1, so combos saved before this existed behave exactly as before.
 */
export function comboItemQuantity(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : 1;
}

/** ' × 4' for 4, '' for 1: appended to an item's name where a combo's choices are listed. */
export function comboQuantityText(value: unknown): string {
  const n = comboItemQuantity(value);
  return n > 1 ? ` × ${n}` : '';
}
