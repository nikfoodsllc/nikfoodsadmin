'use client';

import { Box, Typography } from '@mui/material';
import { allowsInstructions, instructionsLabel } from '@/utils/itemInstructions';

/** Whether the item has the Special instructions box: Yes (green) or No. */
export default function InstructionsBadge({ value }: { value?: boolean | null }) {
  const yes = allowsInstructions(value);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, paddingX: 1.5, paddingY: 0.5, borderRadius: 1.5, backgroundColor: yes ? '#DCFCE7' : '#F3F4F6', whiteSpace: 'nowrap' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: yes ? '#16A34A' : '#9CA3AF' }} />
      <Typography variant="caption" sx={{ fontSize: '12px', fontWeight: 600, color: yes ? '#166534' : '#6B7280' }}>
        {instructionsLabel(value)}
      </Typography>
    </Box>
  );
}
