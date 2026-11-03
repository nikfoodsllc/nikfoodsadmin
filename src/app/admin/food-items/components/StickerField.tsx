'use client';

import { StickerFlag, isStickerFlag } from '@/utils/stickerFlag';
import ToggleRow from './ToggleRow';

interface StickerFieldProps {
  value?: StickerFlag | null;
  onChange: (value: StickerFlag | null) => void;
  disabled?: boolean;
  /** the label and the one-line caption (default: the Sticker switch) */
  label?: string;
  /** kept for the callers: "not set yet" and "no" behave the same for the Stickers sheet, so the switch only has on / off */
  allowNotSet?: boolean;
  caption?: string;
}

/**
 * Sticker switch for the edit dialogs. Items switched off are left off the Kitchen Report's Stickers sheet.
 * Admin-only: the customer site never sees it.
 */
export default function StickerField({ value, onChange, disabled, label = 'Sticker', allowNotSet = true, caption = 'Shown on the Kitchen Report stickers sheet.' }: StickerFieldProps) {
  // an item with no value yet counts as on for Sticker (that is what the Stickers sheet does) and off for the other switches
  const checked = isStickerFlag(value) ? value === 'yes' : !allowNotSet;
  return <ToggleRow label={label} caption={caption} checked={checked} onChange={(on) => onChange(on ? 'yes' : 'no')} disabled={disabled} />;
}
