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
} from '@mui/material';
import OrderTableRow from './OrderTableRow';
import OrderSkeleton from './OrderSkeleton';
import { Order } from '@/types/order';

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
  onViewDetails: (order: Order) => void;
}

export default function OrdersTable({ orders, loading, onViewDetails }: OrdersTableProps) {
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          minWidth: 1200,
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
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Order ID
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Customer
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Email
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Created At
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Order Status
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Payment Status
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Total
              </TableCell>
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
                <TableCell colSpan={8} sx={{ textAlign: 'center', padding: '48px 16px' }}>
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
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
