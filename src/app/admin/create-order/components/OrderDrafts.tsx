'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Typography } from '@mui/material';
import { pacificText } from '@/utils/communication';

export interface OrderDraftSummary {
  id: string;
  title: string;
  summary: string;
  payment: 'link' | 'zelle' | 'paid' | 'quote';
  updatedAt: string;
  updatedBy: string;
  createdBy: string;
}

const PAYMENT: Record<OrderDraftSummary['payment'], string> = { link: 'Payment link', zelle: 'Zelle', paid: 'Already paid', quote: 'Quote' };

/** Orders that were started and not created. Anyone on the team can carry on with or delete a draft. */
export default function OrderDrafts({ token, version, onOpen, onNew, onCount }: { token: string; version: number; onOpen: (id: string) => void; onNew: () => void; onCount: (n: number) => void }) {
  const [drafts, setDrafts] = useState<OrderDraftSummary[] | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<OrderDraftSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/create-order-drafts', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('failed');
      setDrafts(json.data.drafts as OrderDraftSummary[]);
      onCount((json.data.drafts as unknown[]).length);
      setError('');
    } catch {
      setError('Could not load the drafts. Please try again.');
    }
  }, [token, onCount]);
  useEffect(() => {
    void load();
  }, [load, version]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setFail('');
    try {
      const res = await fetch(`/api/admin/create-order-drafts/${removing.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('failed');
      setRemoving(null);
      await load();
    } catch {
      setFail('Could not delete the draft. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!drafts && !error) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ color: '#6B7280', fontSize: 13.5 }}>An order you start is saved here as you enter it. Everyone on the team sees these drafts.</Typography>
        <Button size="small" variant="outlined" onClick={onNew} sx={{ textTransform: 'none', fontWeight: 700 }}>Start a new order</Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {drafts && drafts.length === 0 && <Typography sx={{ color: '#6B7280' }}>No drafts. An order you start entering appears here.</Typography>}
      {(drafts ?? []).map((d) => (
        <Paper key={d.id} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, wordBreak: 'break-word' }}>{d.title}</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#54442F', mt: 0.25 }}>{d.summary}</Typography>
              <Typography sx={{ fontSize: 12.5, color: '#6B7280', mt: 0.25 }}>
                Saved {pacificText(d.updatedAt)}{d.updatedBy ? ` by ${d.updatedBy}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" label={PAYMENT[d.payment]} sx={{ bgcolor: '#F3F4F6', color: '#4B5563', fontWeight: 700 }} />
              <Button size="small" variant="contained" color="warning" onClick={() => onOpen(d.id)} sx={{ textTransform: 'none', fontWeight: 700 }}>Continue</Button>
              <Button size="small" color="error" onClick={() => setRemoving(d)} sx={{ textTransform: 'none', fontWeight: 700 }}>Delete</Button>
            </Box>
          </Box>
        </Paper>
      ))}

      <Dialog open={Boolean(removing)} onClose={() => !busy && setRemoving(null)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete this draft?</DialogTitle>
        <DialogContent>
          <DialogContentText>The draft for “{removing?.title}” will be removed for everyone. No order is created or cancelled.</DialogContentText>
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
