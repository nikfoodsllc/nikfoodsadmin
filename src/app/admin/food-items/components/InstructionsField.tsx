'use client';

import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { allowsInstructions } from '@/utils/itemInstructions';

/** Special instructions: Yes / No, for the edit dialogs. Yes gives customers a box to write instructions for this item. */
export default function InstructionsField({ value, onChange, disabled }: { value?: boolean | null; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
        Special Instructions
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={allowsInstructions(value) ? 'yes' : 'no'}
        disabled={disabled}
        onChange={(_, next: 'yes' | 'no' | null) => {
          if (next === null) return; // clicking the selected button again keeps it
          onChange(next === 'yes');
        }}
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, py: 0.75 } }}
      >
        <ToggleButton value="yes" sx={{ '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: '#D1FAE5', color: '#047857' } }}>
          Yes
        </ToggleButton>
        <ToggleButton value="no" sx={{ '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: '#FEE2E2', color: '#B91C1C' } }}>
          No
        </ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.5 }}>
        Yes: customers get a box to write instructions for this item (website and app). What they write shows to the kitchen and packing team. No: no box.
      </Typography>
    </Box>
  );
}
