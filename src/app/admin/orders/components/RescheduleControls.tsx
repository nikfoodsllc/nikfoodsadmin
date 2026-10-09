'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { IconCalendarEvent, IconMail, IconMessage } from '@tabler/icons-react';
import { Order } from '@/types/order';
import { deliversBeforeKitchen, pickableRange, rescheduleView, selectionList, whyNotReschedulable } from '@/utils/orderReschedule';

/** 'Fri, Oct 9' for '2026-10-09' */
export function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function whenText(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT';
}

async function post(token: string | null, orderId: string, action: 'reschedule' | 'reschedule-email' | 'reschedule-sms', body: unknown) {
  const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json.data ?? {};
}

interface CommonProps {
  order: Order;
  token: string | null;
  /** Called after a change so the page can reload the order */
  onChanged: () => Promise<void> | void;
}

/**
 * Shown at the top of an order whose items were moved to another delivery date: what moved, who did it, and whether the
 * customer has been told (with the button that tells them).
 */
export function RescheduleBanner({ order, token, onChanged }: CommonProps) {
  const view = rescheduleView(order);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentNote, setSentNote] = useState('');
  const [textOpen, setTextOpen] = useState(false);
  const [texting, setTexting] = useState(false);
  const [textError, setTextError] = useState('');
  if (!view.rescheduled) return null;
  const textedAt = order.rescheduleSms?.sentAt ? new Date(order.rescheduleSms.sentAt) : null;
  const textCount = order.rescheduleSms?.count ?? (textedAt ? 1 : 0);

  const customerEmail = order.customerInfo?.email || '';
  const canEmail = view.email !== 'none' && order.status !== 'cancelled';

  const send = async () => {
    setSending(true);
    setError('');
    try {
      await post(token, order.orderId, 'reschedule-email', {});
      setConfirmOpen(false);
      setSentNote('Email sent to the customer.');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The email could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const sendText = async () => {
    setTexting(true);
    setTextError('');
    try {
      const result = await post(token, order.orderId, 'reschedule-sms', {});
      setTextOpen(false);
      setSentNote(result.mode === 'dry' ? 'Text recorded (test mode, nothing was sent).' : 'Text sent to the customer.');
      await onChanged();
    } catch (e) {
      setTextError(e instanceof Error ? e.message : 'The text could not be sent.');
    } finally {
      setTexting(false);
    }
  };

  const groupLines = view.groups.map((g) => (
    <Box key={`${g.from}>${g.to}`} sx={{ mb: 0.5 }}>
      <Typography sx={{ fontSize: 14, color: '#78350F' }}>
        {shortDate(g.from)} &rarr; <strong>{shortDate(g.to)}</strong>
      </Typography>
      <Typography sx={{ fontSize: 12, color: '#92400E' }}>{g.items.join(', ')}</Typography>
    </Box>
  ));

  return (
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px solid #FCD34D', bgcolor: '#FFFBEB' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <IconCalendarEvent size={18} color="#B45309" />
        <Typography sx={{ fontWeight: 700, color: '#92400E', fontSize: 14 }}>Delivery date moved</Typography>
      </Box>
      {view.groups.length > 0 ? groupLines : <Typography sx={{ fontSize: 14, color: '#78350F' }}>Back on the original dates.</Typography>}
      <Typography sx={{ fontSize: 12, color: '#92400E', mt: 0.5 }}>
        {view.lastBy ? `By ${view.lastBy} · ` : ''}
        {whenText(view.lastAt)}
        {view.moves > 1 ? ` · moved ${view.moves} times` : ''}
      </Typography>

      {view.email !== 'none' && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {view.email === 'pending' ? (
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>The customer has not been told yet.</Typography>
          ) : (
            <Typography sx={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
              Customer emailed {whenText(view.emailSentAt)}
              {view.emailCount > 1 ? ` (${view.emailCount} emails)` : ''}
            </Typography>
          )}
          {canEmail && (
            <Button
              size="small"
              variant={view.email === 'pending' ? 'contained' : 'outlined'}
              startIcon={<IconMail size={16} />}
              onClick={() => {
                setError('');
                setConfirmOpen(true);
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {view.email === 'pending' ? 'Send email to customer' : 'Send again'}
            </Button>
          )}
        </Box>
      )}
      {view.email !== 'none' && order.status !== 'cancelled' && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {textedAt && (
            <Typography sx={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
              Customer texted {whenText(textedAt)}
              {textCount > 1 ? ` (${textCount} texts)` : ''}
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<IconMessage size={16} />}
            onClick={() => {
              setTextError('');
              setTextOpen(true);
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {textedAt ? 'Text again' : 'Send text to customer'}
          </Button>
        </Box>
      )}
      {sentNote && <Alert severity="success" sx={{ mt: 1, py: 0 }}>{sentNote}</Alert>}

      <Dialog open={textOpen} onClose={() => !texting && setTextOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Text the new delivery date?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1 }}>
            The customer gets a short text with the new delivery date{view.groups.length > 1 ? 's' : ''} and a link to the order. Only customers who agreed to text messages can be texted.
          </Typography>
          {groupLines}
          {textError && <Alert severity="error" sx={{ mt: 1.5 }}>{textError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTextOpen(false)} disabled={texting} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={sendText} disabled={texting} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>
            {texting ? <CircularProgress size={20} color="inherit" /> : 'Send text'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Email the new delivery date?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1 }}>
            The customer gets an email with the new delivery date{view.groups.length > 1 ? 's' : ''}
            {customerEmail ? (
              <>
                {' '}at <strong style={{ wordBreak: 'break-all' }}>{customerEmail}</strong>
              </>
            ) : null}
            . Support gets an identical copy.
          </Typography>
          {groupLines}
          {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={sending} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={send} disabled={sending} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>
            {sending ? <CircularProgress size={20} color="inherit" /> : 'Send email'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * The bar that appears when items are ticked in the order details: one new DELIVERY date for all ticked items. The
 * kitchen day of each item stays. Any date from today works, also one that has already closed for ordering (an admin
 * decision, so the order cutoff does not apply).
 */
export function MoveItemsBar({ order, token, selected, onClear, onChanged }: CommonProps & { selected: Set<string>; onClear: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const count = selected.size;
  if (whyNotReschedulable(order) !== null) return null;
  if (count === 0) {
    return done ? (
      <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 2, p: 1, mt: 1 }}>
        <Typography sx={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>{done}</Typography>
      </Box>
    ) : null;
  }

  const range = pickableRange();
  const before = deliversBeforeKitchen(order, selected, value);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await post(token, order.orderId, 'reschedule', { items: selectionList(selected), newDate: value });
      const optimo = data.optimo as { mode?: string; removed?: number; added?: number; failed?: number } | undefined;
      let note = `${count} item${count === 1 ? '' : 's'} will now be delivered ${shortDate(value)}.`;
      if (optimo?.mode === 'on') {
        note += optimo.failed ? ' OptimoRoute could not be updated right now; it retries by itself within 30 minutes.' : ` OptimoRoute updated (${optimo.removed ?? 0} removed, ${optimo.added ?? 0} added).`;
      } else if (optimo && (optimo.mode === 'timeout' || optimo.mode === 'error')) {
        note += ' OptimoRoute is taking long; it finishes by itself within 30 minutes.';
      }
      setDone(note);
      setValue('');
      onClear();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the items.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        mt: 1,
        p: 1.25,
        borderRadius: 2,
        border: '1px solid #FCD34D',
        bgcolor: '#FFFBEB',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400E', mb: 0.5 }}>
        {count} item{count === 1 ? '' : 's'} selected. New delivery date:
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <TextField
          type="date"
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputProps={{ min: range.min, max: range.max, 'aria-label': 'New delivery date' }}
          sx={{ bgcolor: '#fff', minWidth: 160 }}
        />
        <Button variant="contained" size="small" onClick={save} disabled={busy || !value} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {busy ? <CircularProgress size={18} color="inherit" /> : 'Move'}
        </Button>
        <Button size="small" onClick={onClear} disabled={busy} sx={{ textTransform: 'none' }}>
          Clear
        </Button>
      </Box>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
        The kitchen day stays. Any date from today works, also one that has closed for orders.
      </Typography>
      {before && (
        <Typography sx={{ fontSize: 12, color: '#B45309', fontWeight: 600, mt: 0.5 }}>
          Some of these items would be delivered before their kitchen day, so before they are cooked.
        </Typography>
      )}
      {error && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{error}</Alert>}
    </Box>
  );
}
