/**
 * A food item that offers an eco container must say what it costs: the toggle on with an empty (0) charge would let
 * customers add the container for free. Returns the message to show, or null when fine.
 */
export const ECO_CHARGE_REQUIRED = 'Enter the eco container charge';

export function ecoChargeError(isEcoFriendlyContainer: unknown, ecoContainerCharge: unknown): string | null {
  if (!isEcoFriendlyContainer) return null;
  const charge = typeof ecoContainerCharge === 'number' ? ecoContainerCharge : Number.NaN;
  return Number.isFinite(charge) && charge > 0 ? null : ECO_CHARGE_REQUIRED;
}
