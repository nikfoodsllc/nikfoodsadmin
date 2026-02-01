'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { Order, OrderStatus } from '@/types/order';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDateTime, formatPSTDate } from '@/utils/timezone';

interface OrderDetailsDialogProps {
  open: boolean;
  order: Order | null;
  loading: boolean;
  onClose: () => void;
  onStatusUpdate: (orderId: string, newStatus: OrderStatus) => Promise<void>;
}

export default function OrderDetailsDialog({
  open,
  order,
  loading: _loading,
  onClose,
  onStatusUpdate,
}: OrderDetailsDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('pending');
  const [updating, setUpdating] = useState(false);

  // Update selected status when order changes
  useState(() => {
    if (order) {
      setSelectedStatus(order.status);
    }
  });

  if (!order) return null;

  const handleStatusUpdate = async () => {
    if (!order._id) return;

    setUpdating(true);
    try {
      await onStatusUpdate(order._id, selectedStatus);
    } finally {
      setUpdating(false);
    }
  };

  const hasStatusChanged = selectedStatus !== order.status;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingX: 3,
          paddingY: 2,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
          Order Details
        </Typography>
        <Button
          onClick={onClose}
          sx={{
            minWidth: 'auto',
            padding: 0.5,
            color: '#6B7280',
            '&:hover': {
              backgroundColor: '#F3F4F6',
            },
          }}
        >
          <IconX size={20} />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ paddingX: 3, paddingY: 3 }}>
        {/* Order Header Info */}
        <Box sx={{ marginBottom: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                Order ID
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#4F8CFF', fontSize: '16px' }}>
                {order.orderId}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                Created At
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatPSTDateTime(order.createdAt)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, marginBottom: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', display: 'block', marginBottom: 0.5 }}>
                Order Status
              </Typography>
              <StatusBadge status={order.status} type="order" />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', display: 'block', marginBottom: 0.5 }}>
                Payment Status
              </Typography>
              <StatusBadge status={order.paymentStatus} type="payment" />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Customer Information */}
        <Box sx={{ marginBottom: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Customer Information
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                Name
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {order.customerInfo.name}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                Phone
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {order.customerInfo.phone}
              </Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                Email
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {order.customerInfo.email}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Delivery Address */}
        <Box sx={{ marginBottom: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Delivery Address
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {order.address.street}
            {order.address.apartment && `, Apt ${order.address.apartment}`}
            {order.address.floor && `, Floor ${order.address.floor}`}
            <br />
            {order.address.city}, {order.address.state} {order.address.zipCode}
            {order.address.landmark && (
              <>
                <br />
                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                  Landmark: {order.address.landmark}
                </Typography>
              </>
            )}
          </Typography>
        </Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Order Items by Day */}
        <Box sx={{ marginBottom: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Order Items
          </Typography>
          {order.items.map((dayOrder, dayIndex) => (
            <Box key={dayIndex} sx={{ marginBottom: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#4F8CFF', marginBottom: 1 }}>
                {dayOrder.day} - {formatPSTDate(dayOrder.deliveryDate)}
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', marginBottom: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Item</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '12px' }}>Quantity</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: '12px' }}>Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: '12px' }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dayOrder.items.map((item, itemIndex) => (
                      <TableRow key={itemIndex}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.food.name}
                          </Typography>
                          {item.spiceLevel && (
                            <Typography variant="caption" sx={{ color: '#6B7280' }}>
                              Spice: {item.spiceLevel}
                            </Typography>
                          )}
                          {item.portions && (
                            <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
                              Portions: {item.portions}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">{safeFormatCurrency(item.price)}</TableCell>
                        <TableCell align="right">{safeFormatCurrency(item.price * item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} sx={{ fontWeight: 600, borderTop: '2px solid #E5E7EB' }}>
                        Day Total
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, borderTop: '2px solid #E5E7EB' }}>
                        {safeFormatCurrency(dayOrder.dayTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Order Summary */}
        <Box sx={{ marginBottom: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Order Summary
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Subtotal</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{safeFormatCurrency(order.subtotal)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Platform Fee</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{safeFormatCurrency(order.platformFee)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Delivery Fee</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{safeFormatCurrency(order.deliveryFee)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Taxes</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{safeFormatCurrency(order.taxes)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Tip</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{safeFormatCurrency(order.tip)}</Typography>
            </Box>
            {order.discount && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#10B981' }}>
                  Discount ({order.discount.code})
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, color: '#10B981' }}>
                  -{safeFormatCurrency(order.discount.amount)}
                </Typography>
              </Box>
            )}
            <Divider sx={{ marginY: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>Total Paid</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#4F8CFF' }}>
                {safeFormatCurrency(order.totalPaid)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Payment Information */}
        <Box sx={{ marginBottom: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Payment Information
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>Payment Method</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{order.paymentMethod}</Typography>
            </Box>
            {order.stripePaymentIntentId && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>Payment ID</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '11px' }}>
                  {order.stripePaymentIntentId}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Update Order Status */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Update Order Status
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Order Status</InputLabel>
            <Select
              value={selectedStatus}
              label="Order Status"
              onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="preparing">Preparing</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ paddingX: 3, paddingY: 2, borderTop: '1px solid #E5E7EB' }}>
        <Button
          onClick={onClose}
          disabled={updating}
          sx={{
            textTransform: 'none',
            color: '#6B7280',
          }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleStatusUpdate}
          disabled={!hasStatusChanged || updating}
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
            '&.Mui-disabled': {
              backgroundColor: '#E5E7EB',
              color: '#9CA3AF',
            },
          }}
        >
          {updating ? <CircularProgress size={20} /> : 'Update Status'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
