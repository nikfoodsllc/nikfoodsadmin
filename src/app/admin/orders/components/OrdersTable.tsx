'use client';

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Checkbox,
} from '@mui/material';
import OrderTableRow from './OrderTableRow';
import OrderSkeleton from './OrderSkeleton';
import { Order } from '@/types/order';
import { getMaxUniqueDeliveryDays } from '@/utils/delivery';

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
  onViewDetails: (order: Order) => void;
  maxDeliveryDays: number;
  selectedOrderIds: Set<string>;
  onSelectAll: () => void;
  onSelectOrder: (orderId: string) => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  disableSelection?: boolean;
}

export default function OrdersTable({
  orders,
  loading,
  onViewDetails,
  maxDeliveryDays,
  selectedOrderIds,
  onSelectAll,
  onSelectOrder,
  isAllSelected,
  isIndeterminate,
  disableSelection = false,
}: OrdersTableProps) {
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          minWidth: 2500,
          borderRadius: 3,
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: '#F9FAFB',
              }}
            >
              <TableCell sx={{ width: 56, padding: '12px 8px' }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={onSelectAll}
                  disabled={loading || orders.length === 0 || disableSelection}
                  sx={{
                    color: '#9CA3AF',
                    '&.Mui-checked': {
                      color: '#4F8CFF',
                    },
                    '&.MuiCheckbox-indeterminate': {
                      color: '#4F8CFF',
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Order Date
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Order ID
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Customer Name
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Email
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Order Status
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Payment Status
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px', textAlign: 'right' }}>
                Sub Total
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px', textAlign: 'right' }}>
                Service Fee
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px', textAlign: 'right' }}>
                Tax
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px', textAlign: 'right' }}>
                Tip
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px', textAlign: 'right' }}>
                Grand Total
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Phone
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Address
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Apt. No.
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Gate Code
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Instruction to Driver
              </TableCell>
              {/* Dynamic delivery day columns - now based on unique sorted dates */}
              {Array.from({ length: maxDeliveryDays }, (_, i) => (
                <TableCell key={`delivery-day-${i}`} sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Delivery Date {i + 1}
                </TableCell>
              ))}
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <OrderSkeleton />
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18 + maxDeliveryDays} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                  <Typography variant="body2" color="text.secondary">
                    No orders found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order, index) => (
                <OrderTableRow
                  key={order._id || order.orderId}
                  order={order}
                  index={index}
                  onViewDetails={onViewDetails}
                  maxDeliveryDays={maxDeliveryDays}
                  selected={Boolean(order._id && selectedOrderIds.has(order._id))}
                  onToggleSelect={onSelectOrder}
                  disableSelection={disableSelection || !order._id}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
