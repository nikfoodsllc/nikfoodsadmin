'use client';

import { Box, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { PaidChoice } from '@/utils/createOrder';

/** How an order that was paid outside the website was paid: Cash, Zelle, or anything typed (stored as the order's payment method). */
export default function PaidMethodPicker({
  choice,
  typed,
  onChoice,
  onTyped,
}: {
  choice: PaidChoice;
  typed: string;
  onChoice: (c: PaidChoice) => void;
  onTyped: (t: string) => void;
}) {
  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={choice}
        onChange={(_, value: PaidChoice | null) => value && onChoice(value)}
        aria-label="How it was paid"
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700 }, '& .Mui-selected': { bgcolor: '#FDE9C4 !important', color: '#7A4300' } }}
      >
        <ToggleButton value="Cash">Cash</ToggleButton>
        <ToggleButton value="Zelle">Zelle</ToggleButton>
        <ToggleButton value="Other">Other…</ToggleButton>
      </ToggleButtonGroup>
      {choice === 'Other' && (
        <TextField
          label="Payment method"
          placeholder="For example: Check, Venmo, Cash App"
          value={typed}
          onChange={(e) => onTyped(e.target.value.slice(0, 40))}
          size="small"
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
          helperText="This is saved as the payment method of the order."
        />
      )}
    </Box>
  );
}
