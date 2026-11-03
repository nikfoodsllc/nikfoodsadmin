'use client';

import { Box, Switch, Typography } from '@mui/material';

interface ToggleRowProps {
  label: string;
  /** one short line under the label */
  caption?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** One row of the edit dialogs: a switch, a label and (optionally) one short line. Replaces the big Yes / No boxes. */
export default function ToggleRow({ label, caption, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <Box
      component="label"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>
          {label}
        </Typography>
        {caption && (
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', lineHeight: 1.35 }}>
            {caption}
          </Typography>
        )}
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        inputProps={{ 'aria-label': label }}
        sx={{
          flexShrink: 0,
          '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10B981' },
        }}
      />
    </Box>
  );
}
