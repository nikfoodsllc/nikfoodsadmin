'use client';

import { useEffect } from 'react';
import { isStaleVersionError, mayAutoReload } from '@/utils/staleVersionError';

/** The last safety net, for a crash in the page frame itself (it replaces the whole page, so it has its own html and styles). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const stale = isStaleVersionError(error);
  useEffect(() => {
    console.error('Page frame crashed:', error);
    if (stale && mayAutoReload(typeof window !== 'undefined' ? window.sessionStorage : null)) window.location.reload();
  }, [error, stale]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px' }}>{stale ? 'A new version is available' : 'Something went wrong'}</h2>
            <p style={{ color: '#6B7280', margin: '0 0 16px' }}>{stale ? 'This page was open while an update went live. Reload to continue.' : 'Please reload the page.'}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontSize: 16, border: 0, borderRadius: 8, background: '#4F8CFF', color: '#fff', cursor: 'pointer' }}>Reload</button>
            {!stale && error?.message && <p style={{ marginTop: 16, fontSize: 12, color: '#9CA3AF', wordBreak: 'break-word' }}>{`Error: ${String(error.message).slice(0, 200)}`}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
