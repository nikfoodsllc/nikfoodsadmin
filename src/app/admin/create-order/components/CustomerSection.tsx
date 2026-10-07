'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, FormControlLabel, Paper, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import type { AddressForm, CustomerForm } from '@/utils/createOrder';

export interface FoundCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: Array<{ id: string; street_address: string; apartment?: string; city: string; postal_code: string; entrance?: string; floor?: string; isDefault: boolean }>;
}

export const EMPTY_ADDRESS: AddressForm = { street_address: '', apartment: '', city: '', postal_code: '', entrance: '', floor: '' };

const addressLine = (a: FoundCustomer['addresses'][number]) =>
  [a.street_address, a.apartment, `${a.city} ${a.postal_code}`.trim()].filter(Boolean).join(', ');

/** Who the order is for and where it goes: search an existing customer, or type the details of a new one. */
export default function CustomerSection({
  token,
  customer,
  address,
  onCustomer,
  onAddress,
  onPickedExisting,
  accountExists,
}: {
  token: string;
  customer: CustomerForm;
  address: AddressForm;
  onCustomer: (c: CustomerForm) => void;
  onAddress: (a: AddressForm) => void;
  onPickedExisting: (found: FoundCustomer | null) => void;
  accountExists: FoundCustomer | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [savedChoice, setSavedChoice] = useState<string>('new');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/create-order/customers?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        setResults(res.ok && body.success ? body.data : []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, token]);

  const choose = (found: FoundCustomer) => {
    onPickedExisting(found);
    onCustomer({ name: found.name, email: found.email, phone: found.phone });
    const first = found.addresses.find((a) => a.isDefault) ?? found.addresses[0];
    if (first) {
      setSavedChoice(first.id);
      onAddress({ street_address: first.street_address, apartment: first.apartment ?? '', city: first.city, postal_code: first.postal_code, entrance: first.entrance ?? '', floor: first.floor ?? '' });
    } else {
      setSavedChoice('new');
    }
    setQuery('');
    setResults([]);
  };

  const clearExisting = () => {
    onPickedExisting(null);
    setSavedChoice('new');
    onAddress(EMPTY_ADDRESS);
  };

  const field = (label: string, value: string, set: (v: string) => void, extra: Record<string, unknown> = {}) => (
    <TextField label={label} value={value} onChange={(e) => set(e.target.value)} size="small" fullWidth {...extra} />
  );

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #E5E7EB', borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1.5 }}>1. Customer</Typography>

      {accountExists ? (
        <Alert severity="info" sx={{ mb: 2 }} action={<Chip label="Change" size="small" onClick={clearExisting} />}>
          Existing customer: {accountExists.name} ({accountExists.email})
        </Alert>
      ) : (
        <>
          <TextField
            label="Find an existing customer (email, name or phone)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="small"
            fullWidth
            InputProps={{ endAdornment: searching ? <CircularProgress size={16} /> : undefined }}
          />
          {results.length > 0 && (
            <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, mt: 0.5, mb: 1 }}>
              {results.map((r) => (
                <Box key={r.id} onClick={() => choose(r)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && choose(r)} sx={{ px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: '#FEF3C7' }, borderBottom: '1px solid #F3F4F6' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.name || r.email}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{r.email} · {r.phone}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <Typography sx={{ fontSize: 12, color: '#6B7280', my: 1 }}>No account yet? Just type the details below: we create the account for them when the order is made.</Typography>
        </>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {field('Name', customer.name, (v) => onCustomer({ ...customer, name: v }), { disabled: Boolean(accountExists) })}
        {field('Phone', customer.phone, (v) => onCustomer({ ...customer, phone: v }), { type: 'tel', inputProps: { inputMode: 'tel' } })}
        <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
          {field('Email', customer.email, (v) => onCustomer({ ...customer, email: v }), { type: 'email', disabled: Boolean(accountExists), inputProps: { inputMode: 'email' } })}
        </Box>
      </Box>

      <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 2, mb: 0.5 }}>Delivery address</Typography>
      {accountExists && accountExists.addresses.length > 0 && (
        <RadioGroup
          value={savedChoice}
          onChange={(e) => {
            const id = e.target.value;
            setSavedChoice(id);
            const a = accountExists.addresses.find((x) => x.id === id);
            onAddress(a ? { street_address: a.street_address, apartment: a.apartment ?? '', city: a.city, postal_code: a.postal_code, entrance: a.entrance ?? '', floor: a.floor ?? '' } : EMPTY_ADDRESS);
          }}
          sx={{ mb: 1 }}
        >
          {accountExists.addresses.map((a) => (
            <FormControlLabel key={a.id} value={a.id} control={<Radio size="small" />} label={<Typography sx={{ fontSize: 14 }}>{addressLine(a)}</Typography>} />
          ))}
          <FormControlLabel value="new" control={<Radio size="small" />} label={<Typography sx={{ fontSize: 14 }}>A different address</Typography>} />
        </RadioGroup>
      )}
      {(!accountExists || accountExists.addresses.length === 0 || savedChoice === 'new') && (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Box sx={{ gridColumn: { sm: '1 / -1' } }}>{field('Street address', address.street_address, (v) => onAddress({ ...address, street_address: v }))}</Box>
          {field('Apartment / unit (optional)', address.apartment, (v) => onAddress({ ...address, apartment: v.slice(0, 10) }))}
          {field('City', address.city, (v) => onAddress({ ...address, city: v }))}
          {field('Zip code', address.postal_code, (v) => onAddress({ ...address, postal_code: v.replace(/[^\d-]/g, '').slice(0, 10) }), { inputProps: { inputMode: 'numeric' } })}
          {field('Gate / entrance code (optional)', address.entrance, (v) => onAddress({ ...address, entrance: v }))}
          <Box sx={{ gridColumn: { sm: '1 / -1' } }}>{field('Delivery instructions (optional)', address.floor, (v) => onAddress({ ...address, floor: v.slice(0, 30) }))}</Box>
        </Box>
      )}
    </Paper>
  );
}
