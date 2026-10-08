'use client';

import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import { pacificToday } from '@/utils/abandonedCheckouts';

/** Downloads the customers who registered in a date range as a CSV: First Name, Last Name, Email, Phone. */
export default function ExportCustomersDialog({ open, token, onClose }: { open: boolean; token: string; onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const today = pacificToday();

  const download = async () => {
    setError('');
    setDone('');
    if (from && to && from > to) return setError('The start date must not be after the end date');
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/admin/users/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Could not build the export');
        return;
      }
      const count = res.headers.get('X-Row-Count') ?? '';
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'customers.csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDone(`${count} customer${count === '1' ? '' : 's'} exported (${name}).`);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>Export customers (CSV)</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 13, color: '#4B5563', mt: 1.5, mb: 2 }}>
          Customers who registered between these dates (both days included). Leave a date empty for no limit. The file has First Name, Last Name, Email and Phone. Admin accounts and deleted accounts are not included.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} size="small" InputLabelProps={{ shrink: true }} inputProps={{ max: to || today }} />
          <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} size="small" InputLabelProps={{ shrink: true }} inputProps={{ min: from || undefined, max: today }} />
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {done && <Alert severity="success" sx={{ mt: 2 }}>{done}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #E5E7EB' }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>Close</Button>
        <Button variant="contained" startIcon={<IconDownload size={16} />} onClick={download} disabled={busy} sx={{ textTransform: 'none', backgroundColor: '#4F8CFF', fontWeight: 700 }}>
          {busy ? 'Preparing…' : 'Download CSV'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
