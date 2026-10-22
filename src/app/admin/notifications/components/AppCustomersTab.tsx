'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { APP_FILTERS, filterAppCustomers, menuStatus, PERMISSION_LABEL, phoneText, seenText, type AppCounts, type AppCustomer, type AppFilter } from '@/utils/appCustomers';

type Call = (path: string) => Promise<{ ok: boolean; status: number; json: { data?: unknown; error?: string } }>;

interface Loaded {
  customers: AppCustomer[];
  counts: AppCounts;
}

function Tile({ value, label, hint }: { value: number; label: string; hint?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{hint}</Typography>}
    </Paper>
  );
}

function Switch({ label, on, text }: { label: string; on: boolean; text?: string }) {
  return (
    <Chip
      size="small"
      label={`${label}: ${text ?? (on ? 'On' : 'Off')}`}
      sx={{ fontWeight: 600, bgcolor: on ? '#DCFCE7' : '#F3F4F6', color: on ? '#166534' : '#6B7280', maxWidth: '100%' }}
    />
  );
}

/**
 * Who has the app with notifications allowed, and what each of them switched on inside the app. A phone is only on file after the
 * customer said yes to Apple's question, so everyone listed has allowed notifications on the phone.
 */
export default function AppCustomersTab({ call }: { call: Call }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AppFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call('app-users');
    if (r.ok) {
      setData(r.json.data as Loaded);
      setError('');
    } else setError(r.json.error || 'Could not load the app customers');
    setLoading(false);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => (data ? filterAppCustomers(data.customers, search, filter) : []), [data, search, filter]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const counts = data?.counts;
  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {counts && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.25, mb: 2 }}>
          <Tile value={counts.customers} label="Using the app" hint={`${counts.phones} phone${counts.phones === 1 ? '' : 's'}, signed in`} />
          <Tile value={counts.allowed} label="Notifications allowed" />
          <Tile value={counts.denied} label="Said No" hint="off in iPhone Settings" />
          <Tile value={counts.notAsked} label="Not asked yet" />
          <Tile value={counts.orders} label="Order updates on" hint="of those allowed" />
          <Tile value={counts.menu} label="Menu alerts on" hint="switch on and subscribed" />
          <Tile value={counts.reminders} label="Cart reminders on" />
          <Tile value={counts.allOff} label="Everything off" hint="all three switched off" />
        </Box>
      )}
      <Typography sx={{ color: '#6B7280', fontSize: 13, mb: 1.5 }}>
        Everyone here has signed in on the app. Older app versions do not report a No, so a customer on one of them only shows once they allow notifications; everyone appears after they update the app.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search a name, email, phone number or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><IconSearch size={18} /></InputAdornment> }, htmlInput: { 'aria-label': 'Search app customers' } }}
        />
        <Button onClick={() => void load()} disabled={loading} aria-label="Reload the list" sx={{ minWidth: 0, px: 1.25 }}>
          <IconRefresh size={20} />
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
        {APP_FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} onClick={() => setFilter(f.key)} color={filter === f.key ? 'warning' : 'default'} variant={filter === f.key ? 'filled' : 'outlined'} sx={{ fontWeight: 600 }} />
        ))}
      </Box>
      <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 600, mb: 1 }}>
        {shown.length === (data?.customers.length ?? 0) ? `${shown.length} customer${shown.length === 1 ? '' : 's'}` : `${shown.length} of ${data?.customers.length ?? 0} customers`}
      </Typography>

      {shown.length === 0 && <Typography sx={{ color: '#9CA3AF', fontSize: 14, py: 3, textAlign: 'center' }}>{data?.customers.length ? 'No customer matches.' : 'Nobody has the app with notifications allowed yet.'}</Typography>}
      <Box sx={{ display: 'grid', gap: 1 }}>
        {shown.map((c) => {
          const menu = menuStatus(c);
          return (
            <Paper key={c.userId} variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, wordBreak: 'break-word' }}>{c.name || 'No name'}</Typography>
                  <Typography sx={{ color: '#6B7280', fontSize: 13, wordBreak: 'break-word' }}>
                    {c.email || 'No email'}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </Typography>
                </Box>
                <Typography sx={{ color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap' }}>Last seen {seenText(c.lastSeenAt)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                <Chip size="small" label={PERMISSION_LABEL[c.permission]} sx={{ fontWeight: 700, bgcolor: c.permission === 'allowed' ? '#DCFCE7' : c.permission === 'denied' ? '#FEE2E2' : '#FEF3C7', color: c.permission === 'allowed' ? '#166534' : c.permission === 'denied' ? '#991B1B' : '#92400E' }} />
                {c.permission === 'allowed' && (
                  <>
                    <Switch label="Order updates" on={c.orders} />
                    <Switch label="Menu alerts" on={menu.on} text={menu.label} />
                    <Switch label="Cart reminders" on={c.reminders} />
                  </>
                )}
              </Box>
              <Typography sx={{ color: '#6B7280', fontSize: 12, mt: 1, wordBreak: 'break-word' }}>
                {c.phones.length === 1 ? 'Phone' : `${c.phones.length} phones`}: {c.phones.map(phoneText).join(' · ')}
              </Typography>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
