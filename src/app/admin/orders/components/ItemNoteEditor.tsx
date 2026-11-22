'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { IconPencil, IconPlus } from '@tabler/icons-react';
import { ITEM_NOTE_MAX, cleanItemNote } from '@/utils/itemNotes';

/** Which items of an order take special instructions (their food item has the switch on) and whether the order is still open. */
export function useItemNoteRules(orderId: string | undefined, token: string | null, open: boolean) {
  const [rules, setRules] = useState<{ allowed: Set<string>; editable: boolean } | null>(null);
  useEffect(() => {
    setRules(null);
    if (!open || !orderId || !token) return;
    const controller = new AbortController();
    fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/item-notes`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setRules({ allowed: new Set<string>(json.data.allowedFoodIds ?? []), editable: json.data.editable === true });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [orderId, token, open]);
  return rules;
}

interface Props {
  orderId: string;
  token: string | null;
  line: number;
  item: number;
  name: string;
  notes?: string;
  /** the item takes instructions and the order is not delivered or cancelled */
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}

/** The item's special instructions in the order details, with Add / Edit for items that take them. */
export default function ItemNoteEditor({ orderId, token, line, item, name, notes, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!notes && !canEdit) return null;

  const save = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/item-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ line, item, notes: value }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) throw new Error(json.error || 'Something went wrong. Please try again.');
      await onChanged();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const unchanged = cleanItemNote(text) === (notes ?? '');
  const start = () => {
    setText(notes ?? '');
    setError('');
    setOpen(true);
  };

  return (
    <Box sx={{ ml: 1.75, mt: 0.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 0.5 }}>
      {notes && (
        <Typography variant="caption" sx={{ color: '#6B7280', fontStyle: 'italic', overflowWrap: 'anywhere' }}>
          Instructions: {notes}
        </Typography>
      )}
      {canEdit && (
        <Button
          size="small"
          onClick={start}
          startIcon={notes ? <IconPencil size={13} /> : <IconPlus size={13} />}
          aria-label={notes ? `Edit special instructions for ${name}` : `Add special instructions for ${name}`}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12, minWidth: 0, py: 0, px: 0.75, color: '#B8893B', '& .MuiButton-startIcon': { mr: 0.4 } }}
        >
          {notes ? 'Edit' : 'Add instructions'}
        </Button>
      )}
      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Special instructions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 1.5 }}>
            {name}. Shown to the kitchen, on the packing sticker and to the customer.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Instructions"
            placeholder="For example: No onion"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, ITEM_NOTE_MAX))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && !unchanged) void save(text);
            }}
            helperText={`${text.length}/${ITEM_NOTE_MAX}`}
            FormHelperTextProps={{ sx: { textAlign: 'right', mr: 0 } }}
            disabled={busy}
          />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          {notes && (
            <Button color="error" disabled={busy} onClick={() => void save('')} sx={{ textTransform: 'none', mr: 'auto' }}>
              Remove
            </Button>
          )}
          <Button disabled={busy} onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={busy || unchanged} onClick={() => void save(text)} startIcon={busy ? <CircularProgress size={14} /> : null} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
