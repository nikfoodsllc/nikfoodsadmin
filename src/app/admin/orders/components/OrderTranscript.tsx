'use client';

import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import type { TranscriptEvent, TranscriptKind } from '@/lib/orderTranscript';

const TONE: Record<TranscriptKind, { dot: string; label: string }> = {
  order: { dot: '#6366F1', label: 'Order' },
  payment: { dot: '#16A34A', label: 'Payment' },
  email: { dot: '#0EA5E9', label: 'Email' },
  date: { dot: '#D97706', label: 'Delivery date' },
  credit: { dot: '#059669', label: 'Store credit' },
  refund: { dot: '#0369A1', label: 'Refund' },
  status: { dot: '#7C3AED', label: 'Status' },
  route: { dot: '#475569', label: 'OptimoRoute' },
  delivery: { dot: '#16A34A', label: 'Delivery' },
  cancel: { dot: '#DC2626', label: 'Cancelled' },
};

const SHOWN = 6;

function whenText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
}

/** Order details: everything that happened to the order (payment, emails, delivery date moves, credit, refunds, status), newest first. */
export default function OrderTranscript({ orderId, token, version }: { orderId: string; token: string | null; /** changes when the order changes, to reload */ version?: string }) {
  const [events, setEvents] = useState<TranscriptEvent[] | null>(null);
  const [error, setError] = useState('');
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!token || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/history`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) throw new Error(body?.error || 'Could not load the history');
        setEvents(body.data?.events ?? []);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the history');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, token, version]);

  const shown = events ? (all ? events : events.slice(0, SHOWN)) : [];

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
        Order History
      </Typography>
      {!events && !error && <CircularProgress size={18} />}
      {error && <Typography sx={{ fontSize: 13, color: '#B91C1C' }}>{error}</Typography>}
      {events && events.length === 0 && <Typography sx={{ fontSize: 13, color: '#6B7280' }}>Nothing recorded yet.</Typography>}
      {shown.length > 0 && (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, position: 'relative' }}>
          {shown.map((e, i) => (
            <Box component="li" key={`${e.at}-${i}`} sx={{ display: 'flex', gap: 1.5, pb: i === shown.length - 1 ? 0 : 1.75, position: 'relative' }}>
              <Box sx={{ position: 'relative', width: 14, flexShrink: 0 }}>
                <Box sx={{ position: 'absolute', top: 5, left: 2, width: 10, height: 10, borderRadius: '50%', bgcolor: TONE[e.kind].dot }} />
                {i < shown.length - 1 && <Box sx={{ position: 'absolute', top: 18, bottom: -8, left: '6px', width: '2px', bgcolor: '#E5E7EB' }} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827', overflowWrap: 'anywhere' }}>{e.text}</Typography>
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                  {whenText(e.at)}
                  {e.by ? ` · ${e.by}` : ''}
                </Typography>
                {(e.details ?? []).map((d, j) => (
                  <Typography key={j} sx={{ fontSize: 13, color: '#374151', pl: 1, overflowWrap: 'anywhere' }}>
                    • {d}
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {events && events.length > SHOWN && (
        <Button size="small" onClick={() => setAll((v) => !v)} sx={{ textTransform: 'none', mt: 1 }}>
          {all ? 'Show fewer' : `Show all (${events.length})`}
        </Button>
      )}
    </Box>
  );
}
