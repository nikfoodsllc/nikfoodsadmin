'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useSearchBox } from '@/hooks/useSearchBox';
import { useReloadWhenStale } from '@/hooks/useReloadWhenStale';
import { updatedAtText } from '@/utils/dataFreshness';
import { formatDayShort, isDayString } from '@/utils/kitchenDashboard';
import type { PackerItem, PackerOrder } from '@/utils/packerOrders';

const PAGE_SIZE = 25;

/** The Orders screen of a packer: confirmed orders to pack, with no money and no tracking. Read only. */
export default function PackerOrdersPage() {
  const { token } = useAuth();
  const startRequest = useLatestRequest();
  const [orders, setOrders] = useState<PackerOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const search = useSearchBox(() => setPage(1));

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!token) return;
      const request = startRequest();
      if (!options.silent) setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (search.query.trim()) params.set('search', search.query.trim());
        if (isDayString(date)) params.set('date', date);
        const response = await fetch(`/api/admin/packer-orders?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
        const json = await response.json().catch(() => ({}));
        if (!request.isCurrent()) return;
        if (!response.ok) throw new Error(json.error || 'Could not load the orders');
        setOrders(json.data.items as PackerOrder[]);
        setTotal(Number(json.data.total) || 0);
        setLoadedAt(new Date());
      } catch (e) {
        if (!request.isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return;
        if (!options.silent) setOrders([]);
        setError(e instanceof Error ? e.message : 'Could not load the orders');
      } finally {
        if (request.isCurrent() && !options.silent) setLoading(false);
      }
    },
    [token, page, search.query, date, startRequest]
  );

  useEffect(() => {
    void load();
  }, [load]);
  // a page left open while orders came in: load again, quietly, when the packer comes back to it
  useReloadWhenStale(loadedAt, () => void load({ silent: true }), loadedAt !== null);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Orders</Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Confirmed orders{loadedAt ? ` · ${updatedAtText(loadedAt)}` : ''}
          </Typography>
        </Box>
        <Tooltip title="Reload">
          <span>
            <IconButton onClick={() => void load()} disabled={loading} aria-label="Reload the orders">
              <IconRefresh size={20} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search order ID or name"
          value={search.input}
          onChange={(e) => search.setInput(e.target.value)}
          inputProps={{ 'aria-label': 'Search orders' }}
          sx={{ flex: '1 1 220px', backgroundColor: '#fff' }}
        />
        <TextField
          size="small"
          type="date"
          label="Delivery date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: '0 1 170px', backgroundColor: '#fff' }}
        />
        {date && (
          <Button size="small" onClick={() => { setDate(''); setPage(1); }} sx={{ textTransform: 'none' }}>
            Any day
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : orders.length === 0 && !error ? (
        <Box sx={{ textAlign: 'center', py: 6, color: '#666' }}>No confirmed orders found.</Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {orders.map((order) => (
            <OrderCard key={order.orderId} order={order} />
          ))}
        </Box>
      )}

      {total > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="body2" sx={{ color: '#666' }}>{from}–{to} of {total}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1} aria-label="Previous page"><IconChevronLeft size={20} /></IconButton>
            <Typography variant="body2">{page} / {pages}</Typography>
            <IconButton onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={loading || page >= pages} aria-label="Next page"><IconChevronRight size={20} /></IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function OrderCard({ order }: { order: PackerOrder }) {
  const address = [order.street, order.apartment && `Apt ${order.apartment}`].filter(Boolean).join(', ');
  return (
    <Box sx={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 2, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{order.customerName || 'No name'}</Typography>
        <Typography variant="body2" sx={{ color: '#666', wordBreak: 'break-all' }}>{order.orderId}</Typography>
      </Box>
      <Box sx={{ mt: 0.5, color: '#374151', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {address && <span>{address}</span>}
        {order.phone && <span>{order.phone}</span>}
        {order.gateCode && <span>Gate code: <b>{order.gateCode}</b></span>}
        {order.instruction && <span>Instruction: <b>{order.instruction}</b></span>}
      </Box>
      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {order.days.map((day, i) => (
          <Box key={`${day.menuDate}-${day.deliveryDate}-${i}`}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {day.menuDate ? `${formatDayShort(day.menuDate)}` : 'Day'}
              {day.deliveryDate && day.deliveryDate !== day.menuDate ? ` · delivered ${formatDayShort(day.deliveryDate)}` : day.deliveryDate ? ' · delivered the same day' : ''}
            </Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {day.items.map((item, j) => (
                <ItemLine key={j} item={item} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ItemLine({ item }: { item: PackerItem }) {
  const tags = [item.portion, item.spice, item.eco ? 'Eco' : ''].filter(Boolean);
  return (
    <Box component="li" sx={{ display: 'flex', gap: 1, alignItems: 'baseline', fontSize: 15 }}>
      <Box component="span" sx={{ minWidth: 28, fontWeight: 700 }}>{item.quantity}×</Box>
      <Box sx={{ flex: 1 }}>
        <span>{item.name}</span>
        {tags.length > 0 && <span style={{ color: '#6b7280', fontSize: 13 }}> · {tags.join(' · ')}</span>}
        {item.choices.map((line) => (
          <Box key={line} sx={{ color: '#6b7280', fontSize: 13 }}>{line}</Box>
        ))}
        {item.notes && <Box sx={{ color: '#92400E', fontSize: 13 }}>Note: {item.notes}</Box>}
      </Box>
    </Box>
  );
}
