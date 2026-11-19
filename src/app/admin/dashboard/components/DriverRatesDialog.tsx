'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { money2 } from './ui';
import { DRIVER_RATE_LIMITS, type DriverRates } from '@/utils/businessDashboard';

interface RatesAnswer {
  today: string;
  current: DriverRates;
  upcoming: DriverRates[];
  history: DriverRates[];
}

const dayText = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const ratesText = (r: Pick<DriverRates, 'hourlyRate' | 'perDelivery'>) => `${money2(r.hourlyRate)}/hour + ${money2(r.perDelivery)} per delivery`;

/** Change the driver pay rates for the future (shared by all admins); past days keep the rates they had */
export default function DriverRatesDialog({ token, open, onClose, onSaved }: { token: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<RatesAnswer | null>(null);
  const [hourly, setHourly] = useState('');
  const [perDelivery, setPerDelivery] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: 'GET' | 'PUT' | 'DELETE', init?: { body?: unknown; query?: string }) => {
    const r = await fetch(`/api/admin/business-dashboard/driver-rates${init?.query ?? ''}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
    return body.data as RatesAnswer;
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setData(null);
    call('GET')
      .then((d) => {
        setData(d);
        setHourly(String(d.current.hourlyRate));
        setPerDelivery(String(d.current.perDelivery));
        setFrom(d.today);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not read the rates'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await call('PUT', { body: { hourlyRate: Number(hourly), perDelivery: Number(perDelivery), from } });
      setData(d);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const cancelChange = async (day: string) => {
    setBusy(true);
    setError(null);
    try {
      setData(await call('DELETE', { query: `?from=${day}` }));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  };

  const unchanged = data && Number(hourly) === data.current.hourlyRate && Number(perDelivery) === data.current.perDelivery && from === data.today;
  const maxDay = data ? new Date(Date.parse(`${data.today}T00:00:00Z`) + DRIVER_RATE_LIMITS.maxDaysAhead * 86_400_000).toISOString().slice(0, 10) : undefined;
  const replaces = data?.upcoming.filter((r) => r.from >= from) ?? [];

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>Driver pay rates</DialogTitle>
      <DialogContent>
        {!data && !error ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : data ? (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Now: <strong style={{ color: 'inherit' }}>{ratesText(data.current)}</strong>. New rates apply from the day you pick; earlier days keep the rates they had. Saved for every admin.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                label="Per hour"
                type="number"
                size="small"
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }, htmlInput: { min: 0, step: 0.25, inputMode: 'decimal' } }}
              />
              <TextField
                label="Per delivery"
                type="number"
                size="small"
                value={perDelivery}
                onChange={(e) => setPerDelivery(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }, htmlInput: { min: 0, step: 0.25, inputMode: 'decimal' } }}
              />
              <TextField
                label="Starting"
                type="date"
                size="small"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                sx={{ gridColumn: '1 / -1' }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: data.today, max: maxDay } }}
                helperText={from === data.today ? 'Today, including today\'s routes' : from ? dayText(from) : ' '}
              />
            </Box>
            {replaces.length > 0 && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                This replaces the planned change{replaces.length > 1 ? 's' : ''} from {replaces.map((r) => dayText(r.from)).join(', ')}.
              </Alert>
            )}
            {data.upcoming.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 0.5 }}>Planned</Typography>
                {data.upcoming.map((r) => (
                  <Box key={r.from} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 0.5 }}>
                    <Typography variant="body2">
                      From {dayText(r.from)}: {ratesText(r)}
                    </Typography>
                    <Button size="small" color="error" disabled={busy} onClick={() => cancelChange(r.from)} sx={{ flexShrink: 0 }}>
                      Cancel
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
            {data.history.some((r) => r.setAt && r.from <= data.today) ? (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 0.5 }}>History</Typography>
                {data.history
                  .filter((r) => r.from <= data.today)
                  .map((r) => (
                    <Typography key={r.from} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {r.setAt ? `From ${dayText(r.from)}` : 'Before that'}: {ratesText(r)}
                      {r.setBy ? ` · set by ${r.setBy}` : ''}
                    </Typography>
                  ))}
              </Box>
            ) : null}
          </>
        ) : null}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" onClick={save} disabled={busy || !data || !!unchanged || !hourly || perDelivery === '' || !from}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
