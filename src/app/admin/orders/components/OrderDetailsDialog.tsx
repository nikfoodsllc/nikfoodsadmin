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
  Collapse,
  IconButton,
} from '@mui/material';
import { IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { getDisplayPaymentStatus, getNetTotal, getRefundedAmount } from '@/utils/refunds';
import { getItemPortionLabel } from '@/utils/portions';
import { Order, OrderStatus } from '@/types/order';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDateTime, formatPSTDate } from '@/utils/timezone';
import { orderEmailStatusView } from '@/utils/orderEmailStatus';

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
  const [expandedCombos, setExpandedCombos] = useState<Set<string>>(new Set());

  // Update selected status when order changes
  useState(() => {
    if (order) {
      setSelectedStatus(order.status);
    }
  });

  // Calculate total eco container charges
  const totalEcoCharges = order?.items.reduce((total, day) => {
    return total + day.items.reduce((dayTotal, item) => {
      return dayTotal + (item.ecoContainerCharge || 0) * item.quantity;
    }, 0);
  }, 0) || 0;

  const hasEcoContainerCharges = totalEcoCharges > 0;

  const toggleCombo = (itemId: string) => {
    setExpandedCombos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

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
          // phone only: small margins so the items table (about 260px wide) has room
          '@media (max-width:599.95px)': { margin: '12px', maxWidth: 'calc(100% - 24px)' },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingX: { xs: 2, sm: 3 },
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

      <DialogContent sx={{ paddingX: { xs: 2, sm: 3 }, paddingY: 3 }}>
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

          <Box sx={{ display: 'flex', gap: 2, marginBottom: 2, flexWrap: 'wrap' }}>
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
              <StatusBadge status={getDisplayPaymentStatus(order)} type="payment" />
            </Box>
            {order.minOrderValue !== undefined && order.minOrderValue > 0 && (
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', display: 'block', marginBottom: 0.5 }}>
                  Min Order Value
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, color: '#4F8CFF' }}>
                  {safeFormatCurrency(order.minOrderValue)}
                </Typography>
              </Box>
            )}
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
  <Typography
    variant="subtitle2"
    sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}
  >
    Delivery Address
  </Typography>

  <Box
    sx={{
      p: 2,
      border: '1px solid #E5E7EB',
      borderRadius: 2,
      backgroundColor: '#FAFAFA'
    }}
  >

    {/* street */}
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {order.address.street}
    </Typography>

    {/* apartment & floor */}
   {/* apartment & floor */}
{(order.address.apartment || order.address.floor) && (
  <Box sx={{ mt: 1 }}>

    <Typography
      variant="caption"
      sx={{
        color: '#6B7280',
        fontWeight: 600,
        display: 'block'
      }}
    >
      Apartment Details
    </Typography>

    <Typography variant="body2" sx={{ color: '#374151' }}>
      {order.address.apartment && `Apartment: ${order.address.apartment}`}
      {order.address.apartment && order.address.floor && ' | '}
      {order.address.floor && `Floor: ${order.address.floor}`}
    </Typography>

  </Box>
)}

    {/* city */}
    <Typography variant="body2">
      {order.address.city}, {order.address.state} {order.address.zipCode}
    </Typography>

    {/* gate */}
    {order.address.entrance && (
      <Typography variant="caption" sx={{ color: '#6B7280' }}>
        Gate Code: {order.address.entrance}
      </Typography>
    )}

    {/* landmark */}
    {order.address.landmark && (
      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
        Landmark: {order.address.landmark}
      </Typography>
    )}

  </Box>
</Box>

        <Divider sx={{ marginY: 2 }} />

        {/* Order Items by Day */}
        <Box sx={{ marginBottom: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
            Order Items
          </Typography>
          {order.items.map((dayOrder, dayIndex) => (
            <Box key={dayIndex} sx={{ marginBottom: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#4F8CFF', marginBottom: 0.5 }}>
                  {dayOrder.day} - {dayOrder.actualDeliveryDate ? formatPSTDate(dayOrder.actualDeliveryDate) : formatPSTDate(dayOrder.deliveryDate)}
                </Typography>
                {dayOrder.actualDeliveryDate && String(dayOrder.actualDeliveryDate) !== String(dayOrder.deliveryDate) && (
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    (Original: {formatPSTDate(dayOrder.deliveryDate)})
                  </Typography>
                )}
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', marginBottom: 1 }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { px: { xs: 0.75, sm: 2 } } }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Item</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '12px' }}><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Quantity</Box><Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Qty</Box></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: '12px' }}>Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: '12px' }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dayOrder.items.map((item, itemIndex) => {
                      const itemUniqueId = `${dayIndex}-${itemIndex}`;
                      const isComboExpanded = expandedCombos.has(itemUniqueId);
                      const hasComboSelections = item.comboSelections && Object.keys(item.comboSelections).length > 0 && item.food.sections;

                      return (
                        <TableRow key={itemIndex}>
                          <TableCell>
                            {/* Item name with veg indicator */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                              {item.food.veg !== undefined && (
                                <Box sx={{
                                  mt: 0.5,
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: item.food.veg ? '#10B981' : '#EF4444',
                                  border: '2px solid',
                                  borderColor: item.food.veg ? '#10B981' : '#EF4444',
                                  flexShrink: 0,
                                }} />
                              )}
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {item.food.name}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Customizations row */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5, ml: 1.75 }}>
                              {item.spiceLevel && (
                                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                  Spice: {item.spiceLevel}
                                </Typography>
                              )}
                              {getItemPortionLabel(item) && (
                                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                  Portion: {getItemPortionLabel(item)}
                                </Typography>
                              )}
                              {item.isEcoFriendlyContainer && (
                                <Typography variant="caption" sx={{ color: '#059669', fontWeight: 500 }}>
                                  🌱 Eco Container {item.ecoContainerCharge && `(+${safeFormatCurrency(item.ecoContainerCharge)})`}
                                </Typography>
                              )}
                            </Box>

                            {/* Combo selections */}
                            {hasComboSelections && (
                              <Box sx={{ ml: 1.75, mt: 0.5 }}>
                                <Box
                                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                  onClick={() => toggleCombo(itemUniqueId)}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#4F8CFF', mr: 0.5 }}>
                                    Combo Selections
                                  </Typography>
                                  {isComboExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                </Box>
                                <Collapse in={isComboExpanded}>
                                  <Box sx={{ pl: 1, borderLeft: '2px solid #E5E7EB', mt: 0.5 }}>
                                    {item.food.sections!.map(section => {
                                      const selectedItemIds = item.comboSelections![section._id] || [];
                                      const selectedItems = section.selectedItems.filter(si =>
                                        selectedItemIds.includes(si._id)
                                      );
                                      if (selectedItems.length === 0) return null;

                                      return (
                                        <Box key={section._id} sx={{ mb: 0.5 }}>
                                          <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500 }}>
                                            {section.title}:
                                          </Typography>
                                          {selectedItems.map(si => (
                                            <Typography key={si._id} variant="caption" sx={{ display: 'block', ml: 1, color: '#374151' }}>
                                              • {si.item.name} {si.portion && `(${si.portion})`}
                                            </Typography>
                                          ))}
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </Collapse>
                              </Box>
                            )}

                            {/* Customer notes */}
                            {item.notes && (
                              <Box sx={{ ml: 1.75, mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#6B7280', fontStyle: 'italic' }}>
                                  Note: {item.notes}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="right">{safeFormatCurrency(item.price)}</TableCell>
                          <TableCell align="right">
                            {safeFormatCurrency(item.price * item.quantity + (item.ecoContainerCharge || 0) * item.quantity)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
            {hasEcoContainerCharges && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>Eco Container Charges</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{safeFormatCurrency(totalEcoCharges)}</Typography>
              </Box>
            )}
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
            {getRefundedAmount(order) > 0 && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#B91C1C' }}>
                    {order.paymentStatus === 'refunded' ? 'Refunded (in full)' : 'Refunded (partial)'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#B91C1C' }}>
                    -{safeFormatCurrency(getRefundedAmount(order))}
                  </Typography>
                </Box>
                <Divider sx={{ marginY: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>Total after refund</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#111827' }}>
                    {safeFormatCurrency(getNetTotal(order))}
                  </Typography>
                </Box>
              </>
            )}
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
            {getRefundedAmount(order) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  {order.paymentStatus === 'refunded' ? 'Refunded (in full)' : 'Partially refunded'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {safeFormatCurrency(getRefundedAmount(order))} of {safeFormatCurrency(order.totalPaid)}
                </Typography>
              </Box>
            )}
            {typeof order.paymentAttempts === 'number' && order.paymentAttempts > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>Failed attempts</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{order.paymentAttempts}</Typography>
              </Box>
            )}
            {order.paymentError && (
              <Box sx={{ backgroundColor: '#FEF2F2', borderRadius: 1, padding: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#991B1B' }}>
                  {order.paymentStatus === 'paid' ? 'Earlier payment problem' : 'Payment problem'}:{' '}
                  {order.paymentError.code}
                  {order.paymentError.declineCode ? ` / ${order.paymentError.declineCode}` : ''}
                </Typography>
                <Typography variant="body2" sx={{ color: '#7F1D1D' }}>{order.paymentError.message}</Typography>
                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                  {new Date(order.paymentError.at).toLocaleString()}
                  {order.paymentError.paymentMethodType ? ` · ${order.paymentError.paymentMethodType}` : ''}
                </Typography>
              </Box>
            )}
            {order.paymentActionRequiredAt && order.paymentStatus !== 'paid' && (
              <Typography variant="caption" sx={{ color: '#92400E' }}>
                Customer was asked to authenticate (e.g. 3D Secure) at{' '}
                {new Date(order.paymentActionRequiredAt).toLocaleString()}
              </Typography>
            )}
            {order.clientPaymentErrors && order.clientPaymentErrors.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: '#6B7280', marginBottom: 0.5 }}>
                  Errors shown to the customer at checkout
                </Typography>
                {order.clientPaymentErrors.map((e, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block', color: '#374151' }}>
                    {new Date(e.at).toLocaleTimeString()} · {e.stage}
                    {e.code ? ` · ${e.code}` : ''}
                    {e.declineCode ? ` / ${e.declineCode}` : ''}: {e.message}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Additional Information */}
        {(order.hasReview !== undefined || order.emailStatus || (order.deliveryMessages && order.deliveryMessages.length > 0)) && (
          <>
            <Divider sx={{ marginY: 2 }} />
            <Box sx={{ marginBottom: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
                Additional Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {order.hasReview !== undefined && (
                  <Box>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                      Review Status
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {order.hasReview ? '✓ Reviewed' : 'Not reviewed'}
                    </Typography>
                  </Box>
                )}
                {order.emailStatus && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                      Confirmation Email
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {order.emailStatus.status} (Attempts: {order.emailStatus.attempts})
                    </Typography>
                    {order.emailDelivery && (() => {
                      const view = orderEmailStatusView(order.emailStatus, order.emailDelivery);
                      return (
                        <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
                          {view.label}
                          {view.detail ? ` · ${view.detail}` : ''}
                        </Typography>
                      );
                    })()}
                    {order.emailStatus.error && (
                      <Typography variant="caption" sx={{ color: '#EF4444' }}>
                        Error: {order.emailStatus.error}
                      </Typography>
                    )}
                  </Box>
                )}
                {order.deliveryMessages && order.deliveryMessages.length > 0 && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                      Delivery Messages
                    </Typography>
                    {order.deliveryMessages.map((msg, idx) => (
                      <Typography key={idx} variant="body2" sx={{ fontWeight: 500 }}>
                        {msg}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}

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

      <DialogActions sx={{ paddingX: { xs: 2, sm: 3 }, paddingY: 2, borderTop: '1px solid #E5E7EB' }}>
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
