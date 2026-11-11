'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Snackbar, Tab, Tabs, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import NewMessage from './NewMessage';
import HistoryTab from './HistoryTab';
import DraftsTab, { type DraftSummary } from './DraftsTab';
import type { DraftContent } from '@/utils/communicationDraft';

/**
 * Communication (BETA): pick customers by delivery date, menu day or when they ordered, write a message and send it by email
 * and/or text, now or later. Everything is found and sent by the customer site; this screen only asks.
 */
export default function CommunicationPage() {
  const { token, user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'new' | 'drafts' | 'history'>('new');
  const [snack, setSnack] = useState('');
  // the draft the form was opened from (the form restarts, with a new key, whenever another draft or a blank message is opened)
  const [draft, setDraft] = useState<{ id: string; content: DraftContent; updatedBy?: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [draftsError, setDraftsError] = useState('');

  const refreshDrafts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/communication-drafts', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load the drafts.');
      setDrafts(json.data.drafts as DraftSummary[]);
      setDraftsError('');
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : 'Could not load the drafts.');
    }
  }, [token]);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  const openDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/communication-drafts/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not open the draft.');
      setDraft({ id: json.data.id, content: json.data.content as DraftContent, updatedBy: json.data.updatedBy });
      setFormKey((k) => k + 1);
      setTab('new');
    } catch (e) {
      setSnack(e instanceof Error ? e.message : 'Could not open the draft.');
      refreshDrafts();
    }
  };

  const startBlank = () => {
    setDraft(null);
    setFormKey((k) => k + 1);
    setTab('new');
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !token) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 0, sm: 1 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        Communication <Box component="span" sx={{ fontSize: 13, fontWeight: 700, color: '#92400E', ml: 0.5 }}>(BETA)</Box>
      </Typography>
      <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 2 }}>Send an update to the customers of a delivery day, a menu day, or a period. Email now, text when the text service is on.</Typography>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); if (v === 'drafts') refreshDrafts(); }} sx={{ mb: 2, borderBottom: '1px solid #E5E7EB' }}>
        <Tab value="new" label="New message" />
        <Tab value="drafts" label={`Drafts${drafts && drafts.length > 0 ? ` (${drafts.length})` : ''}`} />
        <Tab value="history" label="History" />
      </Tabs>

      {/* the form stays alive while another tab is open, so nothing typed is lost by looking at History */}
      <Box sx={{ display: tab === 'new' ? 'block' : 'none' }}>
        <NewMessage
          key={formKey}
          token={token}
          adminEmail={user?.email ?? ''}
          initialDraft={draft}
          active={tab === 'new'}
          onDraftsChanged={refreshDrafts}
          onSent={(message) => {
            setSnack(message);
            setDraft(null);
            setFormKey((k) => k + 1);
            setTab('history');
          }}
        />
      </Box>
      {tab === 'drafts' && <DraftsTab token={token} drafts={drafts} error={draftsError} onOpen={openDraft} onNew={startBlank} onChanged={refreshDrafts} />}
      {tab === 'history' && <HistoryTab token={token} />}

      <Snackbar open={Boolean(snack)} autoHideDuration={6000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
