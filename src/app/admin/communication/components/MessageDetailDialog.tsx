'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import { audienceTitle, countLine, pacificText, previewHtml, whenText } from '@/utils/communication';
import { FILTER_LABEL, emailStats, filterCounts, matchesFilter, recipientsCsv, type RecipientFilter } from '@/utils/emailStats';
import { downloadCSV } from '@/utils/csv';
import type { MessageSummary } from './HistoryTab';

interface Recipient {
  name: string;
  channel: 'email' | 'text';
  email?: string;
  phone?: string;
  orders: string[];
  status: string;
  reason?: string;
  error?: string;
  sentAt?: string;
  deliveredAt?: string;
  bouncedAt?: string;
  firstOpenedAt?: string;
  openCount: number;
  dry?: boolean;
}

interface Detail {
  campaign: MessageSummary & { emailBody: string; emailFormat?: 'text' | 'html'; textBody: string };
  recipients: Recipient[];
}

const TONE: Record<string, { bg: string; color: string }> = {
  queued: { bg: '#F3F4F6', color: '#4B5563' },
  sending: { bg: '#FEF3C7', color: '#92400E' },
  sent: { bg: '#E0F2FE', color: '#075985' },
  delivered: { bg: '#DCFCE7', color: '#166534' },
  delayed: { bg: '#FEF3C7', color: '#92400E' },
  bounced: { bg: '#FEE2E2', color: '#991B1B' },
  complained: { bg: '#FEE2E2', color: '#991B1B' },
  failed: { bg: '#FEE2E2', color: '#991B1B' },
  skipped: { bg: '#F3F4F6', color: '#6B7280' },
};

export default function MessageDetailDialog({ token, id, onClose, onChanged }: { token: string; id: string | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [stopping, setStopping] = useState(false);
  const [filter, setFilter] = useState<RecipientFilter>('all');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/communications/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Could not load this message.');
      setDetail(json.data as Detail);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this message.');
    }
  }, [id, token]);

  useEffect(() => {
    setDetail(null);
    setError('');
    setFilter('all');
    load();
  }, [load]);

  const running = detail?.campaign.status === 'sending' || detail?.campaign.status === 'scheduled';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [running, load]);

  const stop = async () => {
    if (!id) return;
    setStopping(true);
    const res = await fetch(`/api/admin/communications/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    setStopping(false);
    if (!res.ok || json?.success === false) setError(json?.error || 'Could not stop it.');
    await load();
    onChanged();
  };

  const c = detail?.campaign;
  const emailRows = (detail?.recipients ?? []).filter((r) => r.channel === 'email');
  const stats = c ? emailStats(c.counts.email, c.opened?.email) : null;
  const filterN = filterCounts(emailRows);
  const shown = (detail?.recipients ?? []).filter((r) => r.channel !== 'email' || matchesFilter(r, filter));
  const downloadList = () => {
    const rows = emailRows.filter((r) => matchesFilter(r, filter));
    downloadCSV(recipientsCsv(rows, (iso) => (iso ? pacificText(iso) : '')), `email-${filter}-${(c?.subject || 'message').replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40)}.csv`);
  };
  return (
    <Dialog open={Boolean(id)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ wordBreak: 'break-word' }}>{c ? c.subject || (c.channels.text ? 'Text message' : 'Message') : 'Message'}</DialogTitle>
      <DialogContent dividers>
        {!detail && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {c && (
          <>
            <Typography sx={{ fontSize: 13.5, color: '#6B7280', mb: 1 }}>
              {[audienceTitle(c.filter), whenText(c), c.finishedAt ? `finished ${pacificText(c.finishedAt)}` : '', c.createdBy?.name ? `by ${c.createdBy.name}` : ''].filter(Boolean).join(' · ')}
            </Typography>
            {c.channels.email && stats && (
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
                  {[
                    { label: 'Sent', value: stats.sent, sub: '', tone: '#111827' },
                    { label: 'Delivered', value: stats.delivered, sub: `${stats.deliveryRate}% of sent`, tone: '#166534' },
                    { label: 'Opened', value: stats.opened, sub: `${stats.openRate}% of delivered`, tone: '#1D4ED8' },
                    { label: 'Bounced / spam', value: stats.bounced + stats.complained, sub: `${stats.problemRate}% of sent`, tone: stats.bounced + stats.complained > 0 ? '#B91C1C' : '#111827' },
                  ].map((t) => (
                    <Box key={t.label} sx={{ border: '1px solid #E5E7EB', borderRadius: 1.5, px: 1.25, py: 1, bgcolor: '#fff' }}>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.label}</Typography>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, color: t.tone, lineHeight: 1.2 }}>{t.value}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#6B7280', minHeight: 16 }}>{t.sub}</Typography>
                    </Box>
                  ))}
                </Box>
                {(stats.failed > 0 || stats.waiting > 0 || stats.skipped > 0) && (
                  <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.75 }}>
                    {[stats.waiting > 0 && `${stats.waiting} still waiting`, stats.failed > 0 && `${stats.failed} could not be sent`, stats.skipped > 0 && `${stats.skipped} skipped`].filter(Boolean).join(' · ')}
                  </Typography>
                )}
              </Box>
            )}
            {c.channels.text && <Typography sx={{ fontSize: 14 }}><b>Text</b> {countLine(c.counts.text)}</Typography>}
            {c.emailBody && c.channels.email && (
              <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#FFFBF5', border: '1px solid #EADBC3', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#A85A00', letterSpacing: '0.08em' }}>EMAIL{c.emailFormat === 'html' ? ' (CUSTOM DESIGN, SAMPLE NAME)' : ''}</Typography>
                {c.emailFormat === 'html' ? (
                  <Box component="iframe" title="Email" sandbox="" srcDoc={previewHtml(c.emailBody, { firstName: 'Alex', orderNumber: 'ORD-0000000000000', date: '' })} sx={{ width: '100%', height: 420, border: '1px solid #EADBC3', borderRadius: 1, bgcolor: '#fff', mt: 0.5 }} />
                ) : (
                  <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 13.5, wordBreak: 'break-word' }}>{c.emailBody}</Typography>
                )}
              </Box>
            )}
            {c.textBody && c.channels.text && (
              <Box sx={{ mt: 1, p: 1.25, bgcolor: '#E5F2FF', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', letterSpacing: '0.08em' }}>TEXT</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 13.5, wordBreak: 'break-word' }}>{c.textBody}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mt: 2, mb: 0.75 }}>
              <Typography sx={{ fontWeight: 800 }}>Customers</Typography>
              {c.channels.email && emailRows.length > 0 && (
                <Button size="small" startIcon={<IconDownload size={16} />} onClick={downloadList} disabled={filterN[filter] === 0} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Download list ({filterN[filter]})
                </Button>
              )}
            </Box>
            {c.channels.email && emailRows.length > 0 && (
              <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ flexWrap: 'wrap', mb: 1, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, fontSize: 13 } }}>
                {(Object.keys(FILTER_LABEL) as RecipientFilter[]).map((f) => (
                  <ToggleButton key={f} value={f}>
                    {FILTER_LABEL[f]} ({filterN[f]})
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
            <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1.5, maxHeight: 420, overflowY: 'auto' }}>
              {shown.map((r, i) => {
                const tone = TONE[r.status] ?? TONE.queued;
                const note = r.error || r.reason || '';
                return (
                  <Box key={i} sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', px: 1.25, py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5, wordBreak: 'break-word' }}>{r.name || 'No name'} <Box component="span" sx={{ fontWeight: 500, color: '#6B7280' }}>· {r.channel === 'email' ? 'Email' : 'Text'}</Box></Typography>
                      <Typography sx={{ fontSize: 12.5, color: '#6B7280', wordBreak: 'break-word' }}>
                        {r.channel === 'email' ? r.email ?? 'No email' : r.phone ?? 'No phone'}
                        {r.openCount > 0 ? ` · opened${r.firstOpenedAt ? ` ${pacificText(r.firstOpenedAt)}` : ''}${r.openCount > 1 ? ` · ${r.openCount} times` : ''}` : r.channel === 'email' && r.status === 'delivered' ? ' · not opened yet' : ''}
                        {r.dry ? ' · practice (not delivered)' : ''}
                      </Typography>
                      {note && <Typography sx={{ fontSize: 12, color: '#B45309', wordBreak: 'break-word' }}>{note}</Typography>}
                    </Box>
                    <Chip size="small" label={r.status} sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 700, alignSelf: 'flex-start' }} />
                  </Box>
                );
              })}
              {detail.recipients.length > 0 && shown.length === 0 && <Typography sx={{ p: 1.5, color: '#6B7280', fontSize: 14 }}>No one in this list.</Typography>}
              {detail.recipients.length === 0 && <Typography sx={{ p: 1.5, color: '#6B7280', fontSize: 14 }}>The customers are looked up when the message starts.</Typography>}
            </Box>
            <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 1 }}>“Opened” is only a hint: some mail apps open messages by themselves, so the real number can be lower. Opens are counted once per customer. Clicks are not tracked.{detail.recipients.length >= 1000 ? ' Showing the first 1000 customers.' : ''}</Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {running && (
          <Button color="error" onClick={stop} disabled={stopping} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {stopping ? <CircularProgress size={18} /> : c?.status === 'scheduled' ? 'Cancel this message' : 'Stop sending'}
          </Button>
        )}
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
