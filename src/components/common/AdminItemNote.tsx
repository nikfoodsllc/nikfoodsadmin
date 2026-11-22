'use client';

import { Box, Typography } from '@mui/material';

/** An admin's internal note on an order item (added in Orders > order details), shown in the kitchen and packing screens. Never shown to the customer. */
export default function AdminItemNote({ text, large }: { text?: string | null; large?: boolean }) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  return (
    <Box sx={{ mt: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: '#E0F2FE', border: '1px solid #7DD3FC', display: 'block', maxWidth: '100%' }}>
      <Typography component="span" sx={{ fontSize: large ? 14 : 12.5, fontWeight: 700, color: '#075985', wordBreak: 'break-word' }}>
        Admin note: {value}
      </Typography>
    </Box>
  );
}
