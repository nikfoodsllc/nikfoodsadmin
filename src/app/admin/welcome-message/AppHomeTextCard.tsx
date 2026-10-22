'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { HOME_INTRO_MAX } from '@/lib/appSettings';

/** The big greeting at the top of the app's home screen. Empty = the usual "<first name>, what shall we cook?". */
export default function AppHomeTextCard({ token }: { token: string | null }) {
  const [saved, setSaved] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/admin/app-settings', { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setSaved(j.data.homeIntro);
      setText(j.data.homeIntro);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (value: string) => {
    setBusy(true);
    setNote(null);
    const r = await fetch('/api/admin/app-settings', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ homeIntro: value }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setSaved(j.data.homeIntro);
      setText(j.data.homeIntro);
      setNote({ kind: 'success', text: j.data.homeIntro ? 'Saved. The app shows it within a minute.' : 'Back to the usual greeting.' });
    } else setNote({ kind: 'error', text: j.error || 'Could not save' });
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, mb: 2 }}>
      <Typography sx={{ fontWeight: 700 }}>Welcome message</Typography>
      <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 1.5 }}>
        The greeting at the top of the app&apos;s home screen. Write {'{name}'} where the customer&apos;s first name should go: the name shows in black, the rest in gold. Leave it empty for the usual &quot;name, what shall we cook?&quot;. The text shrinks to fit its box.
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Greeting"
        placeholder="{name}, what shall we cook?"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, HOME_INTRO_MAX))}
        helperText={`${text.length}/${HOME_INTRO_MAX}`}
      />
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        <Button variant="contained" color="warning" disabled={busy || text.trim() === saved} onClick={() => save(text)} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Save
        </Button>
        <Button variant="text" disabled={busy || !saved} onClick={() => save('')} sx={{ textTransform: 'none' }}>
          Use the usual greeting
        </Button>
      </Box>
      {note && <Alert severity={note.kind} sx={{ mt: 1.5 }}>{note.text}</Alert>}
    </Paper>
  );
}
