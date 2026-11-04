'use client';

import { useEffect, useState } from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_HEATING_INSTRUCTIONS, MAX_HEATING_INSTRUCTION_LENGTH, mergeHeatingInstructions } from '@/utils/heatingInstructions';

interface HeatingInstructionsFieldProps {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** no title or caption (for the bulk bar) */
  compact?: boolean;
}

/**
 * Heating / storage instruction for the edit dialogs: pick one from the list, or type a new one (it is saved to the list when the
 * item is saved, so it can be picked next time). Printed on the item's sticker in the Kitchen Report. Admin-only.
 */
export default function HeatingInstructionsField({ value, onChange, disabled, compact = false }: HeatingInstructionsFieldProps) {
  const { token } = useAuth();
  const [options, setOptions] = useState<string[]>(mergeHeatingInstructions([]));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/admin/heating-instructions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.data)) setOptions(mergeHeatingInstructions(json.data as string[]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const text = value ?? '';
  const isNew = text.trim() !== '' && !options.some((o) => o.toLowerCase() === text.trim().toLowerCase()) && !DEFAULT_HEATING_INSTRUCTIONS.includes(text.trim());

  return (
    <Box>
      {!compact && (
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', lineHeight: 1.3, mb: 0.5 }}>
          Heating/Storage Instructions
        </Typography>
      )}
      <Autocomplete
        freeSolo
        fullWidth
        size="small"
        options={options}
        disabled={disabled}
        inputValue={text}
        value={null}
        onInputChange={(_, next, reason) => {
          if (reason === 'reset' && next === '') return; // MUI clears the box after a pick; the pick is handled below
          onChange(next.slice(0, MAX_HEATING_INSTRUCTION_LENGTH));
        }}
        onChange={(_, picked) => {
          if (typeof picked === 'string') onChange(picked);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Pick one or type a new one"
            inputProps={{ ...params.inputProps, maxLength: MAX_HEATING_INSTRUCTION_LENGTH, 'aria-label': 'Heating/Storage Instructions' }}
          />
        )}
      />
      {!compact && (
      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.5, lineHeight: 1.35 }}>
        {isNew ? 'New: it is added to the list when you save, so you can pick it next time.' : 'Printed on the sticker. Clear the box for none.'}
      </Typography>
      )}
    </Box>
  );
}
