'use client';

import { Chip } from '@mui/material';
import { OrderStatus } from '@/types/order';
import type { DisplayPaymentStatus } from '@/utils/refunds';

interface StatusBadgeProps {
  status: OrderStatus | DisplayPaymentStatus;
  type: 'order' | 'payment';
}

const orderStatusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', bgColor: '#DBEAFE' },
  preparing: { label: 'Preparing', color: '#8B5CF6', bgColor: '#EDE9FE' },
  ready: { label: 'Ready', color: '#10B981', bgColor: '#D1FAE5' },
  out_for_delivery: { label: 'Out for Delivery', color: '#10B981', bgColor: '#D1FAE5' },
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

export default function StatusBadge({ status, type }: StatusBadgeProps) {
  const config = type === 'order'
    ? orderStatusConfig[status as OrderStatus]
    : paymentStatusConfig[status as DisplayPaymentStatus];

  if (!config) return null;

  return (
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
}
