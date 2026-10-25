'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, TextField, Typography } from '@mui/material';
import { IconDeviceMobileUp } from '@tabler/icons-react';

type Call = (path: string, method?: string, payload?: unknown) => Promise<{ ok: boolean; status: number; json: Record<string, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface UpdateInfo {
  latestVersion: string;
  phones: number;
  customers: number;
  allPhones: number;
  title: string;
  body: string;
}

/**
 * "App update": the admin says which app version is the newest on the App Store. Phones on an older version get
 * (1) an "Update available" bar inside the app (versions that have it), and (2) this notification when the admin presses Send.
 * Tapping the notification opens the App Store (versions that have it). Older versions just open the app.
 */
export default function AppUpdateCard({ call, mode, onSent }: { call: Call; mode?: string; onSent?: () => void }) {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<false | 'first' | 'again'>(false);
  const [againText, setAgainText] = useState('');

  const load = useCallback(async () => {
    const r = await call('app-update');
    if (r.ok) {
      const d = r.json.data as UpdateInfo;
      setInfo(d);
      setVersion((v) => v || d.latestVersion);
      setTitle((t) => t || d.title);
      setBody((b) => b || d.body);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const saved = info?.latestVersion ?? '';
  const versionChanged = version.trim() !== saved;

  const save = async () => {
    setBusy(true);
    const r = await call('app-update', 'PUT', { latestVersion: version });
    setBusy(false);
    if (r.ok) {
      setMessage({ severity: 'success', text: version.trim() ? `Saved. Phones on an older version than ${version.trim()} now see "Update available".` : 'Cleared. The app no longer shows "Update available".' });
      void load();
    } else setMessage({ severity: 'error', text: r.json.error || 'Could not save' });
  };

  const send = async (again: boolean) => {
    setBusy(true);
    const r = await call('app-update', 'POST', { title, body, ...(again ? { confirmAgain: true } : {}) });
    setBusy(false);
    setConfirm(false);
    if (r.ok) {
      const d = r.json.data as { mode: string; phones: number; sent: number; failed: number };
      setMessage({ severity: 'success', text: d.mode === 'dry' ? `Test run: it would go to ${d.phones} phone${d.phones === 1 ? '' : 's'}. Nothing was sent.` : `Sent to ${d.sent} phone${d.sent === 1 ? '' : 's'}${d.failed ? ` (${d.failed} failed)` : ''}.` });
      void load();
      onSent?.();
    } else if (r.json.code === 'recent') {
      setAgainText(r.json.error);
      setConfirm('again');
    } else setMessage({ severity: 'error', text: r.json.error || 'Could not send' });
  };

  const older = info?.phones ?? 0;
  const textOk = title.trim().length > 0 && body.trim().length > 0 && title.length <= 40 && body.length <= 150;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 2.5, borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconDeviceMobileUp size={20} /> App update
      </Typography>
      <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 1.5 }}>
        Type the newest app version that is on the App Store. Phones on an older version get an &quot;Update available&quot; bar in the app, and you can also send them a notification that opens the App Store. Customers on very old versions (before this feature) only see the notification, and tapping it opens the app.
      </Typography>

      {message && <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 1.5 }}>{message.text}</Alert>}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', mb: 1 }}>
        <TextField label="Newest version on the App Store" placeholder="1.0.3" value={version} onChange={(e) => setVersion(e.target.value)} size="small" sx={{ width: { xs: '100%', sm: 260 } }} helperText="For example 1.0.3. Leave empty to turn it off." />
        <Button variant="outlined" color="warning" disabled={busy || !versionChanged} onClick={save} sx={{ textTransform: 'none', fontWeight: 700, height: 40 }}>
          Save
        </Button>
        {busy && <CircularProgress size={20} sx={{ mt: 1 }} />}
      </Box>

      {saved ? (
        <Typography sx={{ fontSize: 14, mb: 1.5 }}>
          <b>{older}</b> phone{older === 1 ? '' : 's'} ({info?.customers ?? 0} customer{info?.customers === 1 ? '' : 's'}) {older === 1 ? 'is' : 'are'} on a version older than {saved}, of {info?.allPhones ?? 0} customer{info?.allPhones === 1 ? '' : 's'} with the app.
        </Typography>
      ) : (
        <Typography sx={{ fontSize: 14, color: '#6B7280', mb: 1.5 }}>No version saved yet.</Typography>
      )}

      <TextField fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={{ mb: 1.5 }} error={title.length > 40} helperText={`${title.length}/40`} />
      <TextField fullWidth multiline minRows={2} label="Message" value={body} onChange={(e) => setBody(e.target.value)} size="small" error={body.length > 150} helperText={`${body.length}/150`} />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
        <Button variant="contained" color="warning" disabled={!textOk || busy || older === 0 || !saved || versionChanged || mode === 'off'} onClick={() => setConfirm('first')} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Send to {older} phone{older === 1 ? '' : 's'} on an older version
        </Button>
      </Box>
      {versionChanged && saved !== '' && <Typography sx={{ color: '#92400E', fontSize: 13, mt: 1 }}>Save the new version first, then send.</Typography>}
      {saved && older === 0 && <Typography sx={{ color: '#6B7280', fontSize: 13, mt: 1 }}>Every phone with the app is already on {saved} or newer.</Typography>}

      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(false)}>
        <DialogTitle>{confirm === 'again' ? 'Send again?' : 'Send this notification?'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm === 'again' ? againText : `It goes to ${older} phone${older === 1 ? '' : 's'} on a version older than ${saved}. "${title}": ${body}`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={() => void send(confirm === 'again')} color="warning" variant="contained" disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {confirm === 'again' ? 'Send anyway' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
