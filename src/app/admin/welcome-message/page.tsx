'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';
import { IconMessage2 } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import AppHomeTextCard from './AppHomeTextCard';

export default function Page() {
  const router = useRouter();
  const { token, isAuthenticated, loading } = useAuth();
  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
  }, [loading, isAuthenticated, router]);
  if (loading || !isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1.5, sm: 3 } }}>
      <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconMessage2 size={26} /> Welcome Msg
      </Typography>
      <Typography sx={{ color: '#6B7280', mb: 2, fontSize: 14 }}>The greeting at the top of the NikFoods app&apos;s home screen.</Typography>
      <AppHomeTextCard token={token} />
    </Box>
  );
}
