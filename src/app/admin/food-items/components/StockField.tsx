'use client';

import { useCallback, useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, LinearProgress, Radio, RadioGroup, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconBan, IconChevronDown, IconRefresh } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { stockLogText, type StockLogLine } from '@/utils/stockLogText';
import type { StockUnit } from '@/utils/stockRules';

export interface StockValue {
  stockThreshold?: number | null;
  stockUnit?: StockUnit;
  stockResetMode?: 'manual' | 'daily';
  stockResetTime?: string | null;
  /** the team gets a low-stock email when this share (1 to 99) of the limit is left; blank = 10 */
  stockAlertPercent?: number | null;
}

interface Live {
  limit: number | null;
  unit?: StockUnit;
  ordered?: number;
  remaining?: number | null;
  soldOut?: boolean;
  level?: 'none' | 'ok' | 'low' | 'out';
  alertPercent?: number;
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
  const [soldOutOpen, setSoldOutOpen] = useState(false);
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

  // lowers the limit to what has been ordered, so the item is sold out at once (saved straight away, like Reset count)
  const soldOutNow = async () => {
    if (!itemId) return;
    setBusy(true);
    setError('');
    const r = await fetch('/api/admin/food-items/stock', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemId, action: 'sold_out_now' }) }).catch(() => null);
    setBusy(false);
    setSoldOutOpen(false);
    const j = await r?.json().catch(() => null);
    if (r && r.ok && j?.data) {
      setLive(j.data as Live);
      // keep the form in step, so pressing Save afterwards does not put the old limit back
      if (typeof j.data.limit === 'number') onChange({ stockThreshold: j.data.limit });
    } else {
      setError(j?.error || 'Could not mark it sold out');
    }
  };

  const hasLive = Boolean(live && live.limit !== null && live.ordered !== undefined);
  const pct = hasLive && live!.limit ? Math.min(100, Math.round(((live!.ordered ?? 0) / live!.limit) * 100)) : hasLive && live!.limit === 0 ? 100 : 0;
  const suf = suffix(live?.unit);
  const alertPct = value.stockAlertPercent && value.stockAlertPercent >= 1 && value.stockAlertPercent <= 99 ? value.stockAlertPercent : 10;
  const alertLeft = limit !== null ? Math.round(limit * alertPct) / 100 : 0;
  const alertLeftText = `${alertLeft}${unit === 'lb' ? ' lb' : unit === 'oz' ? ' oz' : ''} or less`;

  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: '8px !important', bgcolor: '#FAFAFA', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<IconChevronDown size={18} />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { alignItems: 'center', justifyContent: 'space-between', gap: 1, my: 0.5 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>
          Order limit
        </Typography>
        <Typography variant="caption" sx={{ color: '#6B7280', mr: 1 }}>
          {limit === null ? 'No limit' : limit === 0 ? '0 (Out of stock)' : `${limit}${unit === 'lb' ? ' lb' : unit === 'oz' ? ' oz' : ' units'}`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1.5, pt: 0.5 }}>

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
          // 0 is a real limit: the item shows Out of stock and sells none (blank = no limit)
          const ok = raw !== '' && Number.isFinite(n) && (n === 0 || (unit === 'lb' ? n >= 0.25 : Number.isInteger(n) && n >= 1));
          onChange({ stockThreshold: ok ? Math.min(n, 100000) : null });
        }}
        slotProps={{ htmlInput: { min: 0, step: unit === 'lb' ? 0.25 : 1, inputMode: 'decimal', 'aria-label': 'Order limit' } }}
        helperText={`Empty = no limit. 0 = shows Out of stock and sells none. At the limit the item shows Out of stock.${hasSizes ? ' Pounds and ounces use each serving size.' : ''}`}
      />

      {limit !== null && limit > 0 && (
        <TextField
          fullWidth
          size="small"
          type="number"
          label="Alert me when this % is left"
          value={value.stockAlertPercent ?? ''}
          placeholder="10"
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const n = Number(raw);
            onChange({ stockAlertPercent: raw !== '' && Number.isInteger(n) && n >= 1 && n <= 99 ? n : null });
          }}
          slotProps={{ htmlInput: { min: 1, max: 99, step: 1, inputMode: 'numeric', 'aria-label': 'Low-stock alert percentage' }, inputLabel: { shrink: true } }}
          helperText={`Blank = 10%. Support gets an email at ${alertPct}% left (${alertLeftText}) and when it sells out.`}
          sx={{ mt: 1.5 }}
        />
      )}

      {limit !== null && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>Reset the count</Typography>
          <RadioGroup
            value={mode}
            onChange={(e) => onChange(e.target.value === 'daily' ? { stockResetMode: 'daily', stockResetTime: value.stockResetTime || '03:00' } : { stockResetMode: 'manual', stockResetTime: null })}
          >
            <FormControlLabel value="manual" control={<Radio size="small" disabled={disabled} />} label="Manual (Reset count button)" />
            <FormControlLabel value="daily" control={<Radio size="small" disabled={disabled} />} label="Every day at a set time" />
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
              helperText="Count goes back to 0 at this time daily. You can still reset by hand."
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
            {live!.soldOut ? <Chip size="small" label="SOLD OUT" sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }} /> : live!.level === 'low' ? <Chip size="small" label="LOW" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700 }} /> : <Chip size="small" label="Live" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />}
          </Box>
          <LinearProgress variant="determinate" value={pct} sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: '#F3F4F6', '& .MuiLinearProgress-bar': { bgcolor: live!.soldOut ? '#DC2626' : live!.level === 'low' ? '#D97706' : '#16A34A' } }} />
          <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>
            Counting since {when(live!.since)}
            {live!.mode === 'daily' && live!.nextReset ? ` · next automatic reset ${when(live!.nextReset)}` : ' · manual reset only'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button size="small" variant="outlined" startIcon={busy ? <CircularProgress size={14} /> : <IconRefresh size={16} />} disabled={busy || disabled} onClick={() => setConfirmOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Reset count
            </Button>
            {!live!.soldOut && (
              <Button size="small" variant="outlined" color="error" startIcon={<IconBan size={16} />} disabled={busy || disabled} onClick={() => setSoldOutOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                Sold out now
              </Button>
            )}
          </Box>
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
      <Dialog open={soldOutOpen} onClose={() => !busy && setSoldOutOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Mark sold out now?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The limit goes down from {live?.limit ?? limit}{suf} to {live?.ordered ? `the ${live.ordered}${suf} already ordered` : `0 (nothing has been ordered yet)`}. The item shows Sold out on the website and in the app straight away, and nobody can order more, even from a cart. Orders already placed stay. To sell more later, raise the limit.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSoldOutOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={busy} onClick={soldOutNow} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {busy ? 'Saving…' : 'Sold out now'}
          </Button>
        </DialogActions>
      </Dialog>
      </AccordionDetails>
    </Accordion>
  );
}
