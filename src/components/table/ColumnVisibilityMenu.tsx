'use client';

import { useState } from 'react';
import { Box, Button, Checkbox, Divider, FormControlLabel, Popover, Typography } from '@mui/material';
import { IconColumns3 } from '@tabler/icons-react';
import { ColumnDef } from '@/utils/columnPreferences';

interface ColumnVisibilityMenuProps {
  columns: ColumnDef[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  /** Back to the original widths and all columns shown. */
  onReset: () => void;
  disabled?: boolean;
}

export default function ColumnVisibilityMenu({ columns, hiddenKeys, onToggle, onShowAll, onReset, disabled }: ColumnVisibilityMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const toggleable = columns.filter((c) => !c.locked);
  const hiddenCount = toggleable.filter((c) => hiddenKeys.has(c.key)).length;

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<IconColumns3 size={18} />}
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={disabled}
        sx={{
          textTransform: 'none',
          borderRadius: 2,
          px: 2.5,
          borderColor: hiddenCount > 0 ? '#4F8CFF' : '#E5E7EB',
          color: hiddenCount > 0 ? '#4F8CFF' : '#374151',
          '&:hover': { borderColor: '#4F8CFF', backgroundColor: 'rgba(79, 140, 255, 0.04)' },
        }}
      >
        {hiddenCount > 0 ? `Columns (${hiddenCount} hidden)` : 'Columns'}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5, minWidth: 260, maxHeight: 520 } } }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Show columns</Typography>
          <Typography sx={{ fontSize: '12px', color: '#6B7280', mt: 0.25 }}>
            Drag the edge of a column header to resize it. Double-click the edge to reset that column.
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'column', px: 2, py: 0.5, maxHeight: 340, overflowY: 'auto' }}>
          {toggleable.map((c) => (
            <FormControlLabel
              key={c.key}
              label={c.label}
              control={<Checkbox size="small" checked={!hiddenKeys.has(c.key)} onChange={() => onToggle(c.key)} />}
              sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '13px', color: '#374151' } }}
            />
          ))}
        </Box>
        <Divider />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 1 }}>
          <Button size="small" onClick={onShowAll} disabled={hiddenCount === 0} sx={{ textTransform: 'none' }}>
            Show all
          </Button>
          <Button size="small" onClick={onReset} sx={{ textTransform: 'none', color: '#6B7280' }}>
            Reset layout
          </Button>
        </Box>
      </Popover>
    </>
  );
}
