'use client';

import { Box, Typography } from '@mui/material';

/** What the customer wrote in an item's Special instructions box, set apart so the kitchen and packing team cannot miss it. */
export default function InstructionsNote({ text, large }: { text?: string | null; large?: boolean }) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  return (
    <Box sx={{ mt: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: '#FEF3C7', border: '1px solid #FCD34D', display: 'block', maxWidth: '100%' }}>
      <Typography component="span" sx={{ fontSize: large ? 14 : 12.5, fontWeight: 700, color: '#92400E', wordBreak: 'break-word' }}>
        Instructions: {value}
      </Typography>
    </Box>
  );
}
