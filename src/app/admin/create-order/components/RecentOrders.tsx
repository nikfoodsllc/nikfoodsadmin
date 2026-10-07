'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { linkActivity, paidMethodValue, rowsForTab, type OrderListRow as Row, type OrderTab as TabKey, type PaidChoice } from '@/utils/createOrder';
import PaidMethodPicker from './PaidMethodPicker';


const REFRESH_MS = 30000;

const money = (n: number) => `$${n.toFixed(2)}`;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const dayText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The lines about what happened to the pay link (email delivered, pay page opened). */
function ActivityLines({ row }: { row: Row }) {
  const lines = linkActivity(row);
  if (lines.length === 0) return null;
  return (
    <Box sx={{ mt: 0.5, display: 'grid', gap: 0.35 }}>
      {lines.map((line, i) => (
        <Typography key={i} sx={{ fontSize: 12.5, fontWeight: line.tone === 'info' ? 400 : 600, color: { good: '#15803D', bad: '#B91C1C', warn: '#B45309', info: '#6B7280' }[line.tone], wordBreak: 'break-word' }}>
          {line.tone === 'info' ? '○ ' : '● '}{line.text}
        </Typography>
      ))}
    </Box>
  );
}

/**
 * The orders entered on this screen, newest first. They stay here after the form is left or the page is changed, so a
 * payment link can be copied or sent again, or the order marked as paid another way, at any time.
 */
export default function RecentOrders({ token, version, onChanged, onEdit }: { token: string; version: number; onChanged: () => void; onEdit: (orderId: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ orderId: string; text: string; error?: boolean } | null>(null);
  const [payDialog, setPayDialog] = useState<Row | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Row | null>(null);
  const [payChoice, setPayChoice] = useState<PaidChoice>('Cash');
  const [payTyped, setPayTyped] = useState('');
  const [payNote, setPayNote] = useState('');
  const [tab, setTab] = useState<TabKey>('waiting');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/create-order/orders', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || 'Could not load the orders');
      setRows(body.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the orders');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, version]);

  // keep the list current: an order the customer pays leaves the Waiting tab by itself
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const post = async (orderId: string, path: string, payload: unknown) => {
    const res = await fetch(`/api/admin/create-order/orders/${encodeURIComponent(orderId)}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) throw new Error(body.error || 'Something went wrong');
    return body.data;
  };

  const run = async (row: Row, key: string, action: () => Promise<string>) => {
    setBusy(`${row.orderId}:${key}`);
    setNotice(null);
    try {
      setNotice({ orderId: row.orderId, text: await action() });
    } catch (e) {
      setNotice({ orderId: row.orderId, text: e instanceof Error ? e.message : 'Something went wrong', error: true });
    }
    setBusy(null);
    await load();
    onChanged();
  };

  const emailLink = (row: Row) =>
    run(row, 'email', async () => {
      const d = await post(row.orderId, 'resend', { sendEmail: true });
      return d.emailSent ? 'A new link was emailed to the customer. The previous link no longer works.' : `The email could not be sent (${d.emailError || 'unknown error'}). Use "Copy a new link" instead.`;
    });

  const copyLink = (row: Row) =>
    run(row, 'copy', async () => {
      const d = await post(row.orderId, 'resend', { sendEmail: false });
      try {
        await navigator.clipboard.writeText(d.payLink);
        return 'A new link was copied. Any link sent before no longer works.';
      } catch {
        return `Copy this link: ${d.payLink}`;
      }
    });

  const cancelOrder = async () => {
    const row = cancelDialog;
    if (!row) return;
    setCancelDialog(null);
    await run(row, 'cancel', async () => {
      await post(row.orderId, 'cancel', {});
      return 'Order cancelled. Its payment link no longer works.';
    });
  };

  const markPaid = async () => {
    const row = payDialog;
    if (!row) return;
    setPayDialog(null);
    await run(row, 'paid', async () => {
      const d = await post(row.orderId, 'mark-paid', { method: paidMethodValue(payChoice, payTyped), note: payNote.trim() || 'Marked paid by an admin' });
      return d.emailSent ? 'Marked as paid. The confirmation email was sent.' : 'Marked as paid, but the confirmation email could not be sent.';
    });
    setPayNote('');
    setPayTyped('');
    setPayChoice('Cash');
  };

  const visible = rows ? rowsForTab(rows, tab) : [];

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Recent orders entered here</Typography>
        <Button size="small" onClick={() => void load()} sx={{ textTransform: 'none' }}>Refresh</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {!rows && !error && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>}
      {rows && (
        <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ mb: 1, minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 } }}>
          <Tab value="waiting" label={`Waiting for payment (${rows.filter((r) => r.awaitingPayment).length})`} />
          <Tab value="paid" label={`Paid (${rows.filter((r) => r.paymentStatus === 'paid').length})`} />
          <Tab value="all" label={`All (${rows.length})`} />
        </Tabs>
      )}
      {rows && visible.length === 0 && (
        <Typography sx={{ color: '#6B7280', fontSize: 14 }}>
          {rows.length === 0 ? 'No orders entered here yet.' : tab === 'waiting' ? 'Nothing is waiting for payment.' : tab === 'paid' ? 'No paid orders yet.' : 'No orders.'}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {visible.map((row) => {
          const paid = row.paymentStatus === 'paid';
          const cancelled = row.status === 'cancelled';
          return (
            <Paper key={row.orderId} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid #E5E7EB', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-all' }}>{row.orderId}</Typography>
                  <Typography sx={{ fontSize: 13, color: '#374151', wordBreak: 'break-word' }}>{row.customerName} · {row.customerEmail}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                    Entered {when(row.createdAt)} · delivers {row.deliveryDates.map(dayText).join(', ')}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{money(row.total)}</Typography>
                  <Chip
                    size="small"
                    label={cancelled ? 'Cancelled' : paid ? `Paid · ${row.paymentMethod === 'Cash on Delivery' ? 'Cash' : row.paymentMethod}` : 'Waiting for payment'}
                    color={cancelled ? 'default' : paid ? 'success' : 'warning'}
                    sx={{ mt: 0.5, fontWeight: 700 }}
                  />
                </Box>
              </Box>
              {row.awaitingPayment && (
                <>
                  <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.75 }}>
                    {row.linkSentAt ? `Link emailed ${when(row.linkSentAt)}` : 'The payment link has not been emailed yet'}
                  </Typography>
                  <ActivityLines row={row} />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void emailLink(row)} sx={{ textTransform: 'none' }}>Email a new link</Button>
                    <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void copyLink(row)} sx={{ textTransform: 'none' }}>Copy a new link</Button>
                    <Button size="small" variant="outlined" color="warning" disabled={Boolean(busy)} onClick={() => setPayDialog(row)} sx={{ textTransform: 'none' }}>Paid another way</Button>
                    <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => onEdit(row.orderId)} sx={{ textTransform: 'none' }}>Edit</Button>
                    <Button size="small" variant="outlined" color="error" disabled={Boolean(busy)} onClick={() => setCancelDialog(row)} sx={{ textTransform: 'none' }}>Cancel order</Button>
                    {busy?.startsWith(`${row.orderId}:`) && <CircularProgress size={20} />}
                  </Box>
                </>
              )}
              {!row.awaitingPayment && <ActivityLines row={row} />}
              {row.offlinePaymentNote && <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>Note: {row.offlinePaymentNote}</Typography>}
              {notice?.orderId === row.orderId && <Alert severity={notice.error ? 'error' : 'success'} sx={{ mt: 1 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
            </Paper>
          );
        })}
      </Box>

      <Dialog open={Boolean(cancelDialog)} onClose={() => setCancelDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>Cancel this order?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            {cancelDialog?.orderId} · {cancelDialog ? money(cancelDialog.total) : ''} for {cancelDialog?.customerName}. The payment link stops working and the order is cancelled. The customer is not emailed. If they already paid, this is refused.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog(null)} sx={{ textTransform: 'none' }}>Keep it</Button>
          <Button variant="contained" color="error" onClick={() => void cancelOrder()} sx={{ textTransform: 'none', fontWeight: 700 }}>Cancel order</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(payDialog)} onClose={() => setPayDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>The customer paid another way</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, mb: 1 }}>{payDialog?.orderId} · {payDialog ? money(payDialog.total) : ''}. The order is confirmed, the pay link stops working and the customer gets the confirmation email.</Typography>
          <PaidMethodPicker choice={payChoice} typed={payTyped} onChoice={setPayChoice} onTyped={setPayTyped} />
          <TextField label="Note (optional)" value={payNote} onChange={(e) => setPayNote(e.target.value.slice(0, 200))} size="small" fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(null)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button variant="contained" disabled={paidMethodValue(payChoice, payTyped) === null} onClick={() => void markPaid()} sx={{ textTransform: 'none', fontWeight: 700 }}>Mark as paid</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
