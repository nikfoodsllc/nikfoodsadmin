'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import { formatDayShort, type DayRange, type ItemOrderLine } from '@/utils/kitchenDashboard';

interface ItemOrdersDialogProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
  range: DayRange | null;
  /** The item (or combo) to trace. */
  item: string | null;
  /** Only this menu day; null = the whole date range. */
  day: string | null;
  /** Text for the whole range, shown when no single day is chosen (e.g. 'Oct 3 – Oct 9, 2026'). */
  rangeLabel: string;
}

interface Totals {
  orders: number;
  units: number;
  truncated: boolean;
}

/** Who ordered an item: the orders behind the kitchen number you tapped, so it can be traced back to people. */
export default function ItemOrdersDialog({ open, onClose, token, range, item, day, rangeLabel }: ItemOrdersDialogProps) {
  const fullScreen = useMediaQuery('(max-width:600px)');
  const [lines, setLines] = useState<ItemOrderLine[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item || !range || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setLines([]);
      setTotals(null);
      try {
        const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate, item });
        if (day) params.set('day', day);
        const response = await fetch(`/api/admin/kitchen-dashboard/item-orders?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || 'Could not load the orders');
        if (cancelled) return;
        setLines(body.data?.lines ?? []);
        setTotals(body.data?.totals ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item, day, range, token]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#111827', wordBreak: 'break-word' }}>Who ordered {item}</Typography>
        <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.25 }}>
          {day ? `Menu day: ${formatDayShort(day)}` : `All days: ${rangeLabel}`}
          {totals && !loading
            ? ` · ${totals.orders} ${totals.orders === 1 ? 'order' : 'orders'} · ${totals.units} ${totals.units === 1 ? 'unit' : 'units'}`
            : ''}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 1.5, sm: 2 } }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && lines.length === 0 && (
          <Typography sx={{ color: '#6B7280', py: 2 }}>No orders found for this item.</Typography>
        )}
        {totals?.truncated && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Showing the first {lines.length} orders only.
          </Alert>
        )}
        {lines.map((line, index) => {
          const redelivered = line.deliveredOn && line.deliveredOn !== line.day;
          // the menu day (when tracing the whole range) and the delivery day (when it differs from the menu day)
          const when = [
            day ? null : formatDayShort(line.day),
            redelivered ? `delivered ${formatDayShort(line.deliveredOn as string)}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Box
              key={`${line.orderId}-${index}`}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1.5,
                py: 1.25,
                borderBottom: index === lines.length - 1 ? 'none' : '1px solid #F3F4F6',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#111827', wordBreak: 'break-word' }}>
                  {line.customerName}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#6B7280', userSelect: 'all', wordBreak: 'break-all' }}>{line.orderId}</Typography>
                {when && <Typography sx={{ fontSize: 12.5, color: '#6B7280', mt: 0.25 }}>{when}</Typography>}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {line.portion && <Chip size="small" label={line.portion} sx={{ height: 22, fontSize: 12, bgcolor: '#F3F4F6' }} />}
                  {line.spice && (
                    <Chip size="small" label={line.spice} sx={{ height: 22, fontSize: 12, bgcolor: '#FEE2E2', color: '#991B1B' }} />
                  )}
                  {line.isEco && (
                    <Chip size="small" label="♻️ Eco" sx={{ height: 22, fontSize: 12, bgcolor: '#DCFCE7', color: '#166534' }} />
                  )}
                  {line.viaCombo && (
                    <Chip
                      size="small"
                      label={`in ${line.viaCombo}`}
                      sx={{ height: 22, fontSize: 12, bgcolor: '#FEF3C7', color: '#92400E' }}
                    />
                  )}
                  {line.orderStatus && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={line.orderStatus.replace(/_/g, ' ')}
                      sx={{ height: 22, fontSize: 12, textTransform: 'capitalize' }}
                    />
                  )}
                </Box>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#111827', flexShrink: 0, lineHeight: 1.2 }}>
                × {line.quantity}
              </Typography>
            </Box>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
