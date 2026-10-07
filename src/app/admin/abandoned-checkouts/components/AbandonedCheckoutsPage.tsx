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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { IconChevronDown, IconChevronUp, IconMail, IconPhone, IconRefresh, IconShoppingCartOff } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { CONTACT_NOTES, QUIET_MINUTES, reachOutEmail, type AbandonedRow, type View } from '@/utils/abandonedCheckouts';

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

interface Data {
  days: number;
  rows: Record<View, AbandonedRow[]>;
  to_contact: number;
  contacted: number;
  valueToContact: number;
  orderedSince: number;
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

function PersonCard({ row, onContacted, onUndo, onHide }: { row: AbandonedRow; onContacted: (row: AbandonedRow) => void; onUndo: (row: AbandonedRow) => void; onHide: (row: AbandonedRow) => void }) {
  const [open, setOpen] = useState(false);
  const mail = reachOutEmail(row);
  const mailto = row.email ? `mailto:${row.email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}` : '';
  const phoneDigits = (row.phone ?? '').replace(/[^\d+]/g, '');
  const canExpand = row.items.length > 3;

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
        {row.previouslyContactedAt && <Chip size="small" variant="outlined" label={`Contacted before (${when(row.previouslyContactedAt)})`} />}
      </Box>
      {row.problem && <Typography sx={{ fontSize: 13, color: '#B45309', mt: 0.75 }}>{row.problem}</Typography>}

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
          <Button variant="outlined" color="inherit" href={`tel:${phoneDigits}`} startIcon={<IconPhone size={18} />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 42, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}>
            Call {row.phone}
          </Button>
        )}
        {row.email && (
          <Button variant="outlined" color="inherit" href={mailto} startIcon={<IconMail size={18} />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 42, flex: { xs: '1 1 140px', sm: '0 0 auto' }, maxWidth: '100%', '& .MuiButton-startIcon': { flexShrink: 0 } }}>
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Email {row.email}</Box>
          </Button>
        )}
        {!row.phone && !row.email && <Typography sx={{ fontSize: 13, color: '#B45309' }}>No phone or email saved for this person.</Typography>}
      </Box>

      {row.contacted ? (
        <Box sx={{ mt: 1.25, p: 1.25, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 1.5, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13 }}>
            Contacted {when(row.contacted.at)}{row.contacted.by ? ` by ${row.contacted.by}` : ''}{row.contacted.note ? `: ${row.contacted.note}` : ''}
          </Typography>
          <Button size="small" onClick={() => onUndo(row)} sx={{ textTransform: 'none' }}>Undo</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
          <Button variant="contained" onClick={() => onContacted(row)} sx={{ textTransform: 'none', fontWeight: 800, minHeight: 42, flex: 1, bgcolor: '#F59E0B', color: '#111', '&:hover': { bgcolor: '#D97706' } }}>
            Mark as contacted
          </Button>
          <Button onClick={() => onHide(row)} sx={{ textTransform: 'none', minHeight: 42 }}>Hide</Button>
        </Box>
      )}
    </Paper>
  );
}

export default function AbandonedCheckoutsPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [days, setDays] = useState(14);
  const [tab, setTab] = useState<View>('to_contact');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [contactRow, setContactRow] = useState<AbandonedRow | null>(null);
  const [note, setNote] = useState('');
  const [hideRow, setHideRow] = useState<AbandonedRow | null>(null);
  const [snack, setSnack] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setRefreshing(true);
      try {
        const res = await fetch(`/api/admin/abandoned-checkouts?days=${days}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) throw new Error(body.error || 'Could not load the abandoned checkouts');
        setData(body.data);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the abandoned checkouts');
      }
      setRefreshing(false);
    },
    [token, days]
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

  const act = async (row: AbandonedRow, action: 'contacted' | 'undo_contacted' | 'dismiss', noteText?: string, message?: string) => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/abandoned-checkouts/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(noteText ? { note: noteText } : {}) }),
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

  if (authLoading || !isAuthenticated || !token) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  const rows = data?.rows[tab] ?? [];

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

      <ToggleButtonGroup exclusive size="small" value={days} onChange={(_, v: number | null) => v && setDays(v)} sx={{ mb: 1.5, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 1.5 }, '& .Mui-selected': { bgcolor: '#FDE9C4 !important', color: '#7A4300' } }}>
        <ToggleButton value={7}>Last 7 days</ToggleButton>
        <ToggleButton value={14}>14 days</ToggleButton>
        <ToggleButton value={30}>30 days</ToggleButton>
      </ToggleButtonGroup>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!data && !error && <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>}

      {data && (
        <>
          <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid #FBD38D', bgcolor: '#FFF8EC', borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
              {data.to_contact === 0 ? 'No one is waiting to be contacted' : `${data.to_contact} ${data.to_contact === 1 ? 'person' : 'people'} to contact · ${money(data.valueToContact)} in their carts`}
            </Typography>
            {data.orderedSince > 0 && (
              <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.25 }}>
                {data.orderedSince} other {data.orderedSince === 1 ? 'person' : 'people'} left a checkout but ordered afterwards, so they are not listed.
              </Typography>
            )}
          </Paper>

          <Tabs value={tab} onChange={(_, v: View) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ mb: 1.25, minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 } }}>
            <Tab value="to_contact" label={`To contact (${data.to_contact})`} />
            <Tab value="contacted" label={`Contacted (${data.contacted})`} />
          </Tabs>

          {rows.length === 0 && (
            <Paper elevation={0} sx={{ p: 3, border: '1px dashed #D1D5DB', borderRadius: 2, textAlign: 'center' }}>
              <Box sx={{ color: '#9CA3AF', mb: 0.5 }}><IconShoppingCartOff size={32} /></Box>
              <Typography sx={{ fontWeight: 700 }}>{tab === 'to_contact' ? 'Nobody to follow up with right now' : 'Nobody has been contacted yet'}</Typography>
              <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
                {tab === 'to_contact' ? `When someone opens checkout and leaves without paying, they appear here after ${QUIET_MINUTES} minutes.` : 'People you mark as contacted move here, with your note.'}
              </Typography>
            </Paper>
          )}
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {rows.map((row) => (
              <PersonCard
                key={row.id}
                row={row}
                onContacted={(r) => {
                  setNote('');
                  setContactRow(r);
                }}
                onUndo={(r) => void act(r, 'undo_contacted', undefined, 'Moved back to To contact')}
                onHide={setHideRow}
              />
            ))}
          </Box>
        </>
      )}

      <Dialog open={Boolean(contactRow)} onClose={() => setContactRow(null)} fullWidth maxWidth="xs">
        <DialogTitle>How did you reach {contactRow?.name.split(' ')[0] ?? 'them'}?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {CONTACT_NOTES.map((n) => (
              <Chip key={n} label={n} onClick={() => setNote(n)} color={note === n ? 'warning' : 'default'} variant={note === n ? 'filled' : 'outlined'} sx={{ fontWeight: 600 }} />
            ))}
          </Box>
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} size="small" fullWidth placeholder="Anything you want to remember" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactRow(null)} sx={{ textTransform: 'none' }}>Back</Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              const row = contactRow;
              setContactRow(null);
              if (row) await act(row, 'contacted', note.trim(), 'Marked as contacted');
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Save
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
              if (row) await act(row, 'dismiss', undefined, 'Hidden');
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
