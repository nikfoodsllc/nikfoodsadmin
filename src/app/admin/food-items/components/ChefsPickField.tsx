'use client';

import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { isChefsPick } from '@/utils/chefsPick';

/** Chef's Pick: Yes / No, for the edit dialogs. Yes puts the item in the mobile app's Chef's Pick row. */
export default function ChefsPickField({ value, onChange, disabled }: { value?: boolean | null; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
        Chef&apos;s Pick
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={isChefsPick(value) ? 'yes' : 'no'}
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
        Yes: shown in the Chef&apos;s Pick row of the mobile app. The website does not show it.
      </Typography>
    </Box>
  );
}
