'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { IconChevronDown, IconChevronUp, IconMail, IconPhone, IconRefresh, IconShoppingCartOff, IconShoppingCartPlus } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import AbandonedMetricsPanel from './AbandonedMetricsPanel';
import type { AbandonedMetrics, ConversionPerson } from '@/utils/abandonedMetrics';
import type { PaidReason, PaidRow } from '@/utils/abandonedPaid';
import { pacificToday, QUIET_MINUTES, reachOutEmail, RETENTION_DAYS, splitByReminder, type AbandonedRow, type ReminderView, type View } from '@/utils/abandonedCheckouts';

const REFRESH_MS = 60_000;
const money = (n: number) => `$${n.toFixed(2)}`;
const dayText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

/** The choices above the list: today, or the last 2, 5 or 7 days (checkouts are kept for 7 days). */
type Preset = 'today' | 2 | 5 | 7;

const dayShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

interface Data {
  from: string;
  to: string;
  rows: Record<View, AbandonedRow[]>;
  to_contact: number;
  contacted: number;
  valueToContact: number;
  orderedSince: number;
  metrics?: AbandonedMetrics;
  paid?: PaidRow[];
}

/** What one person left in their cart, in short lines ("2 × Veg Combo · Medium · Eco"). */
function ItemLines({ row, all }: { row: AbandonedRow; all: boolean }) {
  if (row.noItemDetails) {
    return (
      <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
        {row.itemCount} item{row.itemCount === 1 ? '' : 's'} in the cart. The item list was not saved for this checkout (it is from before we started keeping carts).
      </Typography>
    );
  }
  const shown = all ? row.items : row.items.slice(0, 3);
  return (
    <Box>
      {shown.map((item, i) => (
        <Box key={`${item.name}-${i}`} sx={{ py: 0.25 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>
            {item.quantity} × {item.name}
            <Typography component="span" sx={{ fontSize: 13, color: '#6B7280', fontWeight: 400 }}> · {money(item.lineTotal)}</Typography>
          </Typography>
          {[item.portion, item.spice, item.eco ? 'Eco container' : '', ...(item.choices ?? []), item.note ? `Note: ${item.note}` : '']
            .filter(Boolean)
            .map((line, j) => (
              <Typography key={j} sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{line}</Typography>
            ))}
        </Box>
      ))}
      {!all && row.items.length > 3 && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>+ {row.items.length - 3} more</Typography>}
    </Box>
  );
}

const REMINDER_TEXT: Record<ReminderView['state'], string> = { sending: 'Reminder email sending', sent: 'Reminder email sent', delivered: 'Reminder email delivered', bounced: 'Reminder email bounced', spam: 'Marked as spam', failed: 'Reminder email failed' };

/** What happened to the automatic reminder email: sent, delivered, opened, button clicked (each with its time). */
// the chips can be longer than a phone is wide: let their text wrap instead of being cut off
const wrapChip = { height: 'auto', maxWidth: '100%', fontWeight: 600, '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } } as const;

function ReminderLine({ reminder }: { reminder: ReminderView }) {
  const bad = reminder.state === 'bounced' || reminder.state === 'spam' || reminder.state === 'failed';
  return (
    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
      <Chip size="small" color={bad ? 'error' : 'info'} variant="outlined" label={`${REMINDER_TEXT[reminder.state]}${reminder.sentAt ? ` · ${when(reminder.sentAt)}` : ''}`} sx={wrapChip} />
      {reminder.openedAt && <Chip size="small" color="success" variant="outlined" label={`Opened${reminder.openCount && reminder.openCount > 1 ? ` (${reminder.openCount}×)` : ''} · ${when(reminder.openedAt)}`} sx={wrapChip} />}
      {reminder.clickedAt && <Chip size="small" color="success" label={`Opened the cart from the email · ${when(reminder.clickedAt)}`} sx={{ ...wrapChip, fontWeight: 700 }} />}
      {reminder.problem && <Typography sx={{ fontSize: 12, color: '#B91C1C', width: '100%' }}>{reminder.problem}</Typography>}
    </Box>
  );
}

const PAID_REASON: Record<PaidReason, { label: string; color: 'success' | 'info' | 'default' }> = {
  reminder_click: { label: 'Came back from the reminder email', color: 'success' },
  reminder: { label: 'Paid after the reminder email', color: 'success' },
  contacted: { label: 'Paid after you contacted them', color: 'info' },
  own: { label: 'Came back on their own', color: 'default' },
};

/** Someone who left checkout and later paid: how much, when, and what brought them back. */
function PaidCard({ row }: { row: PaidRow }) {
  const reason = PAID_REASON[row.reason];
  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid #BBF7D0', borderRadius: 2, minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, wordBreak: 'break-word' }}>{row.name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Left {when(row.leftAt)}</Typography>
          <Typography sx={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>Paid {when(row.paidAt)}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#047857' }}>{money(row.amount)}</Typography>
          <Typography sx={{ fontSize: 11.5, color: '#6B7280', wordBreak: 'break-all' }}>{row.orderId}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        <Chip size="small" color={reason.color} variant={reason.color === 'default' ? 'outlined' : 'filled'} label={reason.label} sx={{ ...wrapChip, fontWeight: 700 }} />
        {row.reminder && <Chip size="small" variant="outlined" label={`Reminder sent ${when(row.reminder.sentAt)}${row.reminder.opened ? ' · opened' : ''}${row.reminder.clicked ? ' · opened the cart' : ''}`} sx={wrapChip} />}
        {row.contacted && <Chip size="small" variant="outlined" label={`Contacted ${when(row.contacted.at)}${row.contacted.by ? ` by ${row.contacted.by}` : ''}${row.contacted.note ? `: ${row.contacted.note}` : ''}`} sx={wrapChip} />}
      </Box>
      {row.items.length > 0 && (
        <Box sx={{ mt: 1.25, p: 1.25, bgcolor: '#FAFAFA', borderRadius: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
          <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 0.25 }}>What they left in the cart</Typography>
          {row.items.slice(0, 3).map((item, i) => (
            <Typography key={`${item.name}-${i}`} sx={{ fontSize: 13.5, fontWeight: 600 }}>{item.quantity} × {item.name}</Typography>
          ))}
          {row.items.length > 3 && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>+ {row.items.length - 3} more</Typography>}
        </Box>
      )}
    </Paper>
  );
}

function PersonCard({ row, onHide, onRemind, onCreateOrder }: { row: AbandonedRow; onHide: (row: AbandonedRow) => void; onRemind: (row: AbandonedRow) => void; onCreateOrder: (row: AbandonedRow) => void }) {
  const [open, setOpen] = useState(false);
  const mail = reachOutEmail(row);
  const mailto = row.email ? `mailto:${row.email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}` : '';
  const phoneDigits = (row.phone ?? '').replace(/[^\d+]/g, '');
  const canExpand = row.items.length > 3;
  // the reminder email is sent from here whenever the checkout has its saved items (older ones without items still open your mail app);
  // after a send the same button sends another one, after a confirmation
  const canSendReminder = Boolean(row.email) && !row.noItemDetails;
  const reminderSentBefore = Boolean(row.reminder) && row.reminder?.state !== 'failed' && row.reminder?.state !== 'sending';

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid #E5E7EB', borderRadius: 2, minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, wordBreak: 'break-word' }}>{row.name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Left {ago(row.lastActivityAt)}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{money(row.total)}</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{row.itemCount} item{row.itemCount === 1 ? '' : 's'}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        {row.triedToPay ? <Chip size="small" color="warning" label="Pressed Pay, payment did not go through" sx={{ fontWeight: 600 }} /> : <Chip size="small" label="Never pressed Pay" sx={{ fontWeight: 600 }} />}
        {row.earlierCheckouts > 0 && <Chip size="small" variant="outlined" label={`${row.earlierCheckouts} earlier checkout${row.earlierCheckouts === 1 ? '' : 's'}`} />}
      </Box>
      {row.problem && <Typography sx={{ fontSize: 13, color: '#B45309', mt: 0.75 }}>{row.problem}</Typography>}
      {row.reminder && <ReminderLine reminder={row.reminder} />}

      <Box sx={{ mt: 1.25, p: 1.25, bgcolor: '#FAFAFA', borderRadius: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
        <ItemLines row={row} all={open} />
        <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
          {row.deliveryDates.length > 0 ? `For ${row.deliveryDates.map(dayText).join(' and ')}` : 'No delivery day saved'}
          {row.zip ? ` · zip ${row.zip}` : ''}
        </Typography>
        {canExpand && (
          <Button size="small" onClick={() => setOpen((v) => !v)} endIcon={open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />} sx={{ textTransform: 'none', mt: 0.25, ml: -1 }}>
            {open ? 'Show less' : 'Show everything'}
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
        {row.phone && (
          <Button variant="outlined" color="inherit" href={`tel:${phoneDigits}`} startIcon={<IconPhone size={18} />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 42, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            Call {row.phone}
          </Button>
        )}
        {row.email && (
          <Button
            variant="outlined"
            color="inherit"
            disabled={row.reminder?.state === 'sending'}
            {...(canSendReminder ? { onClick: () => onRemind(row) } : { href: mailto })}
            startIcon={<IconMail size={18} />}
            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 42, flex: { xs: '1 1 100%', sm: '0 0 auto' }, maxWidth: '100%', '& .MuiButton-startIcon': { flexShrink: 0 } }}
          >
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{canSendReminder ? (reminderSentBefore ? 'Send reminder again' : 'Send reminder email') : `Email ${row.email}`}</Box>
          </Button>
        )}
        {!row.phone && !row.email && <Typography sx={{ fontSize: 13, color: '#B45309' }}>No phone or email saved for this person.</Typography>}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
        <Button
          variant="contained"
          onClick={() => onCreateOrder(row)}
          startIcon={<IconShoppingCartPlus size={18} />}
          sx={{ textTransform: 'none', fontWeight: 800, minHeight: 42, flex: 1, bgcolor: '#F59E0B', color: '#111', '&:hover': { bgcolor: '#D97706' } }}
        >
          Create offline order
        </Button>
        <Button onClick={() => onHide(row)} sx={{ textTransform: 'none', minHeight: 42 }}>Hide</Button>
      </Box>
    </Paper>
  );
}

/** The people behind Successful / Unsuccessful Conversions: who we emailed, and what they ordered (or what is still in their cart). */
function ConversionDialog({ kind, people, onClose, onOpenPerson, hasRow }: { kind: 'successful' | 'unsuccessful' | null; people: ConversionPerson[]; onClose: () => void; onOpenPerson: (userId: string) => void; hasRow: (userId: string) => boolean }) {
  const ok = kind === 'successful';
  return (
    <Dialog open={Boolean(kind)} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pb: 0.5 }}>{ok ? 'Successful Conversions' : 'Unsuccessful Conversions'}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1.5 }}>
          {ok ? 'People we emailed who then ordered within 7 days of the email.' : 'People we emailed who have not ordered since. Tap a name to see their cart.'}
        </Typography>
        {people.length === 0 && <Typography sx={{ fontSize: 14, color: '#6B7280' }}>{ok ? 'Nobody has ordered after a reminder yet.' : 'Everyone we emailed has ordered.'}</Typography>}
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {people.map((p) => {
            const canOpen = !ok && hasRow(p.userId);
            return (
              <Paper
                key={p.userId}
                elevation={0}
                {...(canOpen ? { role: 'button', tabIndex: 0, onClick: () => onOpenPerson(p.userId), onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpenPerson(p.userId)) } : {})}
                sx={{ p: 1.25, border: `1px solid ${ok ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 1.5, minWidth: 0, ...(canOpen ? { cursor: 'pointer', '&:hover': { bgcolor: '#FFF8EC' } } : {}) }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 15, wordBreak: 'break-word' }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Emailed {when(p.emailedAt)}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    {p.order ? (
                      <>
                        <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#047857' }}>{money(p.order.amount)}</Typography>
                        {p.order.orderId && <Typography sx={{ fontSize: 11.5, color: '#6B7280', wordBreak: 'break-all' }}>{p.order.orderId}</Typography>}
                      </>
                    ) : p.cart ? (
                      <>
                        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{money(p.cart.total)}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{p.cart.itemCount} item{p.cart.itemCount === 1 ? '' : 's'}</Typography>
                      </>
                    ) : null}
                  </Box>
                </Box>
                {p.order && <Typography sx={{ fontSize: 12, color: '#047857', fontWeight: 600, mt: 0.25 }}>Ordered {when(p.order.paidAt)}</Typography>}
                {p.cart && p.cart.items.length > 0 && (
                  <Typography sx={{ fontSize: 12.5, color: '#4B5563', mt: 0.5, overflowWrap: 'anywhere' }}>
                    {p.cart.items.slice(0, 4).map((i) => `${i.quantity} × ${i.name}`).join(' · ')}
                    {p.cart.items.length > 4 ? ` · + ${p.cart.items.length - 4} more` : ''}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AbandonedCheckoutsPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>(7);
  const today = pacificToday();
  // what to ask the server for
  const queryString = preset === 'today' ? `from=${today}&to=${today}` : `days=${preset}`;
  const [tab, setTab] = useState<'waiting' | 'sent' | 'recovered'>('waiting');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // the details of one person (from Most left behind or a conversion list), and the Successful / Unsuccessful Conversions lists
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [conversionKind, setConversionKind] = useState<'successful' | 'unsuccessful' | null>(null);
  const [hideRow, setHideRow] = useState<AbandonedRow | null>(null);
  const [remindRow, setRemindRow] = useState<AbandonedRow | null>(null);
  const remindAgain = Boolean(remindRow?.reminder) && remindRow?.reminder?.state !== 'failed' && remindRow?.reminder?.state !== 'sending';
  const [snack, setSnack] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(
    async (quiet = false) => {
      if (!token || !queryString) return;
      if (!quiet) setRefreshing(true);
      try {
        const res = await fetch(`/api/admin/abandoned-checkouts?${queryString}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) throw new Error(body.error || 'Could not load the abandoned checkouts');
        setData(body.data);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the abandoned checkouts');
      }
      setRefreshing(false);
    },
    [token, queryString]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === 'visible' && void load(true), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const act = async (row: AbandonedRow, action: 'dismiss', message?: string) => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/abandoned-checkouts/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || 'Could not save that');
      setSnack(message ?? 'Saved');
      await load(true);
    } catch (e) {
      setSnack(e instanceof Error ? e.message : 'Could not save that');
    }
    setSaving(false);
  };

  // sends the cart reminder email from the site's own sender (the same email the automatic reminder uses)
  const sendReminder = async (row: AbandonedRow, again: boolean) => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/abandoned-checkouts/remind', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: row.id, ...(again ? { again: true } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || 'Could not send the reminder');
      setSnack(again ? 'Another reminder sent' : 'Reminder sent');
      await load(true);
    } catch (e) {
      setSnack(e instanceof Error ? e.message : 'Could not send the reminder');
    }
    setSaving(false);
  };

  if (authLoading || !isAuthenticated || !token) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  // everyone still unpaid, split by whether the reminder email went out (the old "contacted" marker no longer matters)
  const split = splitByReminder([...(data?.rows.to_contact ?? []), ...(data?.rows.contacted ?? [])]);
  const rows = tab === 'waiting' ? split.waiting : tab === 'sent' ? split.emailed : [];
  const paidRows = data?.paid ?? [];
  const allRows = [...split.waiting, ...split.emailed];
  const waitingValue = Math.round(split.waiting.reduce((sum, r) => sum + r.total, 0) * 100) / 100;
  const detailRow = detailUserId ? allRows.find((r) => r.userId === detailUserId) ?? null : null;
  const createOrderFor = (row: AbandonedRow) => router.push(`/admin/create-order?fromCheckout=${encodeURIComponent(row.id)}`);

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto', pb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Abandoned Checkout</Typography>
          <Chip label="BETA" size="small" color="warning" sx={{ fontWeight: 800 }} />
        </Box>
        <Button size="small" onClick={() => void load()} disabled={refreshing} startIcon={refreshing ? <CircularProgress size={14} /> : <IconRefresh size={16} />} sx={{ textTransform: 'none' }}>Refresh</Button>
      </Box>
      <Typography sx={{ fontSize: 14, color: '#6B7280', mb: 1.5 }}>
        People who opened checkout but did not pay. They show up here {QUIET_MINUTES} minutes after they leave, and disappear as soon as they place an order.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
        <ToggleButtonGroup exclusive size="small" value={preset} onChange={(_, v: Preset | null) => v && setPreset(v)} sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 1.25 }, '& .Mui-selected': { bgcolor: '#FDE9C4 !important', color: '#7A4300' } }}>
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value={2}>2 days</ToggleButton>
          <ToggleButton value={5}>5 days</ToggleButton>
          <ToggleButton value={7}>7 days</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {data && (
        <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 1.5 }}>
          Showing checkouts opened {data.from === data.to ? dayShort(data.from) : `${dayShort(data.from)} – ${dayShort(data.to)}`} (Pacific time). Checkouts are kept for {RETENTION_DAYS} days.
        </Typography>
      )}

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!data && !error && <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>}

      {data && (
        <>
          {data.metrics && <AbandonedMetricsPanel metrics={data.metrics} onOpenConversions={setConversionKind} onOpenPerson={setDetailUserId} />}
          <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid #FBD38D', bgcolor: '#FFF8EC', borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
              {split.waiting.length === 0 ? 'No one is waiting for the reminder email' : `${split.waiting.length} ${split.waiting.length === 1 ? 'person' : 'people'} waiting for the reminder email · ${money(waitingValue)} in their carts`}
            </Typography>
            {data.orderedSince > 0 && (
              <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.25 }}>
                {data.orderedSince} other {data.orderedSince === 1 ? 'person' : 'people'} left a checkout but ordered afterwards, so they are not listed.
              </Typography>
            )}
          </Paper>

          <Tabs value={tab} onChange={(_, v: 'waiting' | 'sent' | 'recovered') => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ mb: 1.25, minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 } }}>
            <Tab value="waiting" label={`Waiting to send email (${split.waiting.length})`} />
            <Tab value="sent" label={`Email sent (${split.emailed.length})`} />
            <Tab value="recovered" label={`Recovered (${paidRows.length})`} />
          </Tabs>

          {tab === 'recovered' && paidRows.length === 0 && (
            <Paper elevation={0} sx={{ p: 3, border: '1px dashed #D1D5DB', borderRadius: 2, textAlign: 'center' }}>
              <Box sx={{ color: '#9CA3AF', mb: 0.5 }}><IconShoppingCartOff size={32} /></Box>
              <Typography sx={{ fontWeight: 700 }}>Nobody has been recovered yet</Typography>
              <Typography sx={{ fontSize: 13, color: '#6B7280' }}>People who leave checkout and later pay show up here, with what brought them back.</Typography>
            </Paper>
          )}
          {tab === 'recovered' && paidRows.length > 0 && (
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {paidRows.map((row) => <PaidCard key={row.orderId} row={row} />)}
            </Box>
          )}
          {tab !== 'recovered' && rows.length === 0 && (
            <Paper elevation={0} sx={{ p: 3, border: '1px dashed #D1D5DB', borderRadius: 2, textAlign: 'center' }}>
              <Box sx={{ color: '#9CA3AF', mb: 0.5 }}><IconShoppingCartOff size={32} /></Box>
              <Typography sx={{ fontWeight: 700 }}>{tab === 'waiting' ? 'Nobody is waiting for the reminder email' : 'No reminder email has gone out yet'}</Typography>
              <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
                {tab === 'waiting' ? `When someone opens checkout and leaves without paying, they appear here after ${QUIET_MINUTES} minutes, until their reminder email goes out (about 30 minutes after they left).` : 'People who got the reminder email and have not ordered yet are listed here.'}
              </Typography>
            </Paper>
          )}
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {rows.map((row) => (
              <PersonCard key={row.id} row={row} onHide={setHideRow} onRemind={setRemindRow} onCreateOrder={createOrderFor} />
            ))}
          </Box>
        </>
      )}

      <Dialog open={Boolean(detailUserId)} onClose={() => setDetailUserId(null)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pb: 0.5 }}>{detailRow?.name ?? 'Details'}</DialogTitle>
        <DialogContent dividers>
          {detailRow ? (
            <PersonCard
              row={detailRow}
              onHide={(r) => {
                setDetailUserId(null);
                setHideRow(r);
              }}
              onRemind={(r) => {
                setDetailUserId(null);
                setRemindRow(r);
              }}
              onCreateOrder={createOrderFor}
            />
          ) : (
            <Typography sx={{ fontSize: 14, color: '#6B7280' }}>This person is not on the list any more (they may have ordered or been hidden since).</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailUserId(null)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConversionDialog
        kind={conversionKind}
        people={conversionKind ? data?.metrics?.conversions[conversionKind] ?? [] : []}
        onClose={() => setConversionKind(null)}
        onOpenPerson={(userId) => {
          setConversionKind(null);
          setDetailUserId(userId);
        }}
        hasRow={(userId) => allRows.some((r) => r.userId === userId)}
      />

      <Dialog open={Boolean(remindRow)} onClose={() => setRemindRow(null)} fullWidth maxWidth="xs">
        <DialogTitle>{remindAgain ? 'Send another reminder to' : 'Send the reminder to'} {remindRow?.name.split(' ')[0] ?? 'them'}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ overflowWrap: 'anywhere' }}>
            {remindAgain && remindRow?.reminder?.sentAt ? `A reminder already went out ${when(remindRow.reminder.sentAt)}. ` : ''}
            The cart reminder email goes to {remindRow?.email} now, from the NikFoods sender. Its button brings them back to checkout with their items.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemindRow(null)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              const row = remindRow;
              const again = remindAgain;
              setRemindRow(null);
              if (row) await sendReminder(row, again);
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {remindAgain ? 'Send again' : 'Send reminder'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(hideRow)} onClose={() => setHideRow(null)} fullWidth maxWidth="xs">
        <DialogTitle>Hide {hideRow?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>They will not appear in this list again unless they start a new checkout. Use this for tests or people you do not want to contact.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHideRow(null)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button
            variant="contained"
            color="inherit"
            disabled={saving}
            onClick={async () => {
              const row = hideRow;
              setHideRow(null);
              if (row) await act(row, 'dismiss', 'Hidden');
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Hide
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={3500} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
