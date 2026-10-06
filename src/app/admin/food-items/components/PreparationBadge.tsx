'use client';

import { Box, Typography } from '@mui/material';
import { isPreparationType, preparationTypeLabel } from '@/utils/preparationType';

const COLORS = {
  cooked: { color: '#C2410C', bg: '#FFEDD5' },
  ready_to_eat: { color: '#047857', bg: '#D1FAE5' },
} as const;

/** How an item is prepared: Cooked, Ready to eat, or "(not set yet)". */
export default function PreparationBadge({ value }: { value?: string | null }) {
  if (!isPreparationType(value)) {
    return (
      <Typography sx={{ fontSize: '12.5px', fontStyle: 'italic', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
        {preparationTypeLabel(value)}
      </Typography>
    );
  }
  const c = COLORS[value];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        paddingX: 1.5,
        paddingY: 0.5,
        borderRadius: 1.5,
        backgroundColor: c.bg,
        whiteSpace: 'nowrap',
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.color }} />
      <Typography variant="caption" sx={{ fontSize: '12px', fontWeight: 600, color: c.color }}>
        {preparationTypeLabel(value)}
      </Typography>
    </Box>
  );
}
