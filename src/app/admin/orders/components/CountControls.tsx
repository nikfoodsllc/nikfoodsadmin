'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { Order } from '@/types/order';
import { countBlockedReason, countSummary, isCountedEarly, type CountResultRow } from '@/utils/orderCounting';

/**
 * In the order details of an unpaid order: count it in the Kitchen, Packing and Delivery reports before it is paid (the same
 * switch as "Count it now, before it is paid" in Create Order), or stop counting it. Nothing shows for paid, cancelled,
 * failed or refunded orders: a paid order counts by itself and the others never count.
 */
export default function CountControls({ order, token, onChanged }: { order: Order; token: string | null; onChanged: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (countBlockedReason(order) !== null) return null;
  const counted = isCountedEarly(order);

  const run = async (count: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/orders/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ orderIds: [order.orderId], count }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) throw new Error(json.error || 'Something went wrong. Please try again.');
      const results: CountResultRow[] = json.data?.results ?? [];
      const summary = countSummary(results, count);
      if (summary.severity === 'error') throw new Error(summary.text);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ backgroundColor: counted ? '#FFFBEB' : '#F9FAFB', borderRadius: 1, padding: 1.5, border: '1px solid', borderColor: counted ? '#FDE68A' : '#E5E7EB' }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: counted ? '#92400E' : '#111827' }}>
        {counted ? 'Counted before payment' : 'Not counted yet (unpaid)'}
      </Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
        {counted
          ? 'It is in the Kitchen, Packing and Delivery reports and on the route plan. If the payment fails or the order is cancelled it comes out again.'
          : 'Count it in the Kitchen, Packing and Delivery reports now. For a delivery day that has gone by, only the reports change; nothing is sent to OptimoRoute.'}
      </Typography>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      <Button
        size="small"
        variant={counted ? 'outlined' : 'contained'}
        color="warning"
        disabled={busy}
        onClick={() => void run(!counted)}
        sx={{ mt: 1, textTransform: 'none', borderRadius: 2, ...(counted ? { color: '#92400E', borderColor: '#D97706' } : {}) }}
      >
        {busy ? <CircularProgress size={16} color="inherit" /> : counted ? 'Stop counting' : 'Count it now'}
      </Button>
    </Box>
  );
}
