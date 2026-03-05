'use client';

import { TableRow as MuiTableRow, TableCell, Typography, Box, Button } from '@mui/material';
import { IconEye } from '@tabler/icons-react';
import StatusBadge from './StatusBadge';
import { Order } from '@/types/order';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDate } from '@/utils/timezone';
import { processDeliveryDates, ProcessedDeliveryDate } from '@/utils/delivery';

interface OrderTableRowProps {
  order: Order;
  index: number;
  onViewDetails: (order: Order) => void;
  maxDeliveryDays: number;
}

export default function OrderTableRow({ order, index, onViewDetails, maxDeliveryDays }: OrderTableRowProps) {
  // Process delivery dates to sort and merge duplicates
  const processedDates = processDeliveryDates(order.items || []);

  // Get instruction to driver from address landmark
  const instructionToDriver = order.address.landmark || '-';

  // Render a delivery date cell
  const renderDeliveryDateCell = (dateEntry: ProcessedDeliveryDate | null) => {
    if (!dateEntry) {
      return (
        <Typography sx={{ fontSize: '13px', color: '#6B7280' }}>
          -
        </Typography>
      );
    }

    // If multiple days share the same date, show them together
    const dayLabel = dateEntry.originalDays.length > 1
      ? `Days ${dateEntry.originalDays.join(', ')}`
      : `Day ${dateEntry.originalDays[0]}`;

    return (
      <Box>
        <Typography sx={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>
          {dateEntry.date}
        </Typography>
        <Typography sx={{ fontSize: '11px', color: '#9CA3AF' }}>
          {dayLabel}
        </Typography>
      </Box>
    );
  };

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
      {/* Order Date */}
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

      {/* Customer Name */}
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

      {/* Order Status */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <StatusBadge status={order.status} type="order" />
      </TableCell>

      {/* Payment Status */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <StatusBadge status={order.paymentStatus} type="payment" />
      </TableCell>

      {/* Sub Total */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#111827',
          }}
        >
          {safeFormatCurrency(order.subtotal)}
        </Typography>
      </TableCell>

      {/* Service Fee (Platform Fee) */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#111827',
          }}
        >
          {safeFormatCurrency(order.platformFee)}
        </Typography>
      </TableCell>

      {/* Tax */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#111827',
          }}
        >
          {safeFormatCurrency(order.taxes)}
        </Typography>
      </TableCell>

      {/* Tip */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#111827',
          }}
        >
          {safeFormatCurrency(order.tip)}
        </Typography>
      </TableCell>

      {/* Grand Total */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
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

      {/* Phone */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {order.customerInfo.phone}
        </Typography>
      </TableCell>

      {/* Address */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {order.address.street}
        </Typography>
      </TableCell>

      {/* Apt. No. */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {order.address.apartment || order.address.floor || '-'}
        </Typography>
      </TableCell>

      {/* Gate Code */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {order.address.entrance || '-'}
        </Typography>
      </TableCell>

      {/* Instruction to Driver */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            maxWidth: 150,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={instructionToDriver}
        >
          {instructionToDriver}
        </Typography>
      </TableCell>

      {/* Dynamic delivery day cells - now using processed dates */}
      {Array.from({ length: maxDeliveryDays }, (_, i) => (
        <TableCell key={`delivery-day-${i}`} sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
          {renderDeliveryDateCell(processedDates[i] || null)}
        </TableCell>
      ))}

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
