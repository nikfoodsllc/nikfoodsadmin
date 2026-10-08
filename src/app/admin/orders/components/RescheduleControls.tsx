'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { IconCalendarEvent, IconMail } from '@tabler/icons-react';
import { Order } from '@/types/order';
import { dateText, pickableRange, rescheduleView, whyNotReschedulable } from '@/utils/orderReschedule';

/** 'Fri, Oct 9' for '2026-10-09' */
function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function whenText(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT';
}

async function post(token: string | null, orderId: string, action: 'reschedule' | 'reschedule-email', body: unknown) {
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
 * Shown at the top of an order that was moved to another delivery date: what moved, who did it, and whether the
 * customer has been told (with the button that tells them).
 */
export function RescheduleBanner({ order, token, onChanged }: CommonProps) {
  const view = rescheduleView(order);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentNote, setSentNote] = useState('');
  if (!view.rescheduled) return null;

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

  return (
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px solid #FCD34D', bgcolor: '#FFFBEB' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <IconCalendarEvent size={18} color="#B45309" />
        <Typography sx={{ fontWeight: 700, color: '#92400E', fontSize: 14 }}>Delivery date moved</Typography>
      </Box>
      {view.lines.length > 0 ? (
        view.lines.map((l) => (
          <Typography key={l.index} sx={{ fontSize: 14, color: '#78350F' }}>
            {shortDate(l.from)} &rarr; <strong>{shortDate(l.to)}</strong>
          </Typography>
        ))
      ) : (
        <Typography sx={{ fontSize: 14, color: '#78350F' }}>Back on the original dates.</Typography>
      )}
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
      {sentNote && <Alert severity="success" sx={{ mt: 1, py: 0 }}>{sentNote}</Alert>}

      <Dialog open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Email the new delivery date?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1 }}>
            The customer gets an email with the new delivery date{view.lines.length > 1 ? 's' : ''}
            {customerEmail ? (
              <>
                {' '}at <strong style={{ wordBreak: 'break-all' }}>{customerEmail}</strong>
              </>
            ) : null}
            . Support gets an identical copy.
          </Typography>
          {view.lines.map((l) => (
            <Typography key={l.index} sx={{ fontSize: 14 }}>
              {shortDate(l.from)} &rarr; <strong>{shortDate(l.to)}</strong>
            </Typography>
          ))}
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
 * "Change date" for one day of an order: opens a small date picker for the DELIVERY date (the kitchen day stays). Any date from today on can be chosen, also one
 * that has already closed for ordering (an admin decision, so the order cutoff does not apply).
 */
export function DayRescheduleEditor({ order, dayIndex, token, onChanged }: CommonProps & { dayIndex: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const blocked = whyNotReschedulable(order);
  const day = order.items?.[dayIndex];
  if (!day) return null;
  const kitchenDay = dateText(day.deliveryDate);
  const current = dateText(day.actualDeliveryDate) || kitchenDay;
  const range = pickableRange();

  if (blocked) return null;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await post(token, order.orderId, 'reschedule', { changes: [{ index: dayIndex, newDate: value }] });
      const optimo = data.optimo as { mode?: string; removed?: number; added?: number; failed?: number } | undefined;
      let note = `Delivery moved to ${shortDate(value)}.`;
      if (optimo?.mode === 'on') {
        note += optimo.failed ? ' OptimoRoute could not be updated right now; it retries by itself within 30 minutes.' : ` OptimoRoute updated (${optimo.removed ?? 0} removed, ${optimo.added ?? 0} added).`;
      } else if (optimo && (optimo.mode === 'timeout' || optimo.mode === 'error')) {
        note += ' OptimoRoute is taking long; it finishes by itself within 30 minutes.';
      }
      setDone(note);
      setOpen(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the date.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 0.5 }}>
      {!open && (
        <Button
          size="small"
          startIcon={<IconCalendarEvent size={16} />}
          onClick={() => {
            setValue(current && current >= range.min ? current : range.min);
            setError('');
            setDone('');
            setOpen(true);
          }}
          sx={{ textTransform: 'none', fontWeight: 600, px: 0.5, minWidth: 0 }}
        >
          Change date
        </Button>
      )}
      {open && (
        <Box sx={{ mt: 0.5, p: 1.25, borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#F9FAFB' }}>
          <Typography sx={{ fontSize: 12, color: '#4B5563', mb: 1 }}>
            New delivery date for this day. The kitchen day stays {shortDate(kitchenDay)}. Any date from today works, also one that has closed for orders.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField
              type="date"
              size="small"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputProps={{ min: range.min, max: range.max, 'aria-label': 'New delivery date' }}
              sx={{ bgcolor: '#fff', minWidth: 170 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={save}
              disabled={busy || !value || value === current}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {busy ? <CircularProgress size={18} color="inherit" /> : 'Move'}
            </Button>
            <Button size="small" onClick={() => setOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
          </Box>
          {value && value === current && <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>That is the current delivery date.</Typography>}
          {value && kitchenDay && value < kitchenDay && (
            <Typography sx={{ fontSize: 12, color: '#B45309', fontWeight: 600, mt: 0.5 }}>
              This is before the kitchen day ({shortDate(kitchenDay)}), so the food would be delivered before it is cooked.
            </Typography>
          )}
          {error && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{error}</Alert>}
        </Box>
      )}
      {done && !open && <Typography sx={{ fontSize: 12, color: '#166534', fontWeight: 600, mt: 0.5 }}>{done}</Typography>}
    </Box>
  );
}
