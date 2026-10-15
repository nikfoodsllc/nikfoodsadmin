'use client';

import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { StickerFlag, isStickerFlag } from '@/utils/stickerFlag';

interface StickerFieldProps {
  value?: StickerFlag | null;
  onChange: (value: StickerFlag | null) => void;
  disabled?: boolean;
}

/**
 * Sticker: Yes / No / Not set yet, for the edit dialogs. Items marked No are left off the Kitchen Report's
 * Stickers sheet. Admin-only: the customer site never sees it.
 */
export default function StickerField({ value, onChange, disabled }: StickerFieldProps) {
  const current = isStickerFlag(value) ? value : 'not_set';
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
        Sticker
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={current}
        disabled={disabled}
        onChange={(_, next: StickerFlag | 'not_set' | null) => {
          if (next === null) return; // clicking the selected button again keeps it
          onChange(next === 'not_set' ? null : next);
        }}
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, py: 0.75 } }}
      >
        <ToggleButton value="yes" sx={{ '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: '#D1FAE5', color: '#047857' } }}>
          Yes
        </ToggleButton>
        <ToggleButton value="no" sx={{ '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: '#FEE2E2', color: '#B91C1C' } }}>
          No
        </ToggleButton>
        <ToggleButton value="not_set">Not set yet</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#6B7280' }}>
        Yes or not set yet: this item&apos;s orders appear on the Kitchen Report&apos;s Stickers sheet. No: they do not.
      </Typography>
    </Box>
  );
}
