'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, Paper, Typography } from '@mui/material';
import { IconRefresh } from '@tabler/icons-react';
import { audienceCounts, hasRecipients, openedText, sendLabel, sentTo, splitPeople, type AudienceData, type Person, type SendRow } from '@/utils/pushOpens';

type Call = (path: string) => Promise<{ ok: boolean; status: number; json: { data?: unknown; error?: string } }>;

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

function PersonRow({ p }: { p: Person }) {
  return (
    <Box sx={{ py: 0.75, borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{p.name || p.email || 'Customer'}</Typography>
        {p.name && p.email && <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all' }}>{p.email}</Typography>}
      </Box>
      {p.opened ? (
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Chip size="small" label="Opened" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#DCFCE7', color: '#166534' }} />
          <Typography sx={{ fontSize: 11, color: '#6B7280', mt: 0.25 }}>
            {p.firstOpenedAt ? when(p.firstOpenedAt) : ''}
            {p.openCount > 1 ? ` · ${p.openCount} times` : ''}
          </Typography>
        </Box>
      ) : (
        <Chip size="small" label="Not opened" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#F3F4F6', color: '#6B7280', flexShrink: 0 }} />
      )}
    </Box>
  );
}

/**
 * The newest notifications and how many customers tapped each one. Tap a row to see everyone it went to and who opened it. Only taps
 * are counted (iPhone does not say when a notification was only read on the lock screen), and older app versions do not report taps.
 */
export default function OpensSection({ call }: { call: Call }) {
  const [rows, setRows] = useState<SendRow[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<SendRow | null>(null);
  const [audience, setAudience] = useState<AudienceData | null>(null);

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
    setAudience(null);
    const r = await call(`opens?pushId=${encodeURIComponent(row.pushId)}`);
    setAudience(r.ok ? (r.json.data as AudienceData) : { recipientsKnown: false, people: [] });
  };

  const counts = audience ? audienceCounts(audience.people) : null;
  const split = audience ? splitPeople(audience.people) : null;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Who opened them</Typography>
        <Button size="small" onClick={load} disabled={loading} startIcon={<IconRefresh size={16} />} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Refresh
        </Button>
      </Box>
      <Typography sx={{ color: '#6B7280', fontSize: 13, mb: 1.5 }}>
        Tap a notification to see everyone it went to and who opened it. Only taps count, and phones on an older app version do not report them.
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
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: r.openedBy > 0 ? '#166534' : '#6B7280', textAlign: 'right', flexShrink: 0 }}>{openedText(r.openedBy, sentTo(r))}</Typography>
        </Box>
      ))}

      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} fullWidth maxWidth="xs" scroll="paper">
        <DialogTitle sx={{ fontWeight: 800, pr: 2 }}>
          {open?.title || (open ? sendLabel(open) : '')}
          <Typography sx={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
            {open ? `${when(open.sentAt)} · ${openedText(counts && audience?.recipientsKnown ? counts.opened : open.openedBy, audience?.recipientsKnown && counts ? counts.total : sentTo(open))}` : ''}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {audience === null && <CircularProgress size={22} />}
          {audience && !audience.recipientsKnown && (
            <Alert severity="info" sx={{ mb: 1.5, fontSize: 13 }}>
              The list of who got this one was not saved (it was sent before this list existed). Only the customers who opened it are shown.
            </Alert>
          )}
          {audience && audience.people.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>{audience.recipientsKnown ? 'Nobody to show.' : 'Nobody has opened this one.'}</Typography>}
          {split && split.opened.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#166534', mb: 0.25 }}>Opened ({split.opened.length})</Typography>
              {split.opened.map((p) => <PersonRow key={p.userId} p={p} />)}
            </>
          )}
          {split && split.notOpened.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', mt: split.opened.length > 0 ? 2 : 0, mb: 0.25 }}>Not opened ({split.notOpened.length})</Typography>
              {split.notOpened.map((p) => <PersonRow key={p.userId} p={p} />)}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
