'use client';

import { Box, Typography } from '@mui/material';
import { isStickerFlag, stickerLabel } from '@/utils/stickerFlag';

const COLORS = {
  yes: { color: '#047857', bg: '#D1FAE5' },
  no: { color: '#B91C1C', bg: '#FEE2E2' },
} as const;

/** Whether an item gets a sticker: Yes, No, or "(not set yet)". */
export default function StickerBadge({ value }: { value?: string | null }) {
  if (!isStickerFlag(value)) {
    return (
      <Typography sx={{ fontSize: '12.5px', fontStyle: 'italic', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
        {stickerLabel(value)}
      </Typography>
    );
  }
  const c = COLORS[value];
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, paddingX: 1.5, paddingY: 0.5, borderRadius: 1.5, backgroundColor: c.bg, whiteSpace: 'nowrap' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.color }} />
      <Typography variant="caption" sx={{ fontSize: '12px', fontWeight: 600, color: c.color }}>
        {stickerLabel(value)}
      </Typography>
    </Box>
  );
}
