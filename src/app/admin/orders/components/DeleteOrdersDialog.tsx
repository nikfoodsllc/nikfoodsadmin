'use client';

import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { Order } from '@/types/order';
import { deleteWarnings } from '@/utils/orderDelete';

/**
 * Asks for confirmation, then deletes the given orders completely (one after the other). Used from the order details
 * and from the bulk bar of the Orders table. Each delete also takes the order off the OptimoRoute plan.
 */
export default function DeleteOrdersDialog({
  open,
  orders,
  token,
  onClose,
  onDone,
}: {
  open: boolean;
  orders: Order[];
  token: string | null;
  onClose: () => void;
  /** The order numbers that were deleted (also called when only some were) */
  onDone: (deleted: string[], failed: Array<{ orderId: string; error: string }>) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const warnings = deleteWarnings(orders);

  const run = async () => {
    if (!token || running || warnings.tooMany) return;
    setRunning(true);
    setProgress(0);
    const deleted: string[] = [];
    const failed: Array<{ orderId: string; error: string }> = [];
    for (const order of orders) {
      try {
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}/delete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) deleted.push(order.orderId);
        else failed.push({ orderId: order.orderId, error: data.error || 'Could not delete' });
      } catch {
        failed.push({ orderId: order.orderId, error: 'Could not reach the server' });
      }
      setProgress((p) => p + 1);
    }
    setRunning(false);
    onDone(deleted, failed);
  };

  const many = orders.length > 1;
  return (
    <Dialog open={open} onClose={running ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{many ? `Delete ${orders.length} orders?` : 'Delete this order?'}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, mb: 1 }}>
          {many ? 'These orders' : 'This order'} will be deleted completely and will disappear from every report. This cannot be undone from the admin. The customer is not told.
        </Typography>
        <Box sx={{ fontSize: 13, color: '#4B5563', mb: 1, wordBreak: 'break-word' }}>
          {orders.slice(0, 8).map((o) => o.orderId).join(', ')}
          {orders.length > 8 ? ` and ${orders.length - 8} more` : ''}
        </Box>
        {warnings.paidByCard > 0 && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {warnings.paidByCard === 1 ? '1 order was' : `${warnings.paidByCard} orders were`} paid by card. Deleting does NOT refund the money: refund {warnings.paidByCard === 1 ? 'it' : 'them'} in Stripe first.
          </Alert>
        )}
        {warnings.delivered > 0 && (
          <Alert severity="warning" sx={{ mb: 1 }}>{warnings.delivered === 1 ? '1 order is' : `${warnings.delivered} orders are`} already delivered.</Alert>
        )}
        {warnings.tooMany && <Alert severity="error">Select 50 orders or fewer at a time.</Alert>}
        {running && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={18} />
            <Typography sx={{ fontSize: 13 }}>Deleting {progress} of {orders.length}…</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={running} sx={{ textTransform: 'none', color: '#6B7280' }}>Cancel</Button>
        <Button variant="contained" color="error" onClick={run} disabled={running || warnings.tooMany || orders.length === 0} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {many ? `Delete ${orders.length} orders` : 'Delete order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
