'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';

export interface CreatedOrder {
  orderId: string;
  totalPaid: number;
  mode: 'link' | 'offline';
  accountCreated: boolean;
  payLink?: string;
  emailSent: boolean;
  emailError?: string;
}

/** What happened after Create: the order number, the pay link (copy it, resend it), and whether the emails went out. */
export default function OrderResult({ result, token, onAnother, onChanged }: { result: CreatedOrder; token: string; onAnother: () => void; onChanged?: () => void }) {
  const [link, setLink] = useState(result.payLink ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);

  const call = async (path: string, body?: unknown) => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await fetch(`/api/admin/create-order/orders/${encodeURIComponent(result.orderId)}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong');
      return data.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const data = await call('resend');
    if (!data) return;
    setLink(data.payLink);
    onChanged?.();
    setNote(data.emailSent ? 'A new link was emailed to the customer. The old link no longer works.' : `The new link could not be emailed (${data.emailError || 'unknown error'}). Copy it below and send it yourself.`);
  };

  const markPaid = async () => {
    const data = await call('mark-paid', { method: 'Cash on Delivery', note: 'Marked paid by an admin' });
    if (!data) return;
    setPaid(true);
    onChanged?.();
    setNote(data.emailSent ? 'Marked as paid. The confirmation email was sent.' : 'Marked as paid, but the confirmation email could not be sent.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNote('Link copied.');
    } catch {
      setNote('Could not copy automatically. Select the link and copy it.');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid #BBF7D0', bgcolor: '#F0FDF4', borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 20 }}>Order created</Typography>
      <Typography sx={{ fontSize: 15, mt: 0.5 }}>
        Order <strong>{result.orderId}</strong> · ${result.totalPaid.toFixed(2)} · {result.mode === 'link' && !paid ? 'waiting for payment' : 'paid'}
      </Typography>
      {result.accountCreated && <Alert severity="info" sx={{ mt: 1.5 }}>A new customer account was created for this email (the customer sets a password with Forgot password).</Alert>}
      {result.mode === 'link' ? (
        <>
          <Alert severity={result.emailSent ? 'success' : 'warning'} sx={{ mt: 1.5 }}>
            {result.emailSent ? 'The payment link was emailed to the customer.' : `The email could not be sent (${result.emailError || 'unknown error'}). Copy the link below and send it to the customer yourself.`}
          </Alert>
          {!paid && (
            <>
              <Box sx={{ mt: 1.5, p: 1, bgcolor: '#fff', border: '1px solid #E5E7EB', borderRadius: 1, fontSize: 12, wordBreak: 'break-all', userSelect: 'all' }}>{link}</Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                <Button variant="outlined" onClick={copy} sx={{ textTransform: 'none' }}>Copy link</Button>
                <Button variant="outlined" onClick={resend} disabled={busy} sx={{ textTransform: 'none' }}>Email a new link</Button>
                <Button variant="outlined" color="warning" onClick={markPaid} disabled={busy} sx={{ textTransform: 'none' }}>The customer paid another way</Button>
                {busy && <CircularProgress size={22} />}
              </Box>
            </>
          )}
        </>
      ) : (
        <Alert severity={result.emailSent ? 'success' : 'warning'} sx={{ mt: 1.5 }}>
          {result.emailSent ? 'The order confirmation was emailed to the customer.' : `The confirmation email could not be sent (${result.emailError || 'unknown error'}).`}
        </Alert>
      )}
      {note && <Alert severity="success" sx={{ mt: 1.5 }}>{note}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="contained" onClick={onAnother} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#F59E0B', color: '#111', '&:hover': { bgcolor: '#D97706' } }}>Create another order</Button>
        <Button variant="text" href="/admin/orders" sx={{ textTransform: 'none' }}>Go to Orders</Button>
      </Box>
    </Paper>
  );
}
