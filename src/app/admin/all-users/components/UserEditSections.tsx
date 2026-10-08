'use client';

import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import AddressLookup from '../../create-order/components/AddressLookup';
import { normalizeUsPhone, validateAddressInput } from '@/utils/userAdmin';
import { UserWithAddresses } from '@/types/user';

type Address = NonNullable<UserWithAddresses['addresses']>[number];

const idOf = (value: unknown) => (value ? String(value) : '');

async function send(token: string, url: string, method: 'PUT' | 'POST', body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.error || 'Could not save. Try again.';
  } catch {
    return 'Could not reach the server. Try again.';
  }
}

/** The customer's own details: name, login email and phone. */
export function ProfileEditor({ user, token, onSaved, onCancel }: { user: UserWithAddresses; token: string; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!email.trim()) return setError('Enter an email address');
    if (phone.trim() && !normalizeUsPhone(phone)) return setError('The phone number must be 10 digits');
    setSaving(true);
    const problem = await send(token, `/api/admin/users/${idOf(user._id)}`, 'PUT', { name: name.trim() || null, email: email.trim().toLowerCase(), phone: phone.trim() || null });
    setSaving(false);
    if (problem) return setError(problem);
    onSaved();
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth />
      <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} size="small" fullWidth inputProps={{ inputMode: 'tel' }} helperText="10 digits" />
      <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} size="small" fullWidth helperText="This is also the email the customer logs in with and gets order emails at." />
      </Box>
      {error && <Alert severity="error" sx={{ gridColumn: { sm: '1 / -1' } }}>{error}</Alert>}
      <Box sx={{ gridColumn: { sm: '1 / -1' }, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', backgroundColor: '#4F8CFF' }}>{saving ? 'Saving…' : 'Save'}</Button>
      </Box>
    </Box>
  );
}

/** One address of a customer: change it, or (with no `address`) add a new one. */
export function AddressEditor({ user, address, token, onSaved, onCancel }: { user: UserWithAddresses; address?: Address; token: string; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: address?.name ?? user.name ?? '',
    email: address?.email ?? user.email ?? '',
    phone: address?.phone ?? user.phone ?? '',
    street_address: address?.street_address ?? '',
    apartment: address?.apartment ?? '',
    city: address?.city ?? '',
    postal_code: address?.postal_code ?? '',
    entrance: address?.entrance ?? '',
    floor: address?.floor ?? '',
    isDefault: Boolean((address as { isDefault?: boolean } | undefined)?.isDefault),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((cur) => ({ ...cur, [key]: e.target.value }));
  const wasDefault = Boolean((address as { isDefault?: boolean } | undefined)?.isDefault);

  const save = async () => {
    setError('');
    const checked = validateAddressInput(f);
    if (!checked.ok) return setError(checked.error);
    setSaving(true);
    const base = `/api/admin/users/${idOf(user._id)}/addresses`;
    const problem = address ? await send(token, `${base}/${idOf(address._id)}`, 'PUT', f) : await send(token, base, 'POST', f);
    setSaving(false);
    if (problem) return setError(problem);
    onSaved();
  };

  const text = (label: string, key: keyof typeof f, extra: Record<string, unknown> = {}) => (
    <TextField label={label} value={String(f[key])} onChange={set(key)} size="small" fullWidth {...extra} />
  );

  return (
    <Box sx={{ border: '1px solid #BFD4FF', borderRadius: 2, p: { xs: 1.5, sm: 2 }, backgroundColor: '#F5F9FF' }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>{address ? 'Edit address' : 'Add an address'}</Typography>
      <AddressLookup token={token} onPick={(found) => setF((cur) => ({ ...cur, street_address: found.street || cur.street_address, city: found.city || cur.city, postal_code: found.pincode || cur.postal_code }))} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <Box sx={{ gridColumn: { sm: '1 / -1' } }}>{text('Street address', 'street_address')}</Box>
        {text('Apartment / unit (optional)', 'apartment', { inputProps: { maxLength: 10 } })}
        {text('City', 'city')}
        {text('Zip code', 'postal_code', { inputProps: { inputMode: 'numeric', maxLength: 10 } })}
        {text('Gate / entrance code (optional)', 'entrance', { inputProps: { maxLength: 30 } })}
        <Box sx={{ gridColumn: { sm: '1 / -1' } }}>{text('Delivery instructions (optional)', 'floor', { inputProps: { maxLength: 100 } })}</Box>
        {text('Contact name', 'name')}
        {text('Contact phone (10 digits, optional)', 'phone', { inputProps: { inputMode: 'tel' } })}
        <Box sx={{ gridColumn: { sm: '1 / -1' } }}>{text('Contact email', 'email', { type: 'email' })}</Box>
        <FormControlLabel
          sx={{ gridColumn: { sm: '1 / -1' } }}
          control={<Checkbox size="small" checked={f.isDefault} disabled={wasDefault} onChange={(e) => setF((cur) => ({ ...cur, isDefault: e.target.checked }))} />}
          label={<Typography sx={{ fontSize: 14 }}>{wasDefault ? 'This is the default address (make another one the default to change it)' : 'Make this the default address'}</Typography>}
        />
        {error && <Alert severity="error" sx={{ gridColumn: { sm: '1 / -1' } }}>{error}</Alert>}
        <Box sx={{ gridColumn: { sm: '1 / -1' }, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', backgroundColor: '#4F8CFF' }}>{saving ? 'Saving…' : address ? 'Save address' : 'Add address'}</Button>
        </Box>
      </Box>
    </Box>
  );
}
