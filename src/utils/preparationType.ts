/**
 * How a food item is prepared, for kitchen reporting.
 *  - cooked:        made fresh for that day's menu (chapati, rajma, ...)
 *  - ready_to_eat:  already made and only packed for delivery (pickles, sweets, ...)
 * An item with neither is "not set yet".
 */
export type PreparationType = 'cooked' | 'ready_to_eat';

export const PREPARATION_TYPES: PreparationType[] = ['cooked', 'ready_to_eat'];

export const NOT_SET_LABEL = '(not set yet)';

const LABELS: Record<PreparationType, string> = {
  cooked: 'Cooked',
  ready_to_eat: 'Ready to eat',
};

export function isPreparationType(value: unknown): value is PreparationType {
  return value === 'cooked' || value === 'ready_to_eat';
}

/** 'Cooked', 'Ready to eat' or '(not set yet)' for anything else. */
export function preparationTypeLabel(value: unknown): string {
  return isPreparationType(value) ? LABELS[value] : NOT_SET_LABEL;
}

/** The value to keep from a stored or typed value: a valid type, or null for "not set". */
export function normalizePreparationType(value: unknown): PreparationType | null {
  return isPreparationType(value) ? value : null;
}

/**
 * A NEW food item must have a preparation type (Cooked or Ready to eat), so the kitchen reports are complete from
 * day one. Items that already exist may stay "not set yet". Returns the message to show, or null when fine.
 */
export function preparationTypeError(isNew: boolean, value: unknown): string | null {
  return isNew && !isPreparationType(value) ? 'Choose Cooked or Ready to eat' : null;
}

/** The list filter on the Food Items page: everything, one type, or only items still to be classified. */
export type PreparationFilter = 'all' | PreparationType | 'not_set';

export function isPreparationFilter(value: unknown): value is PreparationFilter {
  return value === 'all' || value === 'not_set' || isPreparationType(value);
}

/** Whether an item passes the filter (used by the page for the selection count and by tests). */
export function matchesPreparationFilter(value: unknown, filter: PreparationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'not_set') return !isPreparationType(value);
  return value === filter;
}
