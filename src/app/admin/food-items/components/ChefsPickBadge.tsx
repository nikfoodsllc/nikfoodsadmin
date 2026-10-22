'use client';

import { Box, Typography } from '@mui/material';
import { chefsPickLabel, isChefsPick } from '@/utils/chefsPick';

/** Whether an item is a Chef's Pick: Yes (amber) or No. */
export default function ChefsPickBadge({ value }: { value?: boolean | null }) {
  const yes = isChefsPick(value);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, paddingX: 1.5, paddingY: 0.5, borderRadius: 1.5, backgroundColor: yes ? '#FEF3C7' : '#F3F4F6', whiteSpace: 'nowrap' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: yes ? '#D97706' : '#9CA3AF' }} />
      <Typography variant="caption" sx={{ fontSize: '12px', fontWeight: 600, color: yes ? '#92400E' : '#6B7280' }}>
        {chefsPickLabel(value)}
      </Typography>
    </Box>
  );
}
