'use client';

import { TableRow as MuiTableRow, TableCell, Typography, Box, Button } from '@mui/material';
import { IconEye } from '@tabler/icons-react';
import StatusBadge from './StatusBadge';
import { Order } from '@/types/order';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDate } from '@/utils/timezone';

interface OrderTableRowProps {
  order: Order;
  index: number;
  onViewDetails: (order: Order) => void;
}

export default function OrderTableRow({ order, index, onViewDetails }: OrderTableRowProps) {
  return (
    <MuiTableRow
      sx={{
        backgroundColor: index % 2 === 0 ? '#F6FAFF' : '#fff',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: '#F0F6FF',
        },
      }}
      onClick={() => onViewDetails(order)}
    >
      {/* Order ID */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#4F8CFF',
          }}
        >
          {order.orderId}
        </Typography>
      </TableCell>

      {/* Customer */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#111827',
          }}
        >
          {order.customerInfo.name}
        </Typography>
      </TableCell>

      {/* Email */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {order.customerInfo.email}
        </Typography>
      </TableCell>

      {/* Created At */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {formatPSTDate(order.createdAt)}
        </Typography>
      </TableCell>

      {/* Order Status */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <StatusBadge status={order.status} type="order" />
      </TableCell>

      {/* Payment Status */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Box>
          <StatusBadge status={order.paymentStatus} type="payment" />
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              marginTop: 0.5,
              fontSize: '11px',
              color: '#6B7280',
            }}
          >
            {order.paymentMethod}
          </Typography>
        </Box>
      </TableCell>

      {/* Total */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {safeFormatCurrency(order.totalPaid)}
        </Typography>
      </TableCell>

      {/* Actions */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<IconEye size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(order);
          }}
          sx={{
            textTransform: 'none',
            borderColor: '#E5E7EB',
            color: '#6B7280',
            fontSize: '13px',
            '&:hover': {
              borderColor: '#4F8CFF',
              backgroundColor: '#F6FAFF',
              color: '#4F8CFF',
            },
          }}
        >
          View Details
        </Button>
      </TableCell>
    </MuiTableRow>
  );
}
