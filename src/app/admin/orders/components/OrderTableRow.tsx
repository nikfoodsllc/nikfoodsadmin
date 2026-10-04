'use client';

import { Fragment, ReactNode } from 'react';
import { TableRow as MuiTableRow, TableCell, Typography, Button, Checkbox } from '@mui/material';
import { IconEye } from '@tabler/icons-react';
import StatusBadge from './StatusBadge';
import { Order } from '@/types/order';
import { safeFormatCurrency } from '@/utils/currency';
import { getDisplayPaymentStatus, getNetTotal, getRefundedAmount } from '@/utils/refunds';
import { formatPSTDate } from '@/utils/timezone';

interface OrderTableRowProps {
  order: Order;
  index: number;
  onViewDetails: (order: Order) => void;
  /** Columns to show, in order. */
  columns: { key: string }[];
  selected: boolean;
  onToggleSelect: (orderId: string) => void;
  disableSelection?: boolean;
}

export default function OrderTableRow({
  order,
  index,
  onViewDetails,
  columns,
  selected,
  onToggleSelect,
  disableSelection = false,
}: OrderTableRowProps) {
  const refundedAmount = getRefundedAmount(order);
  const instructionToDriver = order.address?.floor || '-';

  const cells: Record<string, ReactNode> = {
    // Select
    select: (
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
    ),
    // Order Date
    orderDate: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {formatPSTDate(order.createdAt)}
        </Typography>
      </TableCell>
    ),
    // Order ID
    orderId: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
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
    ),
    // Customer Name
    customerName: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#111827',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={order.customerInfo.name}
        >
          {order.customerInfo.name}
        </Typography>
      </TableCell>
    ),
    // Order Status
    orderStatus: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <StatusBadge status={order.status} type="order" />
      </TableCell>
    ),
    // Payment Status
    paymentStatus: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <StatusBadge status={getDisplayPaymentStatus(order)} type="payment" />
      </TableCell>
    ),
    // Instruction to Driver
    instruction: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={instructionToDriver}
        >
          {instructionToDriver}
        </Typography>
      </TableCell>
    ),
    // Payment Method (Credit Card, Apple Pay, Google Pay, Link, Bank, ...)
    paymentMethod: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography variant="body2" sx={{ fontSize: '13px', color: order.paymentMethod ? '#111827' : '#9CA3AF', whiteSpace: 'nowrap' }}>
          {order.paymentMethod || '-'}
        </Typography>
      </TableCell>
    ),
    // Sub Total
    subtotal: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
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
    ),
    // Service Fee (Platform Fee)
    serviceFee: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
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
    ),
    // Tax
    tax: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
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
    ),
    // Tip
    tip: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
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
    ),
    // Refunded Amt (negative)
    refunded: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: refundedAmount > 0 ? 600 : 400,
            color: refundedAmount > 0 ? '#B91C1C' : '#9CA3AF',
          }}
        >
          {refundedAmount > 0 ? `-${safeFormatCurrency(refundedAmount)}` : '-'}
        </Typography>
      </TableCell>
    ),
    // Grand Total (after refunds)
    grandTotal: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {safeFormatCurrency(getNetTotal(order))}
        </Typography>
      </TableCell>
    ),
    // Phone
    phone: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {order.customerInfo.phone}
        </Typography>
      </TableCell>
    ),
    // Email
    email: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={order.customerInfo.email}
        >
          {order.customerInfo.email}
        </Typography>
      </TableCell>
    ),
    // Address
    address: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={order.address.street}
        >
          {order.address.street}
        </Typography>
      </TableCell>
    ),
    // Apt. No.
    apartment: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={order.address.apartment || order.address.floor || ''}
        >
          {order.address.apartment || order.address.floor || '-'}
        </Typography>
      </TableCell>
    ),
    // Gate Code
    gateCode: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={order.address.entrance || ''}
        >
          {order.address.entrance || '-'}
        </Typography>
      </TableCell>
    ),
    // Actions
    actions: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
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
    ),
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
      {columns.map((c) => (
        <Fragment key={c.key}>{cells[c.key]}</Fragment>
      ))}
    </MuiTableRow>
  );
}
