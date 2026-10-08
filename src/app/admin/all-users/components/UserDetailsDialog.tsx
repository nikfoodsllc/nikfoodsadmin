'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
} from '@mui/material';
import { IconX, IconMapPin, IconPhone, IconMail, IconEye, IconEdit, IconPlus } from '@tabler/icons-react';
import { UserWithAddresses } from '@/types/user';
import { Order } from '@/types/order';
import StatusBadge from '../../orders/components/StatusBadge';
import OrderDetailsDialog from '../../orders/components/OrderDetailsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDate } from '@/utils/timezone';
import { AddressEditor, ProfileEditor } from './UserEditSections';

interface UserDetailsDialogProps {
  open: boolean;
  user: UserWithAddresses | null;
  onClose: () => void;
  /** Open straight in edit mode (the pencil in the users table) */
  startEditing?: boolean;
  /** Called after something was saved, so the list (and this dialog) show the new values */
  onChanged?: () => void;
}

export default function UserDetailsDialog({ open, user, onClose, startEditing, onChanged }: UserDetailsDialogProps) {
  const router = useRouter();
  const { token, loading: authLoading, isAuthenticated } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersSummary, setOrdersSummary] = useState({ totalOrders: 0, totalSpent: 0 });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  // editing: the customer's own details, one address (by id), or a new address
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | 'new' | null>(null);
  const userKey = user?._id ? String(user._id) : '';

  // every time the dialog opens for a customer it starts in view mode (or edit mode when asked)
  useEffect(() => {
    if (!open) return;
    setEditingProfile(Boolean(startEditing));
    setEditingAddress(null);
  }, [open, userKey, startEditing]);

  const saved = () => {
    setEditingProfile(false);
    setEditingAddress(null);
    onChanged?.();
  };

  // Fetch user orders when dialog opens
  useEffect(() => {
    if (open && user && user._id) {
      fetchUserOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const fetchUserOrders = async () => {
    if (!user || !user._id) return;

    // Check authentication before making API calls
    if (!token || !isAuthenticated) {
      router.push('/login');
      return;
    }

    setLoadingOrders(true);
    setOrdersError(null);
    try {
      // Safely convert user._id to string (handle both ObjectId object and string)
      const userIdString = typeof user._id === 'string' ? user._id : user._id.toString();

      console.log('Fetching orders for user:', userIdString);

      const response = await fetch(`/api/admin/users/${userIdString}/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user orders');
      }

      const data = await response.json();
      console.log('User orders response:', data);

      setOrders(data.data?.orders || []);
      setOrdersSummary(data.data?.summary || { totalOrders: 0, totalSpent: 0 });
    } catch (error) {
      console.error('Error fetching user orders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch orders';
      setOrdersError(errorMessage);
      // Reset to empty state on error
      setOrders([]);
      setOrdersSummary({ totalOrders: 0, totalSpent: 0 });
    } finally {
      setLoadingOrders(false);
    }
  };

  // Show loading spinner while auth is initializing
  if (authLoading) {
    return null; // Don't render dialog while auth is loading
  }

  // Redirect to login if not authenticated (only when dialog tries to open)
  if (open && (!token || !isAuthenticated)) {
    router.push('/login');
    return null;
  }

  if (!user) return null;

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setOrderDialogOpen(true);
  };

  const handleOrderDialogClose = () => {
    setOrderDialogOpen(false);
    setSelectedOrder(null);
  };

  const handleOrderStatusUpdate = async (_orderId: string, _newStatus: string) => {
    // This will be handled by the nested OrderDetailsDialog
    // After update, refresh the orders list
    await fetchUserOrders();
  };

  return (
    <>
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
          <Box component="span" sx={{ fontWeight: 600, fontSize: '18px' }}>
            User Details
          </Box>
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
          {/* User Information */}
          <Box sx={{ marginBottom: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                User Information
              </Typography>
              {!editingProfile && (
                <Button size="small" startIcon={<IconEdit size={14} />} onClick={() => setEditingProfile(true)} sx={{ textTransform: 'none', color: '#4F8CFF' }}>
                  Edit details
                </Button>
              )}
            </Box>
            {editingProfile && token && (
              <Box sx={{ marginBottom: 2 }}>
                <ProfileEditor key={userKey} user={user} token={token} onSaved={saved} onCancel={() => setEditingProfile(false)} />
              </Box>
            )}
            <Box sx={{ display: editingProfile ? 'none' : 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  Name
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {user.name || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  Role
                </Typography>
                <Box sx={{ marginTop: 0.5 }}>
                  <Chip
                    label={user.role}
                    size="small"
                    sx={{
                      height: 24,
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: user.role === 'ADMIN' ? '#FEF3C7' : '#E6F0FF',
                      color: user.role === 'ADMIN' ? '#F59E0B' : '#4F8CFF',
                    }}
                  />
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  Email
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, marginTop: 0.5 }}>
                  <IconMail size={14} color="#6B7280" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {user.email}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  Phone
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, marginTop: 0.5 }}>
                  <IconPhone size={14} color="#6B7280" />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {user.phone || 'N/A'}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  Registered On
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {formatPSTDate(user.createdAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  Profile Status
                </Typography>
                <Box sx={{ marginTop: 0.5 }}>
                  <Chip
                    label={user.isCompleted ? 'Completed' : 'Incomplete'}
                    size="small"
                    sx={{
                      height: 24,
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: user.isCompleted ? '#D1FAE5' : '#FEE2E2',
                      color: user.isCompleted ? '#10B981' : '#EF4444',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ marginY: 2 }} />

          {/* Addresses */}
          <Box sx={{ marginBottom: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                Addresses ({user.addresses?.length || 0})
              </Typography>
              {editingAddress === null && (
                <Button size="small" startIcon={<IconPlus size={14} />} onClick={() => setEditingAddress('new')} sx={{ textTransform: 'none', color: '#4F8CFF' }}>
                  Add address
                </Button>
              )}
            </Box>
            {editingAddress === 'new' && token && (
              <Box sx={{ marginBottom: 1.5 }}>
                <AddressEditor user={user} token={token} onSaved={saved} onCancel={() => setEditingAddress(null)} />
              </Box>
            )}
            {!user.addresses || user.addresses.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#6B7280', fontStyle: 'italic' }}>
                No addresses saved
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {user.addresses.map((address, index) =>
                  editingAddress !== null && editingAddress === String(address._id) && token ? (
                    <AddressEditor key={String(address._id)} user={user} address={address} token={token} onSaved={saved} onCancel={() => setEditingAddress(null)} />
                  ) : (
                  <Paper
                    key={address._id?.toString() || index}
                    elevation={0}
                    sx={{
                      padding: 2,
                      border: '1px solid #E5E7EB',
                      borderRadius: 2,
                      backgroundColor: '#F9FAFB',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <IconMapPin size={16} color="#4F8CFF" style={{ marginTop: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {address.name}
                            </Typography>
                            {(address as { isDefault?: boolean }).isDefault && (
                              <Chip label="Default" size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 600, backgroundColor: '#D1FAE5', color: '#10B981' }} />
                            )}
                          </Box>
                          {editingAddress === null && (
                            <Button size="small" startIcon={<IconEdit size={13} />} onClick={() => setEditingAddress(String(address._id))} sx={{ textTransform: 'none', fontSize: '12px', color: '#4F8CFF', minWidth: 0 }}>
                              Edit
                            </Button>
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px', lineHeight: 1.6 }}>
                          {address.street_address}
                          {address.apartment && `, Apt ${address.apartment}`}
                          {address.floor && `, Floor ${address.floor}`}
                          <br />
                          {address.city}, {address.province} {address.postal_code}
                          {address.location_remark && (
                            <>
                              <br />
                              <Typography component="span" variant="caption" sx={{ color: '#6B7280', fontStyle: 'italic' }}>
                                Note: {address.location_remark}
                              </Typography>
                            </>
                          )}
                        </Typography>
                        {(address.phone || address.email) && (
                          <Box sx={{ marginTop: 1, display: 'flex', gap: 2 }}>
                            {address.phone && (
                              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                <IconPhone size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                {address.phone}
                              </Typography>
                            )}
                            {address.email && (
                              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                <IconMail size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                {address.email}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                  )
                )}
              </Box>
            )}
          </Box>

          <Divider sx={{ marginY: 2 }} />

          {/* Orders Summary */}
          <Box sx={{ marginBottom: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
              Orders Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box
                sx={{
                  padding: 2,
                  backgroundColor: '#E6F0FF',
                  borderRadius: 2,
                  flex: 1,
                }}
              >
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '11px' }}>
                  Total Orders
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#4F8CFF', marginTop: 0.5 }}>
                  {ordersSummary.totalOrders}
                </Typography>
              </Box>
              <Box
                sx={{
                  padding: 2,
                  backgroundColor: '#ECFDF5',
                  borderRadius: 2,
                  flex: 1,
                }}
              >
                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '11px' }}>
                  Total Spent
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#10B981', marginTop: 0.5 }}>
                  {safeFormatCurrency(ordersSummary.totalSpent)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Orders Table */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1.5, color: '#111827' }}>
              Order History
            </Typography>
            {loadingOrders ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : ordersError ? (
              <Box sx={{ padding: 2, backgroundColor: '#FEE2E2', borderRadius: 2, border: '1px solid #FCA5A5' }}>
                <Typography variant="body2" sx={{ color: '#DC2626', fontWeight: 500 }}>
                  Error loading orders: {ordersError}
                </Typography>
              </Box>
            ) : orders.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#6B7280', fontStyle: 'italic', padding: 2 }}>
                No orders yet
              </Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Order ID</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: '12px' }}>Total</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '12px' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order._id || order.orderId} sx={{ '&:hover': { backgroundColor: '#F9FAFB' } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: '#4F8CFF' }}>
                            {order.orderId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '12px' }}>
                            {formatPSTDate(order.createdAt as Date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} type="order" />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                            {safeFormatCurrency(order.totalPaid)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            startIcon={<IconEye size={14} />}
                            onClick={() => handleViewOrderDetails(order)}
                            sx={{
                              textTransform: 'none',
                              fontSize: '11px',
                              color: '#4F8CFF',
                              '&:hover': {
                                backgroundColor: '#E6F0FF',
                              },
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ paddingX: 3, paddingY: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={onClose}
            sx={{
              textTransform: 'none',
              color: '#6B7280',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nested Order Details Dialog */}
      <OrderDetailsDialog
        open={orderDialogOpen}
        order={selectedOrder}
        loading={false}
        onClose={handleOrderDialogClose}
        onStatusUpdate={handleOrderStatusUpdate}
      />
    </>
  );
}
