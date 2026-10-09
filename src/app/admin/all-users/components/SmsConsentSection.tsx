'use client';

import { useEffect, useState } from 'react';
import { Box, Chip, CircularProgress, Typography } from '@mui/material';
import { IconMessage } from '@tabler/icons-react';
import type { SmsConsentView } from '@/utils/smsConsentView';

interface SmsText {
  kind: string;
  status: string;
  mode: string;
  at: string | null;
}

const KIND_WORDS: Record<string, string> = { welcome: 'Welcome text', delivery_date_changed: 'Delivery date changed' };

function whenText(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT';
}

function phoneText(digits: string | null): string {
  return digits && digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : '';
}

const STATUS_STYLE = {
  agreed: { label: 'Agreed to texts', bg: '#D1FAE5', color: '#047857' },
  stopped: { label: 'Stopped', bg: '#FEE2E2', color: '#B91C1C' },
  never: { label: 'Not asked / no', bg: '#F3F4F6', color: '#4B5563' },
} as const;

/** All Users > customer details: whether the customer agreed to text messages, where, when and with which wording. Read only. */
export default function SmsConsentSection({ userId, token }: { userId: string; token: string | null }) {
  const [view, setView] = useState<SmsConsentView | null>(null);
  const [texts, setTexts] = useState<SmsText[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId || !token) return;
    let alive = true;
    setView(null);
    setTexts([]);
    setError('');
    (async () => {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/sms`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || 'Could not load');
        if (!alive) return;
        setView(body.data.consent);
        setTexts(body.data.texts ?? []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load');
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, token]);

  const label = (text: string, value: string) =>
    value ? (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', minWidth: 92 }}>{text}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
      </Box>
    ) : null;

  return (
    <Box sx={{ marginBottom: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1.5 }}>
        <IconMessage size={16} color="#6B7280" />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>Text messages</Typography>
        {view && <Chip size="small" label={STATUS_STYLE[view.status].label} sx={{ height: 24, fontSize: '11px', fontWeight: 600, bgcolor: STATUS_STYLE[view.status].bg, color: STATUS_STYLE[view.status].color }} />}
      </Box>
      {!view && !error && <CircularProgress size={18} />}
      {error && <Typography variant="body2" sx={{ color: '#DC2626' }}>{error}</Typography>}
      {view && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {view.status === 'never' && <Typography variant="body2" sx={{ color: '#6B7280' }}>No agreement on record. No texts are sent to this customer.</Typography>}
          {label('Number', view.status === 'never' ? '' : phoneText(view.phone))}
          {label('Agreed', whenText(view.agreedAt))}
          {label('Where', view.agreedHow)}
          {label('Wording', view.version ? `Version ${view.version}` : '')}
          {label('Stopped', whenText(view.stoppedAt))}
          {label('How', view.stoppedHow)}
          {texts.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>Last texts</Typography>
              {texts.map((t, i) => (
                <Typography key={i} variant="body2" sx={{ fontSize: 13 }}>
                  {KIND_WORDS[t.kind] ?? t.kind} · {t.mode === 'dry' ? 'test mode, not sent' : t.status} · {whenText(t.at)}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
