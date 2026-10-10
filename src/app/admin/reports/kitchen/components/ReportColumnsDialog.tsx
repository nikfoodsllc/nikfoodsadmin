'use client';

import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material';
import type { ColumnDef } from '@/utils/columnPreferences';
import type { ColumnSyncStatus } from '@/hooks/useColumnPreferences';

export interface ColumnChoiceGroup {
  key: string;
  title: string;
  columns: ColumnDef[];
  hidden: Set<string>;
  syncStatus: ColumnSyncStatus;
  onToggle: (key: string) => void;
  onReset: () => void;
}

const STATUS_TEXT: Record<ColumnSyncStatus, string> = {
  idle: '',
  saving: 'Saving to your account...',
  saved: 'Saved to your account',
  error: 'Saved in this browser only (could not reach your account)',
};

/**
 * Which columns go into the Excel file and the PDF, sheet by sheet. The choice is kept in the admin's own account (the
 * same place as the table layouts), so it is the same on every computer. At least one column always stays on.
 */
export default function ReportColumnsDialog({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: ColumnChoiceGroup[] }) {
  const status = groups.some((g) => g.syncStatus === 'error') ? 'error' : groups.some((g) => g.syncStatus === 'saving') ? 'saving' : groups.some((g) => g.syncStatus === 'saved') ? 'saved' : 'idle';
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Columns for Excel and PDF</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
          Choose what goes into each sheet. Your choice is saved to your account and used every time you download.
        </Typography>
        {groups.map((group) => {
          const shown = group.columns.filter((c) => !group.hidden.has(c.key)).length;
          return (
            <Box key={group.key} sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, color: '#111827' }}>{group.title}</Typography>
                <Button size="small" onClick={group.onReset} disabled={group.hidden.size === 0} sx={{ textTransform: 'none' }}>
                  Show all
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 2 }}>
                {group.columns.map((c) => {
                  const checked = !group.hidden.has(c.key);
                  return (
                    <FormControlLabel
                      key={c.key}
                      control={<Checkbox size="small" checked={checked} disabled={checked && shown === 1} onChange={() => group.onToggle(c.key)} />}
                      label={<Typography variant="body2">{c.label}</Typography>}
                    />
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
        <Typography variant="caption" sx={{ color: status === 'error' ? '#B45309' : '#6B7280' }}>{STATUS_TEXT[status]}</Typography>
        <Button variant="contained" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
