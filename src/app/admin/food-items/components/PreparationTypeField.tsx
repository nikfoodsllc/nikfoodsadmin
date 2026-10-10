'use client';

import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { PreparationType, isPreparationType } from '@/utils/preparationType';

interface PreparationTypeFieldProps {
  value?: PreparationType | null;
  onChange: (value: PreparationType | null) => void;
  disabled?: boolean;
  /** New items: the choice is mandatory, so "Not set yet" is not offered. */
  required?: boolean;
  /** Message shown in red under the buttons (e.g. when Save was pressed without a choice). */
  error?: string;
}

/**
 * Cooked / Ready to eat / Not set yet, for the edit dialogs. This is the master data the Food Items
 * column and the kitchen reports read.
 */
export default function PreparationTypeField({ value, onChange, disabled, required, error }: PreparationTypeFieldProps) {
  const current = isPreparationType(value) ? value : 'not_set';
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
        Preparation Type{required ? ' *' : ''}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={current}
        disabled={disabled}
        onChange={(_, next: PreparationType | 'not_set' | null) => {
          if (next === null) return; // clicking the selected button again keeps it
          onChange(next === 'not_set' ? null : next);
        }}
        aria-required={required}
        aria-invalid={Boolean(error)}
        sx={{
          '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, py: 0.75 },
          ...(error ? { outline: '1px solid #DC2626', borderRadius: 1 } : {}),
        }}
      >
        <ToggleButton
          value="cooked"
          sx={{ '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: '#FFEDD5', color: '#C2410C' } }}
        >
          Cooked
        </ToggleButton>
        <ToggleButton
          value="ready_to_eat"
          sx={{ '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: '#D1FAE5', color: '#047857' } }}
        >
          Ready to eat
        </ToggleButton>
        {!required && <ToggleButton value="not_set">Not set yet</ToggleButton>}
      </ToggleButtonGroup>
      <Typography variant="caption" role={error ? 'alert' : undefined} sx={{ display: 'block', mt: 0.75, color: error ? '#DC2626' : '#6B7280' }}>
        {error ? (
          error
        ) : (
          <>
            Cooked: made fresh for that day&apos;s menu (chapati, rajma). Ready to eat: already made, only packed for
            delivery (pickles, sweets).
          </>
        )}
      </Typography>
    </Box>
  );
}
