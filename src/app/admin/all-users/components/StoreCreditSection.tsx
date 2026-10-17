'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Collapse, TextField, Typography } from '@mui/material';
import { IconCoin } from '@tabler/icons-react';

interface HistoryRow {
  at: string;
  amount: number;
  type: 'issued' | 'used' | 'restored' | 'adjusted';
  orderId?: string;
  reason?: string;
  balanceAfter?: number;
}

const LABEL: Record<HistoryRow['type'], string> = { issued: 'Credit given', used: 'Used on an order', restored: 'Given back', adjusted: 'Adjusted by an admin' };
const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;

function whenText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
}

/** All Users > customer details: the customer's store credit balance, what happened to it, and a manual change (reason required). */
export default function StoreCreditSection({ userId, token }: { userId: string; token: string | null }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/store-credit`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success === false) throw new Error(body?.error || 'Could not load');
      setBalance(Number(body.data.balance) || 0);
      setHistory(Array.isArray(body.data.history) ? body.data.history : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [userId, token]);

  useEffect(() => {
    setBalance(null);
    setHistory([]);
    setError('');
    setNote('');
    setAdjustOpen(false);
    void load();
  }, [load]);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      setError('Enter an amount. Use a minus sign to remove credit.');
      return;
    }
    if (!reason.trim()) {
      setError('Write a reason.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/store-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ amount: value, reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success === false) throw new Error(body?.error || 'Could not change the credit.');
      setNote(`Done. The balance is now ${money(Number(body.data.balance) || 0)}.`);
      setAmount('');
      setReason('');
      setAdjustOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the credit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ marginBottom: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1.5 }}>
        <IconCoin size={16} color="#6B7280" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>Store credit</Typography>
        {balance !== null && (
          <Typography variant="body2" sx={{ fontWeight: 700, color: balance > 0 ? '#166534' : '#6B7280' }}>
            {money(balance)}
          </Typography>
        )}
      </Box>
      {balance === null && !error && <CircularProgress size={18} />}
      {error && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{error}</Alert>}
      {note && <Alert severity="success" sx={{ mb: 1, py: 0 }}>{note}</Alert>}
      {balance !== null && (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" onClick={() => setAdjustOpen((v) => !v)} sx={{ textTransform: 'none' }}>
              Change credit
            </Button>
            {history.length > 0 && (
              <Button size="small" onClick={() => setShowHistory((v) => !v)} sx={{ textTransform: 'none' }}>
                {showHistory ? 'Hide history' : `History (${history.length})`}
              </Button>
            )}
          </Box>
          <Collapse in={adjustOpen} unmountOnExit>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 420 }}>
              <TextField size="small" label="Amount (use - to remove)" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ inputMode: 'decimal' }} />
              <TextField size="small" label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="contained" onClick={submit} disabled={busy} sx={{ textTransform: 'none' }}>
                  {busy ? <CircularProgress size={16} color="inherit" /> : 'Save'}
                </Button>
                <Button size="small" onClick={() => setAdjustOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>
                  Cancel
                </Button>
              </Box>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>For credit for a missing item, use the order instead: it works out the amount and emails the customer.</Typography>
            </Box>
          </Collapse>
          <Collapse in={showHistory} unmountOnExit>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {history.map((row, index) => (
                <Box key={`${row.at}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2">
                      {LABEL[row.type]}
                      {row.orderId ? ` · ${row.orderId}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6B7280', overflowWrap: 'anywhere' }}>
                      {whenText(row.at)}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: row.amount >= 0 ? '#166534' : '#374151', whiteSpace: 'nowrap' }}>
                    {row.amount >= 0 ? '+' : '-'}
                    {money(row.amount)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
}
