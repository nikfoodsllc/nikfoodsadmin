'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Snackbar, Tab, Tabs, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import NewMessage from './NewMessage';
import HistoryTab from './HistoryTab';

/**
 * Communication (BETA): pick customers by delivery date, menu day or when they ordered, write a message and send it by email
 * and/or text, now or later. Everything is found and sent by the customer site; this screen only asks.
 */
export default function CommunicationPage() {
  const { token, user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [snack, setSnack] = useState('');

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

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #E5E7EB' }}>
        <Tab value="new" label="New message" />
        <Tab value="history" label="History" />
      </Tabs>

      {tab === 'new' ? (
        <NewMessage
          token={token}
          adminEmail={user?.email ?? ''}
          onSent={(message) => {
            setSnack(message);
            setTab('history');
          }}
        />
      ) : (
        <HistoryTab token={token} />
      )}

      <Snackbar open={Boolean(snack)} autoHideDuration={6000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
