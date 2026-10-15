'use client';

import { Chip, Tooltip } from '@mui/material';
import { OrderStatus } from '@/types/order';
import type { DisplayPaymentStatus } from '@/utils/refunds';
import { partialDeliveryTitle, type DayDeliveryRecord } from '@/utils/deliveryProgress';

interface StatusBadgeProps {
  status: OrderStatus | DisplayPaymentStatus;
  type: 'order' | 'payment';
  /** For a Partially Delivered order: how each delivery day went (shown when you hover over, tap or focus the status) */
  deliveries?: DayDeliveryRecord[] | null;
}

const orderStatusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', bgColor: '#DBEAFE' },
  preparing: { label: 'Preparing', color: '#8B5CF6', bgColor: '#EDE9FE' },
  ready: { label: 'Ready', color: '#10B981', bgColor: '#D1FAE5' },
  out_for_delivery: { label: 'Out for Delivery', color: '#10B981', bgColor: '#D1FAE5' },
  partially_delivered: { label: 'Partially Delivered', color: '#0F766E', bgColor: '#CCFBF1' },
  delivered: { label: 'Delivered', color: '#047857', bgColor: '#A7F3D0' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEE2E2' },
};

const paymentStatusConfig: Record<DisplayPaymentStatus, { label: string; color: string; bgColor: string }> = {
  paid: { label: 'Paid', color: '#10B981', bgColor: '#D1FAE5' },
  unpaid: { label: 'Unpaid', color: '#F59E0B', bgColor: '#FEF3C7' },
  failed: { label: 'Failed', color: '#EF4444', bgColor: '#FEE2E2' },
  refunded: { label: 'Refunded', color: '#8B5CF6', bgColor: '#EDE9FE' },
  partially_refunded: { label: 'Partially refunded', color: '#0369A1', bgColor: '#E0F2FE' },
};

export default function StatusBadge({ status, type, deliveries }: StatusBadgeProps) {
  const config = type === 'order'
    ? orderStatusConfig[status as OrderStatus]
    : paymentStatusConfig[status as DisplayPaymentStatus];

  if (!config) return null;

  const chip = (
    <Chip
      label={config.label}
      sx={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: '12px',
        height: 28,
        borderRadius: 2,
        '& .MuiChip-label': {
          paddingX: 1.5,
        },
      }}
    />
  );

  // Partially Delivered: say which days are delivered and which are still to come (hover, tap or keyboard focus)
  if (type === 'order' && status === 'partially_delivered') {
    const title = partialDeliveryTitle(deliveries);
    return (
      <Tooltip title={title} arrow enterTouchDelay={0} leaveTouchDelay={6000} slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.6 } } }}>
        <span tabIndex={0} role="note" aria-label={`Partially Delivered. ${title.replace(/\n/g, '. ')}`} style={{ display: 'inline-flex' }}>
          {chip}
        </span>
      </Tooltip>
    );
  }

  return chip;
}
