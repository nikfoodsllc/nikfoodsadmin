'use client';

import { useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Typography } from '@mui/material';
import { pacificText } from '@/utils/communication';

export interface DraftSummary {
  id: string;
  title: string;
  preview: string;
  kind: 'delivery_date' | 'menu_day' | 'ordered_between' | 'people' | 'all' | 'subscribers';
  date: string;
  from: string;
  to: string;
  peopleCount: number;
  channels: { email: boolean; text: boolean };
  updatedAt: string;
  updatedBy: string;
  createdBy: string;
}

const dayShort = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

/** Who the draft is for, in a few words (the customers themselves are looked up again when the draft is opened). */
export function draftAudience(d: Pick<DraftSummary, 'kind' | 'date' | 'from' | 'to' | 'peopleCount'>): string {
  const extra = d.kind !== 'people' && d.peopleCount > 0 ? ` + ${d.peopleCount} added` : '';
  switch (d.kind) {
    case 'delivery_date':
      return `Due for delivery${d.date ? ` ${dayShort(d.date)}` : ''}${extra}`;
    case 'menu_day':
      return `Ordered for the ${d.date ? dayShort(d.date) : 'chosen'} menu${extra}`;
    case 'ordered_between':
      return `Ordered ${d.from ? dayShort(d.from) : '?'} to ${d.to ? dayShort(d.to) : '?'}${extra}`;
    case 'people':
      return `${d.peopleCount} chosen ${d.peopleCount === 1 ? 'person' : 'people'}`;
    case 'subscribers':
      return `Agreed to emails${extra}`;
    default:
      return `Everyone${extra}`;
  }
}

interface Props {
  token: string;
  drafts: DraftSummary[] | null;
  error: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onChanged: () => void;
}

/** The messages that were started and not sent. Anyone on the team can carry on with or delete a draft. */
export default function DraftsTab({ token, drafts, error, onOpen, onNew, onChanged }: Props) {
  const [removing, setRemoving] = useState<DraftSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setFail('');
    try {
      const res = await fetch(`/api/admin/communication-drafts/${removing.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('failed');
      setRemoving(null);
      onChanged();
    } catch {
      setFail('Could not delete the draft. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!drafts && !error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ color: '#6B7280', fontSize: 13.5 }}>A message you start is saved here as you write it. Everyone on the team sees these drafts.</Typography>
        <Button size="small" variant="outlined" onClick={onNew} sx={{ textTransform: 'none', fontWeight: 700 }}>Write a new message</Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {drafts && drafts.length === 0 && <Typography sx={{ color: '#6B7280' }}>No drafts. A message you start writing appears here.</Typography>}
      {(drafts ?? []).map((d) => (
        <Paper key={d.id} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, wordBreak: 'break-word' }}>{d.title}</Typography>
              {d.preview && <Typography sx={{ fontSize: 13.5, color: '#54442F', mt: 0.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>{d.preview}</Typography>}
              <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.5 }}>
                {draftAudience(d)} · {[d.channels.email && 'Email', d.channels.text && 'Text'].filter(Boolean).join(' + ') || 'No channel'}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#6B7280' }}>
                Saved {pacificText(d.updatedAt)}
                {d.updatedBy ? ` by ${d.updatedBy}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip size="small" label="Draft" sx={{ bgcolor: '#F3F4F6', color: '#4B5563', fontWeight: 700 }} />
              <Button size="small" variant="contained" onClick={() => onOpen(d.id)} sx={{ textTransform: 'none', fontWeight: 700 }}>Continue</Button>
              <Button size="small" color="error" onClick={() => setRemoving(d)} sx={{ textTransform: 'none', fontWeight: 700 }}>Delete</Button>
            </Box>
          </Box>
        </Paper>
      ))}

      <Dialog open={Boolean(removing)} onClose={() => !busy && setRemoving(null)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete this draft?</DialogTitle>
        <DialogContent>
          <DialogContentText>“{removing?.title}” will be removed for everyone. Messages already sent are not affected.</DialogContentText>
          {fail && <Alert severity="error" sx={{ mt: 1.5 }}>{fail}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)} disabled={busy} sx={{ textTransform: 'none' }}>Keep it</Button>
          <Button color="error" variant="contained" onClick={remove} disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>{busy ? <CircularProgress size={18} /> : 'Delete draft'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
