'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Alert, Snackbar, CircularProgress, Button } from '@mui/material';
import OrdersTable from './OrdersTable';
import OrderFilters from './OrderFilters';
import OrderDetailsDialog from './OrderDetailsDialog';
import ExportToCsvDialog from './ExportToCsvDialog';
import { IconDownload } from '@tabler/icons-react';
import TablePagination from '../../food-items/components/TablePagination';
import { Order, OrderStatus } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';

export default function OrdersPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const itemsPerPage = 10;

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Handle authentication loading and redirects
  if (authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  // Fetch orders with filters
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedPaymentStatus !== 'all') params.append('paymentStatus', selectedPaymentStatus);
      if (selectedPaymentMethod !== 'all') params.append('paymentMethod', selectedPaymentMethod);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (sortBy) params.append('sortBy', sortBy);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.data?.items || []);
      setTotalOrders(data.data?.total || 0);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showSnackbar('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedStatus, selectedPaymentStatus, selectedPaymentMethod, startDate, endDate, sortBy, currentPage]);

  // Fetch orders when filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (!dialogLoading) {
      setDialogOpen(false);
      setSelectedOrder(null);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setDialogLoading(true);

    try {
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          _id: orderId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update order status');
      }

      showSnackbar('Order status updated successfully');
      await fetchOrders();

      // Update the selected order in the dialog
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to update order status',
        'error'
      );
    } finally {
      setDialogLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  };

  const handlePaymentStatusChange = (value: string) => {
    setSelectedPaymentStatus(value);
    setCurrentPage(1);
  };

  const handlePaymentMethodChange = (value: string) => {
    setSelectedPaymentMethod(value);
    setCurrentPage(1);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setCurrentPage(1);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setCurrentPage(1);
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedPaymentStatus('all');
    setSelectedPaymentMethod('all');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleExportClick = () => {
    setExportDialogOpen(true);
  };

  const handleExportDialogClose = () => {
    setExportDialogOpen(false);
  };

  const handleExportSuccess = () => {
    setExportDialogOpen(false);
    showSnackbar('CSV exported successfully');
  };

  const handleExportError = (message: string) => {
    showSnackbar(message, 'error');
  };

  const totalPages = Math.ceil(totalOrders / itemsPerPage);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
          Orders
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<IconDownload size={18} />}
            onClick={handleExportClick}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              borderColor: '#E5E7EB',
              color: '#374151',
              '&:hover': {
                borderColor: '#4F8CFF',
                backgroundColor: 'rgba(79, 140, 255, 0.04)',
              },
            }}
          >
            Export to CSV
          </Button>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Total: {totalOrders} orders
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ marginBottom: 3 }}>
        <OrderFilters
          searchValue={searchQuery}
          selectedStatus={selectedStatus}
          selectedPaymentStatus={selectedPaymentStatus}
          selectedPaymentMethod={selectedPaymentMethod}
          startDate={startDate}
          endDate={endDate}
          sortBy={sortBy}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onPaymentStatusChange={handlePaymentStatusChange}
          onPaymentMethodChange={handlePaymentMethodChange}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          onSortByChange={handleSortByChange}
          onClearFilters={handleClearFilters}
        />
      </Box>

      {/* Table */}
      <Box sx={{ marginBottom: 3 }}>
        <OrdersTable
          orders={orders}
          loading={loading}
          onViewDetails={handleViewDetails}
        />
      </Box>

      {/* Pagination */}
      {!loading && totalOrders > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </Box>
      )}

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        open={dialogOpen}
        order={selectedOrder}
        loading={dialogLoading}
        onClose={handleDialogClose}
        onStatusUpdate={handleStatusUpdate}
      />

      {/* Export to CSV Dialog */}
      <ExportToCsvDialog
        open={exportDialogOpen}
        token={token}
        onClose={handleExportDialogClose}
        onExportSuccess={handleExportSuccess}
        onExportError={handleExportError}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
