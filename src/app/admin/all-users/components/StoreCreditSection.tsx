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
  byName?: string;
  items?: Array<{ name: string; quantity: number; amount: number }>;
  order?: { placedAt?: string; total?: number; status?: string };
  balanceAfter?: number;
}

const LABEL: Record<HistoryRow['type'], string> = { issued: 'Credit given', used: 'Used on an order', restored: 'Given back', adjusted: 'Adjusted by an admin' };
const TONE: Record<HistoryRow['type'], { bg: string; fg: string }> = {
  issued: { bg: '#DCFCE7', fg: '#166534' },
  used: { bg: '#E0F2FE', fg: '#075985' },
  restored: { bg: '#FEF3C7', fg: '#92400E' },
  adjusted: { bg: '#F3F4F6', fg: '#374151' },
};
const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;

function whenText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
}

function dayText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
}

/** All Users > customer details: the customer's store credit balance, what happened to it, and a manual change (reason required). */
export default function StoreCreditSection({ userId, token, detailed = false }: { userId: string; token: string | null; detailed?: boolean }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(detailed);
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
            {history.length > 0 && !detailed && (
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
            <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {history.map((row, index) => {
                const tone = TONE[row.type];
                const items = row.items ?? [];
                return (
                  <Box key={`${row.at}-${index}`} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, bgcolor: '#fff', p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 700 }}>{LABEL[row.type]}</Box>
                        {row.orderId && <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827', mt: 0.75, overflowWrap: 'anywhere' }}>Order {row.orderId}</Typography>}
                      </Box>
                      <Typography sx={{ fontSize: 18, fontWeight: 700, color: row.amount >= 0 ? '#166534' : '#374151', whiteSpace: 'nowrap' }}>
                        {row.amount >= 0 ? '+' : '-'}
                        {money(row.amount)}
                      </Typography>
                    </Box>

                    <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
                      {whenText(row.at)}
                      {row.byName ? ` · by ${row.byName}` : ''}
                    </Typography>
                    {row.order && (
                      <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                        {[
                          row.order.placedAt ? `Placed ${dayText(row.order.placedAt)}` : '',
                          typeof row.order.total === 'number' ? `Order total ${money(row.order.total)}` : '',
                          row.order.status ? row.order.status.charAt(0).toUpperCase() + row.order.status.slice(1) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    )}

                    {items.length > 0 && (
                      <Box sx={{ mt: 1, bgcolor: '#F9FAFB', borderRadius: 1.5, px: 1.25, py: 0.5 }}>
                        {items.map((it, i) => (
                          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5, borderTop: i === 0 ? 'none' : '1px solid #EEF0F3' }}>
                            <Typography sx={{ fontSize: 13, color: '#111827', overflowWrap: 'anywhere' }}>
                              {it.name}
                              {it.quantity > 1 ? <span style={{ color: '#6B7280' }}> × {it.quantity}</span> : null}
                            </Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{money(it.amount)}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}

                    {row.reason && <Typography sx={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', mt: 1, overflowWrap: 'anywhere' }}>Note: {row.reason}</Typography>}
                    {row.balanceAfter !== undefined && <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.75, textAlign: 'right' }}>Balance after: {money(row.balanceAfter)}</Typography>}
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
}
