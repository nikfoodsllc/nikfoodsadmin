'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, Switch, TextField, Typography } from '@mui/material';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchBox } from '@/hooks/useSearchBox';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import StoreCreditSection from '../all-users/components/StoreCreditSection';

interface Account {
  userId: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  updatedAt: string | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const dateText = (v: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
};

/** Order > Store Credit: everyone who holds store credit, with a way to open one customer's full history and change the balance. */
export default function StoreCreditLedgerPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const search = useSearchBox(() => setPage(1));
  const [includeZero, setIncludeZero] = useState(false);
  const [rows, setRows] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [outstanding, setOutstanding] = useState(0);
  const [holders, setHolders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Account | null>(null);
  const [version, setVersion] = useState(0);
  const beginRequest = useLatestRequest();

  const load = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    const req = beginRequest();
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), filter: includeZero ? 'all' : 'with' });
      if (search.query) params.set('search', search.query);
      const response = await fetch(`/api/admin/store-credit?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: req.signal });
      const body = await response.json().catch(() => ({}));
      if (!req.isCurrent()) return;
      if (!response.ok || body.success === false) throw new Error(body?.error || 'Could not load the store credit list.');
      setRows(body.data.accounts ?? []);
      setTotal(body.data.total ?? 0);
      setPageSize(body.data.pageSize ?? 50);
      setOutstanding(body.data.outstanding ?? 0);
      setHolders(body.data.holders ?? 0);
      setError('');
    } catch (e) {
      if (!req.isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return;
      setError(e instanceof Error ? e.message : 'Could not load the store credit list.');
    } finally {
      if (req.isCurrent()) setLoading(false);
    }
  }, [token, isAuthenticated, page, includeZero, search.query, beginRequest]);

  useEffect(() => {
    void load();
  }, [load, version]);

  if (authLoading || !token) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Store Credit</Typography>
      <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 2 }}>
        {money(outstanding)} owed to {holders} customer{holders === 1 ? '' : 's'}. Tap a customer for their history or to change the balance.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search name, email or phone"
          value={search.input}
          onChange={(e) => search.setInput(e.target.value)}
          sx={{ flex: '1 1 260px', maxWidth: 420, bgcolor: '#fff' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} /></InputAdornment> }}
          inputProps={{ 'aria-label': 'Search store credit customers' }}
        />
        <FormControlLabel
          control={<Switch size="small" checked={includeZero} onChange={(e) => { setIncludeZero(e.target.checked); setPage(1); }} />}
          label={<Typography sx={{ fontSize: 13 }}>Include $0 balances</Typography>}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, opacity: loading ? 0.6 : 1 }}>
        {rows.map((a) => (
          <Box
            key={a.userId}
            role="button"
            tabIndex={0}
            onClick={() => setOpen(a)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(a)}
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, p: 1.5, bgcolor: '#fff', border: '1px solid #E5E7EB', borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: '#F9FAFB' } }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{a.name || a.email || 'Customer'}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280', overflowWrap: 'anywhere' }}>
                {[a.name ? a.email : '', a.phone, a.updatedAt ? `Last change ${dateText(a.updatedAt)}` : ''].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
            <Chip label={money(a.balance)} size="small" sx={{ fontWeight: 700, bgcolor: a.balance > 0 ? '#DCFCE7' : '#F3F4F6', color: a.balance > 0 ? '#166534' : '#6B7280' }} />
          </Box>
        ))}
        {!loading && rows.length === 0 && !error && (
          <Typography sx={{ color: '#6B7280', py: 3, textAlign: 'center' }}>{search.query ? 'No customers match.' : 'Nobody has store credit yet.'}</Typography>
        )}
      </Box>

      {pages > 1 && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center', mt: 2 }}>
          <Button size="small" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} sx={{ textTransform: 'none' }}>Previous</Button>
          <Typography sx={{ fontSize: 13 }}>Page {page} of {pages}</Typography>
          <Button size="small" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} sx={{ textTransform: 'none' }}>Next</Button>
        </Box>
      )}

      <Dialog
        open={!!open}
        onClose={() => { setOpen(null); setVersion((v) => v + 1); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{open?.name || open?.email}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280', overflowWrap: 'anywhere' }}>{[open?.name ? open?.email : '', open?.phone].filter(Boolean).join(' · ')}</Typography>
          </Box>
          <IconButton aria-label="Close" size="small" onClick={() => { setOpen(null); setVersion((v) => v + 1); }}><IconX size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>{open && <StoreCreditSection userId={open.userId} token={token} detailed />}</DialogContent>
      </Dialog>
    </Box>
  );
}
