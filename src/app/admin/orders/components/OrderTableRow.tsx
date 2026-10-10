'use client';

import { Fragment, ReactNode } from 'react';
import { TableRow as MuiTableRow, TableCell, Typography, Button, Checkbox, Chip, Tooltip } from '@mui/material';
import { IconEye } from '@tabler/icons-react';
import StatusBadge from './StatusBadge';
import { Order } from '@/types/order';
import { safeFormatCurrency } from '@/utils/currency';
import { getDisplayPaymentStatus, getNetTotal, getRefundedAmount } from '@/utils/refunds';
import { formatPSTDate } from '@/utils/timezone';
import { orderEmailStatusView, type EmailTone } from '@/utils/orderEmailStatus';
import { orderOptimoView } from '@/utils/orderOptimoView';
import { rescheduleView } from '@/utils/orderReschedule';

const EMAIL_TONES: Record<EmailTone, { bg: string; color: string }> = {
  good: { bg: '#DCFCE7', color: '#166534' },
  bad: { bg: '#FEE2E2', color: '#991B1B' },
  warn: { bg: '#FEF3C7', color: '#92400E' },
  none: { bg: 'transparent', color: '#9CA3AF' },
};

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
  const emailView = orderEmailStatusView(order.emailStatus, order.emailDelivery);
  const optimoView = orderOptimoView(order.optimo);
  const resched = rescheduleView(order);
  const reschedTitle = resched.rescheduled
    ? `${resched.summary}${resched.lastBy ? ` \u00b7 moved by ${resched.lastBy}` : ''}${resched.email === 'pending' ? ' \u00b7 the customer has not been emailed yet' : resched.email === 'sent' ? ' \u00b7 the customer was emailed' : ''}`
    : 'The delivery date was never moved';

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
    // Confirmation Email (key emailStatus): the order confirmation email (sent, failed, retrying, pending; a dash when none was sent)
    emailStatus: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Tooltip title={emailView.title} arrow>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            {emailView.tone === 'none' ? (
              <Typography variant="body2" sx={{ fontSize: '13px', color: '#9CA3AF' }}>{emailView.label}</Typography>
            ) : (
              <Chip size="small" label={emailView.label} sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: EMAIL_TONES[emailView.tone].bg, color: EMAIL_TONES[emailView.tone].color }} />
            )}
            {emailView.detail && (
              <Typography sx={{ fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap' }}>{emailView.detail}</Typography>
            )}
          </span>
        </Tooltip>
      </TableCell>
    ),
    // Rescheduled (key rescheduled): an admin moved this order's delivery date; says whether the customer was told
    rescheduled: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Tooltip title={reschedTitle} arrow>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            {resched.rescheduled ? (
              <>
                <Chip size="small" label="Rescheduled" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#FEF3C7', color: '#92400E' }} />
                {resched.email === 'pending' && (
                  <Typography sx={{ fontSize: '11px', color: '#B91C1C', fontWeight: 600, whiteSpace: 'nowrap' }}>Customer not told</Typography>
                )}
                {resched.email === 'sent' && (
                  <Typography sx={{ fontSize: '11px', color: resched.emailEvent?.state === 'opened' ? '#166534' : resched.emailEvent?.state === 'bounced' || resched.emailEvent?.state === 'complained' ? '#B91C1C' : '#6B7280', fontWeight: resched.emailEvent?.state === 'opened' || resched.emailEvent?.state === 'bounced' ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {resched.emailEvent?.state === 'opened'
                      ? 'Customer opened email'
                      : resched.emailEvent?.state === 'delivered'
                        ? 'Email delivered'
                        : resched.emailEvent?.state === 'bounced'
                          ? 'Email bounced'
                          : resched.emailEvent?.state === 'complained'
                            ? 'Marked as spam'
                            : 'Customer emailed'}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" sx={{ fontSize: '13px', color: '#9CA3AF' }}>-</Typography>
            )}
          </span>
        </Tooltip>
      </TableCell>
    ),
    // OptimoRoute (key optimo): whether the delivery stop is in the route planner (In OptimoRoute, Failed, Removed; a dash when nothing was sent)
    optimo: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle' }}>
        <Tooltip title={optimoView.title} arrow>
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            {optimoView.tone === 'none' ? (
              <Typography variant="body2" sx={{ fontSize: '13px', color: '#9CA3AF' }}>{optimoView.label}</Typography>
            ) : (
              <Chip size="small" label={optimoView.label} sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: EMAIL_TONES[optimoView.tone].bg, color: EMAIL_TONES[optimoView.tone].color }} />
            )}
            {optimoView.detail && (
              <Typography sx={{ fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap' }}>{optimoView.detail}</Typography>
            )}
          </span>
        </Tooltip>
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
    // Platform Fee (stored as platformFee; the column key stays 'serviceFee' so saved layouts keep working)
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
    // Stripe Fee: what Stripe charged us for this payment (only orders paid after it was added have it)
    stripeFee: (
      <TableCell sx={{ padding: '16px 8px', verticalAlign: 'middle', textAlign: 'right' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: typeof order.stripeFee === 'number' ? 500 : 400,
            color: typeof order.stripeFee === 'number' ? '#111827' : '#9CA3AF',
          }}
        >
          {typeof order.stripeFee === 'number' ? safeFormatCurrency(order.stripeFee) : '-'}
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
        // a moved delivery date gets a warm tint and an amber edge so these orders stand out in the list
        backgroundColor: selected ? '#E6F0FF' : resched.rescheduled ? '#FFFBEB' : index % 2 === 0 ? '#F6FAFF' : '#fff',
        boxShadow: resched.rescheduled ? 'inset 4px 0 0 #F59E0B' : undefined,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: selected ? '#D6E6FF' : resched.rescheduled ? '#FEF3C7' : '#F0F6FF',
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
