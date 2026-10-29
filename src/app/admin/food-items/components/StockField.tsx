'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, LinearProgress, Radio, RadioGroup, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconRefresh } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { stockLogText, type StockLogLine } from '@/utils/stockLogText';
import type { StockUnit } from '@/utils/stockRules';

export interface StockValue {
  stockThreshold?: number | null;
  stockUnit?: StockUnit;
  stockResetMode?: 'manual' | 'daily';
  stockResetTime?: string | null;
}

interface Live {
  limit: number | null;
  unit?: StockUnit;
  ordered?: number;
  remaining?: number | null;
  soldOut?: boolean;
  since?: string;
  mode?: 'manual' | 'daily';
  time?: string | null;
  nextReset?: string | null;
  log?: Array<StockLogLine & { at: string; byName?: string }>;
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '');
const suffix = (unit?: StockUnit) => (unit === 'lb' ? ' lb' : unit === 'oz' ? ' oz' : '');
const UNIT_LABEL: Record<StockUnit, string> = { units: 'Order limit (units)', lb: 'Order limit (pounds)', oz: 'Order limit (ounces)' };

/**
 * Order limit (inventory) for the edit dialogs: the limit (in units, pounds or ounces), when the count goes back to 0, and (for a saved
 * item) the live count with a Reset button and the history. When the amount ordered reaches the limit the item shows Out of stock on
 * the website and in the app. Pounds and ounces are for items with sizes (portions).
 */
export default function StockField({ itemId, value, onChange, disabled, hasSizes }: { itemId?: string; value: StockValue; onChange: (patch: StockValue) => void; disabled?: boolean; hasSizes?: boolean }) {
  const { token } = useAuth();
  const [live, setLive] = useState<Live | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const limit = value.stockThreshold ?? null;
  const unit: StockUnit = value.stockUnit === 'lb' || value.stockUnit === 'oz' ? value.stockUnit : 'units';
  const mode = value.stockResetMode === 'daily' ? 'daily' : 'manual';

  const load = useCallback(async () => {
    if (!itemId || !token) return;
    const r = await fetch(`/api/admin/food-items/stock?id=${encodeURIComponent(itemId)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json().catch(() => null);
    if (j?.data) setLive(j.data as Live);
  }, [itemId, token]);

  // the live count refreshes by itself while the dialog is open
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const reset = async () => {
    if (!itemId) return;
    setBusy(true);
    setError('');
    const r = await fetch('/api/admin/food-items/stock', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemId }) }).catch(() => null);
    setBusy(false);
    setConfirmOpen(false);
    if (r && r.ok) {
      const j = await r.json().catch(() => null);
      if (j?.data) setLive(j.data as Live);
    } else {
      const j = await r?.json().catch(() => null);
      setError(j?.error || 'Could not reset the count');
    }
  };

  const hasLive = Boolean(live && live.limit !== null && live.ordered !== undefined);
  const pct = hasLive && live!.limit ? Math.min(100, Math.round(((live!.ordered ?? 0) / live!.limit) * 100)) : 0;
  const suf = suffix(live?.unit);

  return (
    <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, bgcolor: '#FAFAFA' }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
        Order limit (inventory)
      </Typography>

      <ToggleButtonGroup
        exclusive
        size="small"
        fullWidth
        value={unit}
        disabled={disabled}
        onChange={(_, next: StockUnit | null) => {
          if (!next) return;
          onChange({ stockUnit: next });
        }}
        sx={{ mb: 1, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, py: 0.5 } }}
        aria-label="What the limit is counted in"
      >
        <ToggleButton value="units">Units</ToggleButton>
        <ToggleButton value="lb" disabled={!hasSizes}>Pounds (lb)</ToggleButton>
        <ToggleButton value="oz" disabled={!hasSizes}>Ounces (oz)</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        fullWidth
        size="small"
        type="number"
        label={UNIT_LABEL[unit]}
        value={limit ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const n = Number(raw);
          const ok = raw !== '' && Number.isFinite(n) && (unit === 'lb' ? n >= 0.25 : Number.isInteger(n) && n >= 1);
          onChange({ stockThreshold: ok ? Math.min(n, 100000) : null });
        }}
        slotProps={{ htmlInput: { min: unit === 'lb' ? 0.25 : 1, step: unit === 'lb' ? 0.25 : 1, inputMode: 'decimal', 'aria-label': 'Order limit' } }}
        helperText={
          hasSizes
            ? 'Leave empty for no limit. When this much is ordered the item shows Out of stock on the website and in the app and cannot be ordered. Pounds and ounces use the size of each serving (for example 1/2 Lb = 8 oz). Amounts inside combos count too.'
            : 'Leave empty for no limit. When this many units are ordered the item shows Out of stock on the website and in the app and cannot be ordered. Units inside combos count too. (Pounds and ounces are only for items with sizes.)'
        }
      />

      {limit !== null && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>Reset the count</Typography>
          <RadioGroup
            value={mode}
            onChange={(e) => onChange(e.target.value === 'daily' ? { stockResetMode: 'daily', stockResetTime: value.stockResetTime || '03:00' } : { stockResetMode: 'manual', stockResetTime: null })}
          >
            <FormControlLabel value="manual" control={<Radio size="small" disabled={disabled} />} label="Manual only (press Reset count)" />
            <FormControlLabel value="daily" control={<Radio size="small" disabled={disabled} />} label="Reset (Custom Time): every day at a time I choose" />
          </RadioGroup>
          {mode === 'daily' && (
            <TextField
              size="small"
              type="time"
              label="Reset time (Pacific)"
              value={value.stockResetTime || '03:00'}
              disabled={disabled}
              onChange={(e) => onChange({ stockResetMode: 'daily', stockResetTime: e.target.value || '03:00' })}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="The count goes back to 0 at this time every day (Pacific time). You can still reset by hand."
              sx={{ mt: 0.5 }}
            />
          )}
        </Box>
      )}

      {itemId && hasLive && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff', border: '1px solid #E5E7EB', borderRadius: 2 }} data-testid="stock-live">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
              Ordered since reset: {live!.ordered}{suf} of {live!.limit}{suf}
              {!live!.soldOut && live!.remaining !== null && live!.remaining !== undefined ? ` · ${live!.remaining}${suf} left` : ''}
            </Typography>
            {live!.soldOut ? <Chip size="small" label="SOLD OUT" sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }} /> : <Chip size="small" label="Live" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />}
          </Box>
          <LinearProgress variant="determinate" value={pct} sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: '#F3F4F6', '& .MuiLinearProgress-bar': { bgcolor: live!.soldOut ? '#DC2626' : pct >= 80 ? '#D97706' : '#16A34A' } }} />
          <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>
            Counting since {when(live!.since)}
            {live!.mode === 'daily' && live!.nextReset ? ` · next automatic reset ${when(live!.nextReset)}` : ' · manual reset only'}
          </Typography>
          <Button size="small" variant="outlined" startIcon={busy ? <CircularProgress size={14} /> : <IconRefresh size={16} />} disabled={busy || disabled} onClick={() => setConfirmOpen(true)} sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}>
            Reset count
          </Button>
          {error && <Typography sx={{ color: '#B91C1C', fontSize: 13, mt: 0.5 }}>{error}</Typography>}
          {(live!.log?.length ?? 0) > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#374151', mb: 0.5 }}>History</Typography>
              {live!.log!.slice(0, 8).map((row, i) => (
                <Typography key={i} sx={{ fontSize: 12.5, color: '#4B5563' }}>
                  {when(row.at)} · {stockLogText(row)}
                  {row.byName ? ` · ${row.byName}` : ''}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
      {itemId && limit !== null && !hasLive && <Typography sx={{ mt: 1.5, fontSize: 12.5, color: '#6B7280' }}>Save the item to start counting. The live count shows here.</Typography>}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reset the count?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The {live?.ordered ?? 0}{suf} ordered so far stop counting and the count starts again from 0. If the item was sold out it is available again on the website and in the app straight away. This is written in the history.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={reset} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {busy ? 'Resetting…' : 'Reset count'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
