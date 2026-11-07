'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import { audienceTitle, countLine, totalOf, whenText, type AudienceFilter } from '@/utils/communication';
import MessageDetailDialog from './MessageDetailDialog';

export interface MessageSummary {
  id: string;
  filter: AudienceFilter;
  channels: { email: boolean; text: boolean };
  subject: string;
  status: 'scheduled' | 'sending' | 'done' | 'cancelled';
  scheduledFor?: string;
  createdAt: string;
  createdBy: { id: string; name?: string };
  startedAt?: string;
  finishedAt?: string;
  audienceSize?: number;
  counts: { email: Record<string, number>; text: Record<string, number> };
}

const STATUS: Record<MessageSummary['status'], { label: string; bg: string; color: string }> = {
  scheduled: { label: 'Scheduled', bg: '#DBEAFE', color: '#1E40AF' },
  sending: { label: 'Sending', bg: '#FEF3C7', color: '#92400E' },
  done: { label: 'Done', bg: '#DCFCE7', color: '#166534' },
  cancelled: { label: 'Stopped', bg: '#F3F4F6', color: '#4B5563' },
};

const REFRESH_MS = 10_000;

export default function HistoryTab({ token }: { token: string }) {
  const [messages, setMessages] = useState<MessageSummary[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/communications', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Could not load the history.');
      setMessages(json.data.messages as MessageSummary[]);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the history.');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // while something is going out, keep the numbers fresh
  const active = (messages ?? []).some((m) => m.status === 'sending' || m.status === 'scheduled');
  useEffect(() => {
    if (!active) return;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [active, load]);

  if (!messages && !error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {messages && messages.length === 0 && <Typography sx={{ color: '#6B7280' }}>Nothing has been sent yet.</Typography>}
      {(messages ?? []).map((m) => {
        const s = STATUS[m.status];
        return (
          <Paper key={m.id} onClick={() => setOpen(m.id)} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, wordBreak: 'break-word', minWidth: 0 }}>{m.subject || (m.channels.text ? 'Text message' : 'Message')}</Typography>
              <Chip size="small" label={s.label} sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700 }} />
            </Box>
            <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.25 }}>
              {audienceTitle(m.filter)} · {[m.channels.email && 'Email', m.channels.text && 'Text'].filter(Boolean).join(' + ')}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
              {[whenText(m), m.createdBy?.name ? `by ${m.createdBy.name}` : ''].filter(Boolean).join(' · ')}
            </Typography>
            {m.channels.email && totalOf(m.counts.email) > 0 && <Typography sx={{ fontSize: 13.5, mt: 0.75 }}><b>Email</b> {countLine(m.counts.email)}</Typography>}
            {m.channels.text && totalOf(m.counts.text) > 0 && <Typography sx={{ fontSize: 13.5 }}><b>Text</b> {countLine(m.counts.text)}</Typography>}
          </Paper>
        );
      })}
      <MessageDetailDialog token={token} id={open} onClose={() => setOpen(null)} onChanged={load} />
    </Box>
  );
}
