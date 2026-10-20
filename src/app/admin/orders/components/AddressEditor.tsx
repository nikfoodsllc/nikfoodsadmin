'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { IconPencil } from '@tabler/icons-react';
import AddressLookup from '@/app/admin/create-order/components/AddressLookup';
import { Order } from '@/types/order';
import { MAX_INSTRUCTION_LENGTH, addressFormChanged, addressFormProblem, canEditAddress, routeNote, type AddressForm } from '@/utils/orderAddress';

const formOf = (order: Order): AddressForm => ({
  street: order.address.street ?? '',
  apartment: order.address.apartment ?? '',
  city: order.address.city ?? '',
  zipCode: order.address.zipCode ?? '',
  entrance: order.address.entrance ?? '',
  floor: order.address.floor ?? '',
});

/** Edit button and dialog for an order's delivery address. The customer site saves it and updates OptimoRoute at once. */
export default function AddressEditor({ order, token, onChanged }: { order: Order; token: string | null; onChanged: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddressForm>(formOf(order));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ text: string; warn: boolean } | null>(null);

  if (!token || !canEditAddress(order.status)) return null;

  const set = (key: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((cur) => ({ ...cur, [key]: e.target.value }));
  const problem = addressFormProblem(form);
  const unchanged = !addressFormChanged(formOf(order), form);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) throw new Error(json.error || 'Something went wrong. Please try again.');
      setDone(routeNote(json.data?.optimo));
      await onChanged();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="small" startIcon={<IconPencil size={16} />} onClick={() => { setForm(formOf(order)); setError(''); setDone(null); setOpen(true); }} sx={{ textTransform: 'none', fontWeight: 600 }}>
        Change address
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Change delivery address</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
            Order {order.orderId}. The stops for this order in OptimoRoute are updated as soon as you save. The customer is not emailed.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'grid', gap: 2 }}>
            <AddressLookup token={token} onPick={(found) => setForm((cur) => ({ ...cur, street: found.street || cur.street, city: found.city || cur.city, zipCode: found.pincode || cur.zipCode }))} />
            <TextField size="small" label="Street address" value={form.street} onChange={set('street')} required fullWidth />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField size="small" label="Apartment" value={form.apartment} onChange={set('apartment')} />
              <TextField size="small" label="Gate code" value={form.entrance} onChange={set('entrance')} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
              <TextField size="small" label="City" value={form.city} onChange={set('city')} required />
              <TextField size="small" label="Zip code" value={form.zipCode} onChange={set('zipCode')} required slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 5 } }} />
            </Box>
            <TextField
              size="small"
              label="Delivery instructions"
              value={form.floor}
              onChange={set('floor')}
              slotProps={{ htmlInput: { maxLength: MAX_INSTRUCTION_LENGTH } }}
              helperText={`${form.floor.length}/${MAX_INSTRUCTION_LENGTH}`}
            />
          </Box>
          {problem && !unchanged && <Typography variant="caption" sx={{ color: '#B91C1C', display: 'block', mt: 1 }}>{problem}</Typography>}
          {done && <Alert severity={done.warn ? 'warning' : 'success'} sx={{ mt: 2 }}>{done.text}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={busy || unchanged || Boolean(problem)} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Save address
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
