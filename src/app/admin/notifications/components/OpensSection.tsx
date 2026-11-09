'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, Paper, Typography } from '@mui/material';
import { IconRefresh } from '@tabler/icons-react';
import { hasRecipients, openedText, sendLabel, type Opener, type SendRow } from '@/utils/pushOpens';

type Call = (path: string) => Promise<{ ok: boolean; status: number; json: { data?: unknown; error?: string } }>;

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

/**
 * The newest notifications and how many customers tapped each one. Tap a row to see who. Only taps are counted (iPhone does not say
 * when a notification was only read on the lock screen), and older app versions do not report taps.
 */
export default function OpensSection({ call }: { call: Call }) {
  const [rows, setRows] = useState<SendRow[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<SendRow | null>(null);
  const [openers, setOpeners] = useState<Opener[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call('opens?limit=30&days=30');
    if (r.ok) {
      setRows((r.json.data as { sends: SendRow[] }).sends.filter(hasRecipients));
      setError('');
    } else setError(r.json.error || 'Could not load.');
    setLoading(false);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const show = async (row: SendRow) => {
    setOpen(row);
    setOpeners(null);
    const r = await call(`opens?pushId=${encodeURIComponent(row.pushId)}`);
    setOpeners(r.ok ? (r.json.data as { openers: Opener[] }).openers : []);
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Who opened them</Typography>
        <Button size="small" onClick={load} disabled={loading} startIcon={<IconRefresh size={16} />} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Refresh
        </Button>
      </Box>
      <Typography sx={{ color: '#6B7280', fontSize: 13, mb: 1.5 }}>
        Customers who tapped the notification, for the last 30 days. Only taps count, and phones on an older app version do not report them.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {loading && !rows && <CircularProgress size={22} />}
      {rows && rows.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>No notifications sent yet.</Typography>}
      {rows?.map((r) => (
        <Box
          key={r.pushId}
          role="button"
          tabIndex={0}
          onClick={() => void show(r)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && void show(r)}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, py: 1, borderTop: '1px solid #F3F4F6', cursor: 'pointer', '&:hover': { bgcolor: '#FAFAFA' } }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{r.title || sendLabel(r)}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{sendLabel(r)} · {when(r.sentAt)}</Typography>
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: r.openedBy > 0 ? '#166534' : '#6B7280', textAlign: 'right', flexShrink: 0 }}>{openedText(r.openedBy, r.customers)}</Typography>
        </Box>
      ))}

      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800, pr: 2 }}>
          {open?.title || (open ? sendLabel(open) : '')}
          <Typography sx={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{open ? `${when(open.sentAt)} · ${openedText(open.openedBy, open.customers)}` : ''}</Typography>
        </DialogTitle>
        <DialogContent>
          {openers === null && <CircularProgress size={22} />}
          {openers && openers.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Nobody has opened this one.</Typography>}
          {openers?.map((o) => (
            <Box key={o.userId} sx={{ py: 0.75, borderTop: '1px solid #F3F4F6' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{o.name || o.email || 'Customer'}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all' }}>
                {o.name && o.email ? `${o.email} · ` : ''}opened {when(o.firstOpenedAt)}
                {o.openCount > 1 ? ` · ${o.openCount} times` : ''}
              </Typography>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
