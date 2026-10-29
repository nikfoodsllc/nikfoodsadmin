'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { IconSearch, IconX } from '@tabler/icons-react';
import type { AppCustomer } from '@/utils/appCustomers';
import { reachableCustomers, searchReachable, setChosen } from '@/utils/pickCustomers';

type Call = (path: string) => Promise<{ ok: boolean; status: number; json: { data?: unknown; error?: string } }>;

/**
 * "Choose customers": the customers who have the app with notifications allowed, with a search bar (name, email or phone number)
 * and a tick box for each. Done keeps the ticked ones for the send.
 */
export default function SelectCustomersDialog({
  open,
  call,
  chosen,
  onChange,
  onClose,
}: {
  open: boolean;
  call: Call;
  chosen: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [all, setAll] = useState<AppCustomer[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError('');
    void call('app-users').then((r) => {
      if (!alive) return;
      if (r.ok) setAll((r.json.data as { customers: AppCustomer[] }).customers);
      else setError(r.json.error || 'Could not load the customers');
    });
    return () => {
      alive = false;
    };
  }, [open, call]);

  const reachable = useMemo(() => reachableCustomers(all ?? []), [all]);
  const shown = useMemo(() => searchReachable(all ?? [], search), [all, search]);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);
  const shownIds = shown.map((c) => c.userId);
  const allShownChosen = shownIds.length > 0 && shownIds.every((id) => chosenSet.has(id));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        Choose customers
        <Typography sx={{ fontSize: 13, color: '#6B7280', fontWeight: 400 }}>Only customers who have the app with notifications allowed are listed.</Typography>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search by name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': 'Search customers' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <IconSearch size={18} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearch('')}>
                    <IconX size={16} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, minHeight: 32 }}>
          <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
            {all ? `${shown.length} of ${reachable.length} customer${reachable.length === 1 ? '' : 's'}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" disabled={shown.length === 0} onClick={() => onChange(setChosen(chosen, shownIds, !allShownChosen))} sx={{ textTransform: 'none', fontWeight: 700 }}>
              {allShownChosen ? 'Unselect shown' : search.trim() ? 'Select shown' : 'Select all'}
            </Button>
            <Button size="small" color="inherit" disabled={chosen.length === 0} onClick={() => onChange([])} sx={{ textTransform: 'none' }}>
              Clear
            </Button>
          </Box>
        </Box>
      </Box>
      <DialogContent dividers sx={{ p: 0, minHeight: 240 }}>
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        {!all && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {all && shown.length === 0 && (
          <Typography sx={{ color: '#6B7280', textAlign: 'center', py: 6, px: 2 }}>
            {reachable.length === 0 ? 'No customer has the app with notifications allowed yet.' : 'No customer matches that search.'}
          </Typography>
        )}
        {shown.map((c) => {
          const checked = chosenSet.has(c.userId);
          return (
            <Box
              key={c.userId}
              component="label"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, cursor: 'pointer', borderBottom: '1px solid #F3F4F6', bgcolor: checked ? '#FFF7E8' : 'transparent', '&:hover': { bgcolor: checked ? '#FFF1D6' : '#F9FAFB' } }}
            >
              <Checkbox checked={checked} onChange={(e) => onChange(setChosen(chosen, [c.userId], e.target.checked))} slotProps={{ input: { 'aria-label': `Choose ${c.name || c.email}` } }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{c.name || '(no name)'}</Typography>
                <Typography sx={{ fontSize: 13, color: '#6B7280', wordBreak: 'break-all' }}>{[c.email, c.phone].filter(Boolean).join(' · ')}</Typography>
              </Box>
              {!c.menuSwitch && <Chip size="small" label="Menu alerts off" sx={{ fontWeight: 600, bgcolor: '#F3F4F6', color: '#6B7280' }} />}
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{chosen.length} chosen</Typography>
        <Button variant="contained" color="warning" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
