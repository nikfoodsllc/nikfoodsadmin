'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { isStaleVersionError, mayAutoReload } from '@/utils/staleVersionError';

/**
 * Shown instead of Next's bare "Application error" page when a screen crashes. A page left open across a new release reloads
 * itself (once); any other crash says what happened and offers Try again and Reload.
 */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleVersionError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error('Screen crashed:', error);
    if (stale && mayAutoReload(typeof window !== 'undefined' ? window.sessionStorage : null)) {
      setReloading(true);
      window.location.reload();
    }
  }, [error, stale]);

  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ maxWidth: 420, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          {reloading ? 'Loading the latest version…' : stale ? 'A new version is available' : 'Something went wrong on this page'}
        </Typography>
        <Typography sx={{ color: '#6B7280', mb: 2 }}>
          {stale ? 'This page was open while an update went live. Reload to continue.' : 'Your changes were not lost on the server. Try again, or reload the page.'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!stale && <Button variant="outlined" onClick={() => reset()} sx={{ textTransform: 'none' }}>Try again</Button>}
          <Button variant="contained" onClick={() => window.location.reload()} sx={{ textTransform: 'none' }}>Reload</Button>
        </Box>
        {!stale && error?.message && (
          <Typography sx={{ mt: 2, fontSize: 12, color: '#9CA3AF', wordBreak: 'break-word' }}>{`Error: ${String(error.message).slice(0, 200)}`}</Typography>
        )}
      </Box>
    </Box>
  );
}
