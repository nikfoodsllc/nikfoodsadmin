'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { IconMail } from '@tabler/icons-react';

interface View {
  status: 'agreed' | 'stopped' | 'never';
  stoppedAt: string | null;
  stoppedHow: string;
  agreedAt: string | null;
}

const STYLE = {
  agreed: { label: 'Subscribed', bg: '#D1FAE5', color: '#047857' },
  stopped: { label: 'Stopped', bg: '#FEE2E2', color: '#B91C1C' },
  never: { label: 'Not subscribed', bg: '#F3F4F6', color: '#4B5563' },
} as const;

function whenText(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT';
}

/**
 * All Users > customer details: does this customer get the emails sent from the Communication tab. Shows whether they signed up
 * (menu alerts list) or stopped (unsubscribe link or an admin), and lets an admin turn their emails off or back on.
 */
export default function EmailConsentSection({ userId, token }: { userId: string; token: string | null }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!userId || !token) return;
    let alive = true;
    setView(null);
    setError('');
    setAsk(false);
    (async () => {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || 'Could not load');
        if (alive) setView(body.data);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load');
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, token]);

  const change = async (optedOut: boolean) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ optedOut }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not save the change');
      setView(body.data);
      setAsk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the change');
    } finally {
      setBusy(false);
    }
  };

  const line = (text: string, value: string) =>
    value ? (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', minWidth: 92 }}>{text}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
      </Box>
    ) : null;

  return (
    <Box sx={{ marginBottom: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1.5 }}>
        <IconMail size={16} color="#6B7280" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>Emails</Typography>
        {view && <Chip size="small" label={STYLE[view.status].label} sx={{ height: 24, fontSize: '11px', fontWeight: 600, bgcolor: STYLE[view.status].bg, color: STYLE[view.status].color }} />}
      </Box>
      {!view && !error && <CircularProgress size={18} />}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {view && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {view.status === 'never' && <Typography variant="body2" sx={{ color: '#6B7280' }}>Has not signed up for email updates. Order emails are always sent.</Typography>}
          {line('Subscribed', whenText(view.agreedAt))}
          {line('Stopped', whenText(view.stoppedAt))}
          {line('How', view.stoppedHow)}
          <Box sx={{ mt: 1 }}>
            {view.status === 'stopped' ? (
              <Button size="small" variant="outlined" disabled={busy} onClick={() => change(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {busy ? <CircularProgress size={16} /> : 'Turn emails back on'}
              </Button>
            ) : ask ? (
              <Alert severity="warning" action={<><Button size="small" color="inherit" disabled={busy} onClick={() => change(true)} sx={{ textTransform: 'none', fontWeight: 800 }}>{busy ? '...' : 'Turn off'}</Button><Button size="small" color="inherit" onClick={() => setAsk(false)} sx={{ textTransform: 'none' }}>Cancel</Button></>}>
                No more update emails to this customer. Order emails still go out.
              </Alert>
            ) : (
              <Button size="small" variant="outlined" color="error" onClick={() => setAsk(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Turn emails off
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
