'use client';

import { TableRow as MuiTableRow, TableCell, Typography, Box, Button, Checkbox } from '@mui/material';
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
  selected: boolean;
  onToggleSelect: (orderId: string) => void;
  disableSelection?: boolean;
}

export default function OrderTableRow({
  order,
  index,
  onViewDetails,
  maxDeliveryDays,
  selected,
  onToggleSelect,
  disableSelection = false,
}: OrderTableRowProps) {
  const processedDates = processDeliveryDates(order.items || []);
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

    return (
      <Box>
        <Typography sx={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>
          {dateEntry.date}
        </Typography>
        {dateEntry.clubbedOriginalDates.length > 0 && (
          <Typography sx={{ fontSize: '11px', color: '#9CA3AF' }}>
            (Original: {dateEntry.clubbedOriginalDates.join('; ')})
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <MuiTableRow
      sx={{
        backgroundColor: selected ? '#E6F0FF' : index % 2 === 0 ? '#F6FAFF' : '#fff',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: selected ? '#D6E6FF' : '#F0F6FF',
        },
      }}
      onClick={() => onViewDetails(order)}
    >
      {/* Select */}
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Checkbox
          checked={selected}
          disabled={disableSelection}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            if (order._id) {
              onToggleSelect(order._id);
            }
          }}
          sx={{
            color: '#9CA3AF',
            '&.Mui-checked': {
              color: '#4F8CFF',
            },
          }}
        />
      </TableCell>

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
        <TableCell>{order.address?.floor || '-'}</TableCell>
          {/* {instructionToDriver} */}
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
