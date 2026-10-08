'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import OrdersTable from './OrdersTable';
import OrderFilters from './OrderFilters';
import ColumnVisibilityMenu from '@/components/table/ColumnVisibilityMenu';
import { ORDERS_COLUMNS, ORDERS_COLUMNS_STORAGE_KEY } from './ordersColumns';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
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
  // what is typed in the search box, and what the table is actually filtered by (it follows the box after a short pause)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // every request gets a number; only the newest one may update the table (a slow earlier answer must never replace it)
  const fetchSeq = useRef(0);
  const fetchAbort = useRef<AbortController | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [selectedOptimo, setSelectedOptimo] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Search while typing: wait for a short pause instead of asking the server for every letter
  useEffect(() => {
    if (searchInput === searchQuery) return;
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
      setSelectedOrderIds(new Set());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);
  const itemsPerPage = 100;

  // Column order, widths and hidden columns, saved to this admin's account
  const columnPrefs = useColumnPreferences(ORDERS_COLUMNS_STORAGE_KEY, ORDERS_COLUMNS, 'orders');

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
    const seq = ++fetchSeq.current;
    fetchAbort.current?.abort();
    const controller = new AbortController();
    fetchAbort.current = controller;
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
      if (selectedOptimo !== 'all') params.append('optimo', selectedOptimo);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (sortBy) params.append('sortBy', sortBy);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      if (seq !== fetchSeq.current) return; // a newer search replaced this one
      const nextOrders = data.data?.items || [];
      setOrders(nextOrders);
      setTotalOrders(data.data?.total || 0);
      setSelectedOrderIds((prev) => {
        const visibleIds = new Set(
          nextOrders
            .map((order: Order) => order._id)
            .filter((id: string | undefined): id is string => Boolean(id))
        );
        const nextSelected = new Set<string>();
        prev.forEach((id) => {
          if (visibleIds.has(id)) {
            nextSelected.add(id);
          }
        });
        return nextSelected;
      });
    } catch (error) {
      if (controller.signal.aborted || seq !== fetchSeq.current) return; // cancelled because a newer search started
      console.error('Error fetching orders:', error);
      showSnackbar('Failed to load orders', 'error');
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [searchQuery, selectedStatus, selectedPaymentStatus, selectedPaymentMethod, selectedOptimo, startDate, endDate, sortBy, currentPage, token]);

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
    setSearchInput(value);
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handlePaymentStatusChange = (value: string) => {
    setSelectedPaymentStatus(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handlePaymentMethodChange = (value: string) => {
    setSelectedPaymentMethod(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handleOptimoChange = (value: string) => {
    setSelectedOptimo(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedPaymentStatus('all');
    setSelectedPaymentMethod('all');
    setSelectedOptimo('all');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
    setCurrentPage(1);
    setSelectedOrderIds(new Set());
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedOrderIds(new Set());
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

  const selectableOrderIds = orders
    .map((order) => order._id)
    .filter((id: string | undefined): id is string => Boolean(id));

  const isAllSelected =
    selectableOrderIds.length > 0 && selectableOrderIds.every((id) => selectedOrderIds.has(id));
  const isIndeterminate = selectedOrderIds.size > 0 && !isAllSelected;
  const hasSelection = selectedOrderIds.size > 0;

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleToggleSelectAllOrders = () => {
    if (isAllSelected) {
      setSelectedOrderIds(new Set());
      return;
    }
    setSelectedOrderIds(new Set(selectableOrderIds));
  };

  const handleClearSelection = () => {
    setSelectedOrderIds(new Set());
    setBulkStatus('');
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedOrderIds.size === 0) {
      return;
    }

    setBulkUpdating(true);
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
          ids: Array.from(selectedOrderIds),
          status: bulkStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update selected orders');
      }

      const data = await response.json();
      const modifiedCount = data?.data?.modifiedCount ?? selectedOrderIds.size;
      showSnackbar(`Updated ${modifiedCount} order${modifiedCount === 1 ? '' : 's'} successfully`);
      setSelectedOrderIds(new Set());
      setBulkStatus('');
      await fetchOrders();
    } catch (error) {
      console.error('Error updating selected orders:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to update selected orders',
        'error'
      );
    } finally {
      setBulkUpdating(false);
    }
  };

  // Calculate maximum unique delivery days across all orders using new utility

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {hasSelection && (
            <>
              <Chip
                label={`${selectedOrderIds.size} selected`}
                size="small"
                sx={{
                  backgroundColor: '#E6F0FF',
                  color: '#4F8CFF',
                  fontWeight: 500,
                }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Bulk Status</InputLabel>
                <Select
                  value={bulkStatus}
                  label="Bulk Status"
                  onChange={(e) => setBulkStatus(e.target.value as OrderStatus | '')}
                  disabled={bulkUpdating}
                  sx={{ backgroundColor: '#fff' }}
                >
                  <MenuItem value="">Select status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="preparing">Preparing</MenuItem>
                  <MenuItem value="ready">Ready</MenuItem>
                  <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={handleBulkStatusUpdate}
                disabled={!bulkStatus || bulkUpdating}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2.5,
                  backgroundColor: '#10B981',
                  '&:hover': {
                    backgroundColor: '#059669',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: '#D1D5DB',
                    color: '#9CA3AF',
                  },
                }}
              >
                {bulkUpdating ? 'Updating...' : `Update Selected (${selectedOrderIds.size})`}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClearSelection}
                disabled={bulkUpdating}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  borderColor: '#E5E7EB',
                  color: '#374151',
                  '&:hover': {
                    borderColor: '#4F8CFF',
                    backgroundColor: 'rgba(79, 140, 255, 0.04)',
                  },
                }}
              >
                Clear
              </Button>
            </>
          )}
          <ColumnVisibilityMenu
            columns={columnPrefs.allColumns}
            hiddenKeys={columnPrefs.hiddenKeys}
            onToggle={columnPrefs.toggleColumn}
            onMove={columnPrefs.moveColumn}
            syncStatus={columnPrefs.syncStatus}
            onShowAll={columnPrefs.showAll}
            onReset={columnPrefs.reset}
            disabled={bulkUpdating}
          />
          <Button
            variant="outlined"
            startIcon={<IconDownload size={18} />}
            onClick={handleExportClick}
            disabled={bulkUpdating}
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
          searchValue={searchInput}
          selectedStatus={selectedStatus}
          selectedPaymentStatus={selectedPaymentStatus}
          selectedPaymentMethod={selectedPaymentMethod}
          selectedOptimo={selectedOptimo}
          startDate={startDate}
          endDate={endDate}
          sortBy={sortBy}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onPaymentStatusChange={handlePaymentStatusChange}
          onPaymentMethodChange={handlePaymentMethodChange}
          onOptimoChange={handleOptimoChange}
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
          columns={columnPrefs.columns}
          widths={columnPrefs.widths}
          totalWidth={columnPrefs.totalWidth}
          onColumnResize={columnPrefs.setWidth}
          onColumnReset={columnPrefs.resetWidth}
          selectedOrderIds={selectedOrderIds}
          onSelectAll={handleToggleSelectAllOrders}
          onSelectOrder={handleToggleOrderSelection}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          disableSelection={bulkUpdating}
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
        searchQuery={searchQuery}
        selectedStatus={selectedStatus}
        selectedPaymentStatus={selectedPaymentStatus}
        selectedPaymentMethod={selectedPaymentMethod}
        selectedOptimo={selectedOptimo}
          startDate={startDate}
          endDate={endDate}
          sortBy={sortBy}
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
