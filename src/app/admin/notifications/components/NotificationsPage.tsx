'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Snackbar, TextField, Typography } from '@mui/material';
import { IconBell, IconSend, IconTrash, IconUserCheck } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import AppCustomersTab from './AppCustomersTab';
import AppUpdateCard from './AppUpdateCard';

const TITLE_MAX = 40;
const BODY_MAX = 150;

interface Template {
  _id: string;
  name: string;
  title: string;
  body: string;
}
interface Campaign {
  _id: string;
  title: string;
  body: string;
  sentAt: string;
  by: string;
  audience: number;
  sent: number;
  failed: number;
  mode: string;
}
interface Summary {
  mode: 'off' | 'dry' | 'on';
  customersWithApp: number;
  menu: { subscribers: number; subscribersWithApp: number; reachable: number };
  templates: Template[];
  campaigns: Campaign[];
  last7: Array<{ event: string; messages: number; sent: number; failed: number }>;
}

/** The notifications the site sends by itself, and when. The counts come from the last 7 days. */
const AUTOMATIC: Array<{ event: string; label: string; when: string }> = [
  { event: 'confirmed', label: 'Order confirmed', when: 'When the payment goes through.' },
  { event: 'payment_failed', label: "Payment didn't go through", when: 'When a card payment fails on the website or in the app.' },
  { event: 'on_the_way', label: 'Out for delivery', when: 'When the driver is on the way to the customer in OptimoRoute (checked every 5 minutes).' },
  { event: 'delivered', label: 'Delivered', when: 'When the driver completes the stop in OptimoRoute (checked every 5 minutes).' },
  { event: 'rescheduled', label: 'Delivery date changed', when: 'When you press Tell the customer on a moved order.' },
  { event: 'payment_link', label: 'Payment link', when: 'When a payment link is emailed or sent again from Create Order.' },
  { event: 'cart_reminder', label: 'Cart reminder', when: 'About 30 minutes after someone leaves checkout, only if they turned cart reminders on (they are off until the customer chooses).' },
];

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

/** What the notification looks like on a phone (the real one is drawn by iOS; this is close enough to judge the words). */
function Preview({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ bgcolor: '#E9EDF2', borderRadius: 3, p: 1.5 }}>
      <Box sx={{ bgcolor: 'rgba(255,255,255,0.92)', borderRadius: '16px', p: 1.5, display: 'flex', gap: 1.25, alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '9px', bgcolor: '#F89C35', color: '#2A1700', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>n</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#111827', wordBreak: 'break-word' }}>{title || 'Title'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>now</Typography>
          </Box>
          <Typography sx={{ fontSize: 14, color: '#111827', wordBreak: 'break-word' }}>{body || 'Your message appears here.'}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** One page for each of the two Mobile App menu items: the push notifications (view send) and the customers who use the app (view customers). */
export default function NotificationsPage({ view = 'send' }: { view?: 'send' | 'customers' }) {
  const router = useRouter();
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmSend, setConfirmSend] = useState<false | 'first' | 'again'>(false);
  const [againMessage, setAgainMessage] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [notice, setNotice] = useState('');
  const tab = view;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const call = useCallback(
    async (path: string, method = 'GET', payload?: unknown) => {
      const response = await fetch(`/api/admin/notifications/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      });
      const json = await response.json().catch(() => ({}));
      return { ok: response.ok && json.success !== false, status: response.status, json };
    },
    [token]
  );

  const load = useCallback(async () => {
    if (!token) return;
    const r = await call('summary');
    if (r.ok) {
      setData(r.json.data as Summary);
      setError('');
    } else setError(r.json.error || 'Could not load notifications');
    setLoading(false);
  }, [call, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const picked = useMemo(() => data?.templates.find((t) => t._id === selected) ?? null, [data, selected]);
  const changed = Boolean(picked && (picked.title !== title.trim() || picked.body !== body.trim()));
  const textOk = title.trim().length > 0 && body.trim().length > 0 && title.length <= TITLE_MAX && body.length <= BODY_MAX;

  const choose = (t: Template) => {
    setSelected(t._id);
    setTitle(t.title);
    setBody(t.body);
  };

  const send = async (again: boolean) => {
    setBusy(true);
    const r = await call('send-menu', 'POST', { title, body, ...(again ? { confirmAgain: true } : {}) });
    setBusy(false);
    setConfirmSend(false);
    if (r.ok) {
      const d = r.json.data as { mode: string; audience: number; phones: number; sent: number; failed: number };
      setNotice(d.mode === 'dry' ? `Test run: it would go to ${d.phones} phone${d.phones === 1 ? '' : 's'}. Nothing was sent.` : `Sent to ${d.sent} phone${d.sent === 1 ? '' : 's'}${d.failed ? ` (${d.failed} could not be reached)` : ''}.`);
      void load();
    } else if (r.json.code === 'recent') {
      setAgainMessage(r.json.error);
      setConfirmSend('again');
    } else setNotice(r.json.error || 'Could not send');
  };

  const sendTest = async () => {
    setBusy(true);
    const r = await call('test', 'POST', { email: testEmail, title, body });
    setBusy(false);
    if (r.ok) {
      const d = r.json.data as { mode: string; phones: number; sent: number; failed: number };
      setNotice(d.mode === 'dry' ? `Test run only: it would go to ${d.phones} phone${d.phones === 1 ? '' : 's'}.` : d.sent > 0 ? 'Test notification sent. Look at that phone.' : 'Apple/Expo did not accept it. The phone may have been removed; open the app on it again.');
      setTestOpen(false);
      void load();
    } else setNotice(r.json.error || 'Could not send the test');
  };

  const saveNew = async () => {
    setBusy(true);
    const r = await call('templates', 'POST', { name: saveName, title, body });
    setBusy(false);
    if (r.ok) {
      setSaveOpen(false);
      setSaveName('');
      setNotice('Saved. It is in your list now.');
      await load();
      setSelected((r.json.data as Template)._id);
    } else setNotice(r.json.error || 'Could not save');
  };

  const updatePicked = async () => {
    if (!picked) return;
    setBusy(true);
    const r = await call(`templates/${picked._id}`, 'PUT', { name: picked.name, title, body });
    setBusy(false);
    setNotice(r.ok ? 'Saved.' : r.json.error || 'Could not save');
    if (r.ok) await load();
  };

  const removePicked = async () => {
    if (!picked) return;
    setBusy(true);
    const r = await call(`templates/${picked._id}`, 'DELETE');
    setBusy(false);
    if (r.ok) {
      setSelected('');
      setNotice('Removed.');
      await load();
    } else setNotice(r.json.error || 'Could not remove');
  };

  if (authLoading || !isAuthenticated || !token || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const reach = data?.menu.reachable ?? 0;
  const counts = new Map((data?.last7 ?? []).map((r) => [r.event, r]));

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 1.5, sm: 3 } }}>
      <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        {view === 'customers' ? <IconUserCheck size={26} /> : <IconBell size={26} />} {view === 'customers' ? 'App Customers' : 'Push Notification'}
      </Typography>
      <Typography sx={{ color: '#6B7280', mb: 2, fontSize: 14 }}>{view === 'customers' ? 'Who uses the NikFoods app and whether their phone allows notifications.' : 'What customers with the NikFoods app get on their phone.'}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data?.mode === 'off' && <Alert severity="warning" sx={{ mb: 2 }}>Notifications are switched off on this site, so nothing is sent. They are turned on with the PUSH setting.</Alert>}
      {data?.mode === 'dry' && <Alert severity="info" sx={{ mb: 2 }}>Test mode: the site works out who would get each message but sends nothing.</Alert>}
      {data?.mode === 'on' && <Alert severity="success" sx={{ mb: 2 }}>Notifications are on. {data.customersWithApp} customer{data.customersWithApp === 1 ? '' : 's'} have the app with notifications allowed.</Alert>}


      {tab === 'customers' && <AppCustomersTab call={call} />}

      {tab === 'send' && (
        <>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Menu update</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 1.5 }}>
          Sent to customers who have the app with notifications allowed and menu alerts on: <b>{reach}</b> can get it now ({data?.menu.subscribersWithApp ?? 0} have the app).
        </Typography>

        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>Your saved texts</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          {data?.templates.map((t) => (
            <Chip key={t._id} label={t.name} onClick={() => choose(t)} color={selected === t._id ? 'warning' : 'default'} variant={selected === t._id ? 'filled' : 'outlined'} sx={{ fontWeight: 600 }} />
          ))}
        </Box>

        <TextField fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={{ mb: 1.5 }} error={title.length > TITLE_MAX} helperText={`${title.length}/${TITLE_MAX}`} slotProps={{ htmlInput: { 'aria-label': 'Notification title' } }} />
        <TextField fullWidth multiline minRows={2} label="Message" value={body} onChange={(e) => setBody(e.target.value)} size="small" error={body.length > BODY_MAX} helperText={`${body.length}/${BODY_MAX}`} sx={{ mb: 1.5 }} slotProps={{ htmlInput: { 'aria-label': 'Notification message' } }} />

        <Preview title={title} body={body} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          <Button variant="contained" color="warning" startIcon={<IconSend size={18} />} disabled={!textOk || busy || reach === 0 || data?.mode === 'off'} onClick={() => setConfirmSend('first')} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Send to {reach} customer{reach === 1 ? '' : 's'}
          </Button>
          <Button variant="outlined" color="warning" disabled={!textOk || busy || data?.mode === 'off'} onClick={() => setTestOpen(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Send a test
          </Button>
          <Button variant="text" disabled={!textOk || busy} onClick={() => setSaveOpen(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Save as new text
          </Button>
          {picked && (
            <>
              <Button variant="text" disabled={!changed || !textOk || busy} onClick={updatePicked} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Update “{picked.name}”
              </Button>
              <Button variant="text" color="error" startIcon={<IconTrash size={16} />} disabled={busy} onClick={removePicked} sx={{ textTransform: 'none' }}>
                Delete
              </Button>
            </>
          )}
        </Box>
        {reach === 0 && <Typography sx={{ color: '#92400E', fontSize: 13, mt: 1 }}>Nobody can get this yet: it needs a customer who has the app, has notifications allowed, and has menu alerts on.</Typography>}
      </Paper>

      <AppUpdateCard call={call} mode={data?.mode} onSent={() => void load()} />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.5 }}>Sent automatically</Typography>
        <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 1.5 }}>These go out on their own. Counts are the last 7 days. Customers can switch each kind off in the app (order updates, menu alerts, cart reminders).</Typography>
        {AUTOMATIC.map((a, i) => {
          const c = counts.get(a.event);
          return (
            <Box key={a.event} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1.1, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{a.label}</Typography>
                <Typography sx={{ color: '#6B7280', fontSize: 13 }}>{a.when}</Typography>
              </Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: c?.sent ? '#166534' : '#9CA3AF', whiteSpace: 'nowrap' }}>{c ? `${c.sent} sent${c.failed ? `, ${c.failed} failed` : ''}` : '0 sent'}</Typography>
            </Box>
          );
        })}
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>Menu updates sent</Typography>
        {data?.campaigns.length === 0 && <Typography sx={{ color: '#9CA3AF', fontSize: 14 }}>Nothing sent yet.</Typography>}
        {data?.campaigns.map((c, i) => (
          <Box key={c._id} sx={{ py: 1.1, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{c.title}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{when(c.sentAt)}</Typography>
            </Box>
            <Typography sx={{ fontSize: 13, color: '#374151' }}>{c.body}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
              {c.mode === 'dry' ? 'Test run, nothing sent' : `${c.sent} sent${c.failed ? `, ${c.failed} could not be reached` : ''}`}
              {c.by ? ` · ${c.by}` : ''}
            </Typography>
          </Box>
        ))}
      </Paper>

        </>
      )}

      <Dialog open={confirmSend !== false} onClose={() => setConfirmSend(false)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmSend === 'again' ? 'Send another?' : `Send to ${reach} customer${reach === 1 ? '' : 's'}?`}</DialogTitle>
        <DialogContent>
          {confirmSend === 'again' ? <DialogContentText sx={{ mb: 1.5 }}>{againMessage}</DialogContentText> : <DialogContentText sx={{ mb: 1.5 }}>This goes to their phones right now and cannot be taken back.</DialogContentText>}
          <Preview title={title} body={body} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSend(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={busy} onClick={() => send(confirmSend === 'again')} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {busy ? 'Sending…' : 'Send now'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={testOpen} onClose={() => setTestOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Send a test</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>Sends this text to one customer account&apos;s phones, whatever their settings. Use your own account to see it on your phone.</DialogContentText>
          <TextField autoFocus fullWidth size="small" label="Customer email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} type="email" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={busy || !testEmail.includes('@')} onClick={sendTest} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Send test
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Save this text</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" label="Name (only you see it)" value={saveName} onChange={(e) => setSaveName(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={busy || !saveName.trim()} onClick={saveNew} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
