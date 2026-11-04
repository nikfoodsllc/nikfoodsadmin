'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { MAX_HEATING_INSTRUCTION_LENGTH } from '@/utils/heatingInstructions';

/** Anything showing the list (the item dialogs, the filter, the table) reloads when this event fires. */
export const HEATING_LIST_CHANGED = 'heating-instructions-changed';

interface Row {
  text: string;
  count: number;
}

/**
 * The list of heating / storage instructions: rename one (every item using it changes with it) or delete one (items using it
 * lose it). Same list for every admin. Admin only.
 */
export default function ManageHeatingInstructionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch('/api/admin/heating-instructions?counts=1', { headers: { Authorization: `Bearer ${token}` } });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Could not load the list');
      setRows(json.data as Row[]);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the list');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      setEditing(null);
      setDeleting(null);
      void load();
    }
  }, [open, load]);

  const call = async (method: 'PATCH' | 'DELETE', body: Record<string, string>) => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/heating-instructions', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'That did not work');
      setEditing(null);
      setDeleting(null);
      window.dispatchEvent(new Event(HEATING_LIST_CHANGED));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Heating/Storage Instructions list</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: '#6B7280', mb: 1.5 }}>
          Rename an instruction to change it on every item that uses it. Delete one to take it off those items.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        {loading && rows.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Typography sx={{ color: '#6B7280' }}>The list is empty. A new instruction typed on a food item is added here.</Typography>
        ) : (
          rows.map((row) => (
            <Box key={row.text} sx={{ py: 1, borderBottom: '1px solid #F3F4F6' }}>
              {editing === row.text ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, MAX_HEATING_INSTRUCTION_LENGTH))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.trim()) void call('PATCH', { from: row.text, to: draft });
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    inputProps={{ 'aria-label': 'New text for this instruction' }}
                    disabled={busy}
                  />
                  <Tooltip title="Save">
                    <span>
                      <IconButton aria-label="Save" size="small" disabled={busy || !draft.trim()} onClick={() => call('PATCH', { from: row.text, to: draft })}>
                        <IconCheck size={20} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <span>
                      <IconButton aria-label="Cancel" size="small" disabled={busy} onClick={() => setEditing(null)}>
                        <IconX size={20} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ) : deleting === row.text ? (
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{row.text}</Typography>
                  <Typography sx={{ fontSize: 13, color: '#B91C1C', my: 0.5 }}>
                    {row.count > 0 ? `Delete it? ${row.count} ${row.count === 1 ? 'item' : 'items'} will have no instruction.` : 'Delete it?'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="contained" color="error" disabled={busy} onClick={() => call('DELETE', { text: row.text })} sx={{ textTransform: 'none' }}>
                      Delete
                    </Button>
                    <Button size="small" variant="outlined" disabled={busy} onClick={() => setDeleting(null)} sx={{ textTransform: 'none' }}>
                      Keep
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, wordBreak: 'break-word' }}>{row.text}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{row.count === 0 ? 'Not used yet' : `${row.count} ${row.count === 1 ? 'item' : 'items'}`}</Typography>
                  </Box>
                  <Tooltip title="Rename">
                    <IconButton
                      aria-label={`Rename ${row.text}`}
                      size="small"
                      onClick={() => {
                        setDeleting(null);
                        setEditing(row.text);
                        setDraft(row.text);
                      }}
                    >
                      <IconPencil size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      aria-label={`Delete ${row.text}`}
                      size="small"
                      onClick={() => {
                        setEditing(null);
                        setDeleting(row.text);
                      }}
                    >
                      <IconTrash size={20} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
