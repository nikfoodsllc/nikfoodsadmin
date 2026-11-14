'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Snackbar, TextField, Tooltip, Typography } from '@mui/material';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { preparationTypeLabel } from '@/utils/preparationType';

interface RecipeItem {
  id: string;
  name: string;
  preparationType: 'cooked' | 'ready_to_eat' | null;
  usedBy: string[];
}

const API = '/api/admin/recipe-items';

/**
 * Recipe items: hidden extras that go with a menu item (raita with biryani, chutney with kachori). Customers never see them; the Kitchen
 * Dashboard, Kitchen Report and Packing Report count them so the kitchen knows how much to prepare. Attach them to an item in its edit dialog.
 */
export default function RecipeItemsPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<RecipeItem[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<RecipeItem | 'new' | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'' | 'cooked' | 'ready_to_eat'>('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [toDelete, setToDelete] = useState<RecipeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load the recipe items.');
      setItems(json.data as RecipeItem[]);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the recipe items.');
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load();
  }, [authLoading, isAuthenticated, load]);

  const openEditor = (item: RecipeItem | 'new') => {
    setEditing(item);
    setName(item === 'new' ? '' : item.name);
    setType(item === 'new' ? '' : item.preparationType ?? '');
    setDialogError('');
  };

  const save = async () => {
    if (!token || !editing) return;
    setSaving(true);
    setDialogError('');
    try {
      const res = await fetch(API, {
        method: editing === 'new' ? 'POST' : 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editing === 'new' ? {} : { id: editing.id }), name, preparationType: type || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save.');
      setEditing(null);
      setNote(editing === 'new' ? 'Recipe item created.' : 'Recipe item saved.');
      await load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!token || !toDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API}?id=${encodeURIComponent(toDelete.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not delete.');
      setToDelete(null);
      setNote('Recipe item deleted.');
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 0, sm: 1 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Recipe Items</Typography>
          <Typography sx={{ fontSize: 13.5, color: '#6B7280', mt: 0.25 }}>
            Extras that go with a menu item, like raita with biryani. Customers never see them. The kitchen counts include them so you know how much to prepare. Attach one to an item in that item&apos;s edit dialog.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => openEditor('new')} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1F1712', '&:hover': { bgcolor: '#3A2A1E' } }}>
          New recipe item
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!items && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={26} />
        </Box>
      )}
      {items && items.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: 'center', color: '#6B7280' }}>No recipe items yet. Add one, for example Raita or Mint Chutney.</Paper>
      )}
      {items?.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 1.5, mb: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15.5, wordBreak: 'break-word' }}>{item.name}</Typography>
              <Chip size="small" label={preparationTypeLabel(item.preparationType)} sx={{ height: 22, fontSize: 11.5, fontWeight: 700, bgcolor: item.preparationType === 'cooked' ? '#FEF3C7' : item.preparationType === 'ready_to_eat' ? '#DCFCE7' : '#F3F4F6', color: item.preparationType === 'cooked' ? '#92400E' : item.preparationType === 'ready_to_eat' ? '#166534' : '#4B5563' }} />
            </Box>
            <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.25, wordBreak: 'break-word' }}>
              {item.usedBy.length === 0 ? 'Not attached to any item yet.' : `Goes with ${item.usedBy.slice(0, 4).join(', ')}${item.usedBy.length > 4 ? ` and ${item.usedBy.length - 4} more` : ''}`}
            </Typography>
          </Box>
          <Tooltip title="Edit">
            <IconButton aria-label={`Edit ${item.name}`} onClick={() => openEditor(item)}><IconEdit size={19} /></IconButton>
          </Tooltip>
          <Tooltip title={item.usedBy.length > 0 ? 'Take it off its items first' : 'Delete'}>
            <span>
              <IconButton aria-label={`Delete ${item.name}`} onClick={() => { setToDelete(item); setDeleteError(''); }} sx={{ color: '#B91C1C' }}><IconTrash size={19} /></IconButton>
            </span>
          </Tooltip>
        </Paper>
      ))}

      <Dialog open={Boolean(editing)} onClose={saving ? undefined : () => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>{editing === 'new' ? 'New recipe item' : 'Edit recipe item'}</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" sx={{ mt: 1 }} placeholder="For example: Raita" inputProps={{ maxLength: 80 }} />
          <TextField select label="How the kitchen makes it" value={type} onChange={(e) => setType(e.target.value as typeof type)} fullWidth size="small" sx={{ mt: 2 }} helperText="Decides where it shows in the Kitchen Report (Kitchen Prep or Ready to Eat).">
            <MenuItem value="">Prep Type N/A</MenuItem>
            <MenuItem value="cooked">Cooked</MenuItem>
            <MenuItem value="ready_to_eat">Ready to eat</MenuItem>
          </TextField>
          {dialogError && <Alert severity="error" sx={{ mt: 2 }}>{dialogError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving || name.trim().length < 2} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1F1712', '&:hover': { bgcolor: '#3A2A1E' } }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(toDelete)} onClose={deleting ? undefined : () => setToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Delete {toDelete?.name}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>It is removed from the list. Past reports are not changed. It can only be deleted when no item uses it.</Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setToDelete(null)} disabled={deleting} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void remove()} disabled={deleting} sx={{ textTransform: 'none', fontWeight: 700 }}>{deleting ? 'Deleting…' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(note)} autoHideDuration={3000} onClose={() => setNote('')} message={note} />
    </Box>
  );
}
