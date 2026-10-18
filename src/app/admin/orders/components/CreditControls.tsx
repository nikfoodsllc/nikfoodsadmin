'use client';

import { useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Select, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Order } from '@/types/order';
import { MoveItemsBar } from './RescheduleControls';
import { centsToMoney, creditPicks, whyNotCreditable } from '@/utils/storeCredit';
import { whyNotReschedulable } from '@/utils/orderReschedule';

async function postCredit(token: string | null, orderId: string, body: unknown) {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) throw new Error(json.error || json.message || 'Something went wrong. Please try again.');
  return json.data ?? {};
}

interface BarProps {
  order: Order;
  token: string | null;
  /** Ticked items ('line:item') */
  selected: Set<string>;
  onClear: () => void;
  /** Called after a change so the page can reload the order */
  onChanged: () => Promise<void> | void;
  plain?: boolean;
}

/** The bar for giving store credit for the ticked items: how many of each, a note, the amount, and a confirmation. */
export function CreditItemsBar({ order, token, selected, onClear, onChanged, plain }: BarProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [includeTax, setIncludeTax] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const picks = useMemo(() => creditPicks(order, selected, quantities, includeTax), [order, selected, quantities, includeTax]);
  const total = picks.reduce((n, p) => n + p.cents, 0);
  if (whyNotCreditable(order) !== null) return null;
  const key = (p: { line: number; item: number }) => `${p.line}:${p.item}`;

  const give = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await postCredit(token, order.orderId, {
        items: picks.map((p) => ({ line: p.line, item: p.item, quantity: p.quantity })),
        note: note.trim() || undefined,
        includeTax,
      });
      const balance = typeof data.balance === 'number' ? ` Their balance is now ${centsToMoney(Math.round(data.balance * 100))}.` : '';
      const emailed = data.email?.sent ? ' The customer was emailed.' : ` The customer could not be emailed${data.email?.error ? ` (${data.email.error})` : ''}.`;
      setConfirmOpen(false);
      setNote('');
      setQuantities({});
      onClear();
      await onChanged();
      setDone(`${centsToMoney(total)} credit given.${balance}${emailed}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not give the credit.');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };
  if (picks.length === 0) {
    return done ? (
      <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <Typography sx={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>{done}</Typography>
      </Box>
    ) : null;
  }

  return (
    <Box
      sx={
        plain
          ? { p: 1.25, borderRadius: 2, border: '1px solid #86EFAC', bgcolor: '#F0FDF4' }
          : { position: 'sticky', bottom: 0, zIndex: 2, mt: 1, p: 1.25, borderRadius: 2, border: '1px solid #86EFAC', bgcolor: '#F0FDF4', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }
      }
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#166534', mb: 0.75 }}>Give store credit for:</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {picks.map((p) => (
          <Box key={key(p)} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 13, flex: '1 1 140px', minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</Typography>
            {p.left > 1 && (
              <Select
                size="small"
                value={p.quantity}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [key(p)]: Number(e.target.value) }))}
                inputProps={{ 'aria-label': `How many ${p.name}` }}
                sx={{ bgcolor: '#fff', minWidth: 70, '& .MuiSelect-select': { py: 0.5 } }}
              >
                {Array.from({ length: p.left }, (_, i) => i + 1).map((n) => (
                  <MenuItem key={n} value={n}>
                    {n} of {p.left}
                  </MenuItem>
                ))}
              </Select>
            )}
            <Typography sx={{ fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: 'right' }}>{centsToMoney(p.cents)}</Typography>
          </Box>
        ))}
      </Box>
      <RadioGroup row value={includeTax ? 'with' : 'without'} onChange={(e) => setIncludeTax(e.target.value === 'with')} aria-label="Tax on the credited items" sx={{ mt: 0.5 }}>
        <FormControlLabel value="without" control={<Radio size="small" />} label={<Typography sx={{ fontSize: 13 }}>Withhold tax</Typography>} />
        <FormControlLabel value="with" control={<Radio size="small" />} label={<Typography sx={{ fontSize: 13 }}>Include tax (10.3%)</Typography>} />
      </RadioGroup>
      <TextField
        size="small"
        fullWidth
        placeholder="Note for the customer (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 200))}
        inputProps={{ 'aria-label': 'Note for the customer' }}
        sx={{ bgcolor: '#fff', mt: 1 }}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 1 }}>
        <Button variant="contained" size="small" color="success" onClick={() => setConfirmOpen(true)} disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Give {centsToMoney(total)} credit
        </Button>
        <Button size="small" onClick={onClear} disabled={busy} sx={{ textTransform: 'none' }}>
          Clear
        </Button>
      </Box>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
        {includeTax ? 'The item price and the 10.3% tax on it.' : 'The item price only; its tax is withheld.'} The Platform Fee, the tax on it and the tip are not credited.
      </Typography>
      {error && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{error}</Alert>}

      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Give {centsToMoney(total)} store credit?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1 }}>
            {order.customerInfo?.name || 'The customer'} gets the credit on their account for {picks.map((p) => `${p.quantity} × ${p.name}`).join(', ')}. It does not expire and cannot be turned into cash.
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#6B7280' }}>They are emailed about it. This cannot be undone here.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" color="success" onClick={give} disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {busy ? <CircularProgress size={18} color="inherit" /> : 'Give credit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * Shown while items are ticked in an order's details: move their delivery date and/or give store credit for them.
 * When the order allows both there is a switch; with one, just that bar.
 */
export function ItemActionsBar({ order, token, selected, onClear, onChanged }: Omit<BarProps, 'plain'>) {
  const canMove = whyNotReschedulable(order) === null;
  const canCredit = whyNotCreditable(order) === null;
  const [mode, setMode] = useState<'move' | 'credit'>(canMove ? 'move' : 'credit');

  if (!canMove && !canCredit) return null;
  if (!canCredit) return <MoveItemsBar order={order} token={token} selected={selected} onClear={onClear} onChanged={onChanged} />;
  if (!canMove) return <CreditItemsBar order={order} token={token} selected={selected} onClear={onClear} onChanged={onChanged} />;

  if (selected.size === 0) {
    // keep the "done" notes of either bar visible
    return (
      <>
        <MoveItemsBar order={order} token={token} selected={selected} onClear={onClear} onChanged={onChanged} />
        <CreditItemsBar order={order} token={token} selected={selected} onClear={onClear} onChanged={onChanged} />
      </>
    );
  }
  return (
    <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, mt: 1, p: 1, borderRadius: 2, bgcolor: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, value) => value && setMode(value)}
        sx={{ mb: 1, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, py: 0.25 } }}
      >
        <ToggleButton value="move">Move delivery date</ToggleButton>
        <ToggleButton value="credit">Store credit</ToggleButton>
      </ToggleButtonGroup>
      {/* both stay mounted, so what was typed or chosen in one is still there after a look at the other */}
      <Box sx={{ display: mode === 'move' ? 'block' : 'none' }}>
        <MoveItemsBar order={order} token={token} selected={selected} onClear={onClear} onChanged={onChanged} plain />
      </Box>
      <Box sx={{ display: mode === 'credit' ? 'block' : 'none' }}>
        <CreditItemsBar order={order} token={token} selected={selected} onClear={onClear} onChanged={onChanged} plain />
      </Box>
    </Box>
  );
}
