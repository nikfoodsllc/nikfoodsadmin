/**
 * Whether a food item gets a packing sticker, for the Kitchen Report's Stickers sheet.
 *  - yes: its orders appear on the Stickers sheet
 *  - no:  they do not
 * An item with neither is "not set yet": it appears on the Stickers sheet too, until it is marked No.
 */
export type StickerFlag = 'yes' | 'no';

export const STICKER_FLAGS: StickerFlag[] = ['yes', 'no'];

export const STICKER_NOT_SET_LABEL = '(not set yet)';

export function isStickerFlag(value: unknown): value is StickerFlag {
  return value === 'yes' || value === 'no';
}

/** 'Yes', 'No' or '(not set yet)' for anything else. */
export function stickerLabel(value: unknown): string {
  return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : STICKER_NOT_SET_LABEL;
}

/** The value to keep from a stored or typed value: 'yes', 'no', or null for "not set". */
export function normalizeSticker(value: unknown): StickerFlag | null {
  return isStickerFlag(value) ? value : null;
}

/** The list filter on the Food Items page. */
export type StickerFilter = 'all' | StickerFlag | 'not_set';

export function isStickerFilter(value: unknown): value is StickerFilter {
  return value === 'all' || value === 'not_set' || isStickerFlag(value);
}

export function matchesStickerFilter(value: unknown, filter: StickerFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'not_set') return !isStickerFlag(value);
  return value === filter;
}
