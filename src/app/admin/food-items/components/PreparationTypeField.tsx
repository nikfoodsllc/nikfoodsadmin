'use client';

import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { PreparationType, isPreparationType } from '@/utils/preparationType';

interface PreparationTypeFieldProps {
  value?: PreparationType | null;
  onChange: (value: PreparationType | null) => void;
  disabled?: boolean;
  /** New items: the choice is mandatory (an existing item may have neither ticked). */
  required?: boolean;
  /** Message shown in red under the boxes (e.g. when Save was pressed without a choice). */
  error?: string;
}

/**
 * Cooked / Ready to eat, for the edit dialogs: two tick boxes on one line (only one can be ticked; neither = not set yet).
 * This is the master data the Food Items column and the kitchen reports read.
 */
export default function PreparationTypeField({ value, onChange, disabled, required, error }: PreparationTypeFieldProps) {
  const current = isPreparationType(value) ? value : null;
  const box = (type: PreparationType, label: string, color: string) => (
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          checked={current === type}
          disabled={disabled}
          // ticking the ticked one again clears it (back to not set yet)
          onChange={(e) => onChange(e.target.checked ? type : null)}
          sx={{ '&.Mui-checked': { color } }}
        />
      }
      label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>}
      sx={{ mr: 2 }}
    />
  );
  return (
    <Box aria-invalid={Boolean(error)} sx={error ? { outline: '1px solid #DC2626', borderRadius: 1, p: 0.5 } : undefined}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>
          Preparation Type{required ? ' *' : ''}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {box('cooked', 'Cooked', '#C2410C')}
          {box('ready_to_eat', 'Ready to eat', '#047857')}
        </Box>
      </Box>
      <Typography variant="caption" role={error ? 'alert' : undefined} sx={{ display: 'block', color: error ? '#DC2626' : '#6B7280' }}>
        {error ? error : <>Cooked = made fresh. Ready to eat = just packed.</>}
      </Typography>
    </Box>
  );
}
