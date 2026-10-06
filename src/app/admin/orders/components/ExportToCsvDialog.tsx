'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import { Order } from '@/types/order';
import { generateOrdersListingCSV, downloadCSV } from '@/utils/csv';
import { formatPSTDate } from '@/utils/timezone';

interface ExportToCsvDialogProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onExportSuccess: () => void;
  onExportError: (message: string) => void;
  // Add filter props
  searchQuery?: string;
  selectedStatus?: string;
  selectedPaymentStatus?: string;
  selectedPaymentMethod?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
}

export default function ExportToCsvDialog({
  open,
  token,
  onClose,
  onExportSuccess,
  onExportError,
  searchQuery = '',
  selectedStatus = 'all',
  selectedPaymentStatus = 'all',
  selectedPaymentMethod = 'all',
  startDate = '',
  endDate = '',
  sortBy = 'date_desc',
}: ExportToCsvDialogProps) {
  const [useCurrentFilters, setUseCurrentFilters] = useState(true);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Set default dates from current filters
      setExportStartDate(startDate);
      setExportEndDate(endDate);
      setUseCurrentFilters(true);
      setOrders([]);
      setOrderCount(null);
      setFetchError('');
    }
  }, [open, startDate, endDate]);

  // Fetch orders when filters change
  useEffect(() => {
    if (open && useCurrentFilters) {
      fetchOrdersForExport();
    }
  }, [useCurrentFilters, open, searchQuery, selectedStatus, selectedPaymentStatus, selectedPaymentMethod, exportStartDate, exportEndDate, sortBy]);

  const fetchOrdersForExport = async () => {
    if (!token) return;

    setLoading(true);
    setFetchError('');
    setOrderCount(null);

    try {
      // Build query parameters - same as OrdersPage
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedPaymentStatus !== 'all') params.append('paymentStatus', selectedPaymentStatus);
      if (selectedPaymentMethod !== 'all') params.append('paymentMethod', selectedPaymentMethod);
      
      // Use export dates if not using current filters, otherwise use the dates from props
      const effectiveStartDate = useCurrentFilters ? exportStartDate : exportStartDate;
      const effectiveEndDate = useCurrentFilters ? exportEndDate : exportEndDate;
      
      if (effectiveStartDate) params.append('startDate', effectiveStartDate);
      if (effectiveEndDate) params.append('endDate', effectiveEndDate);
      if (sortBy) params.append('sortBy', sortBy);
      
      // Set a high limit to get all orders for export
      params.append('limit', '10000');

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch orders');
      }

      const data = await response.json();
      const fetchedOrders = data.data?.items || [];

      setOrders(fetchedOrders);
      setOrderCount(fetchedOrders.length);
    } catch (error) {
      console.error('Error fetching orders for export:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch orders');
      setOrderCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (orders.length === 0) {
      onExportError('No orders to export');
      return;
    }

    setExporting(true);

    try {
      // Generate CSV content with new function matching table structure
      const csvContent = generateOrdersListingCSV(orders);

      // Generate filename with date range
      const dateStr = exportStartDate && exportEndDate
        ? `${exportStartDate}-to-${exportEndDate}`
        : exportStartDate || exportEndDate || 'all';
      const filename = `orders-${dateStr}.csv`;

      // Trigger download
      downloadCSV(csvContent, filename);

      onExportSuccess();
    } catch (error) {
      console.error('Error exporting CSV:', error);
      onExportError(error instanceof Error ? error.message : 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      setExportStartDate(value);
    } else {
      setExportEndDate(value);
    }
  };

  const handleClose = () => {
    if (!loading && !exporting) {
      onClose();
    }
  };

  const hasActiveFilters = searchQuery || selectedStatus !== 'all' || selectedPaymentStatus !== 'all' || selectedPaymentMethod !== 'all' || startDate || endDate;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
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
        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '18px' }}>
          Export Orders to CSV
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ paddingX: 3, paddingY: 3 }}>
        {/* Use Current Filters Checkbox */}
        {hasActiveFilters && (
          <Box sx={{ marginBottom: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={useCurrentFilters}
                  onChange={(e) => setUseCurrentFilters(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontSize: '13px', color: '#374151' }}>
                  Use current page filters
                </Typography>
              }
            />
            <Typography variant="caption" sx={{ display: 'block', color: '#6B7280', ml: 3.5, mt: 0.5 }}>
              {searchQuery && `Search: "${searchQuery}"`}
              {selectedStatus !== 'all' && ` • Status: ${selectedStatus}`}
              {selectedPaymentStatus !== 'all' && ` • Payment: ${selectedPaymentStatus}`}
              {startDate && ` • From: ${formatPSTDate(startDate)}`}
              {endDate && ` • To: ${formatPSTDate(endDate)}`}
            </Typography>
          </Box>
        )}

        {/* Date Range */}
        <Box sx={{ marginBottom: 2 }}>
          <Typography
            variant="body2"
            sx={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: 1,
            }}
          >
            Date Range
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              type="date"
              label="Start Date"
              value={exportStartDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              disabled={loading || exporting || useCurrentFilters}
              sx={{
                flex: 1,
                minWidth: 160,
                '& .MuiInputBase-root': {
                  backgroundColor: '#fff',
                },
              }}
            />
            <TextField
              type="date"
              label="End Date"
              value={exportEndDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              disabled={loading || exporting || useCurrentFilters}
              sx={{
                flex: 1,
                minWidth: 160,
                '& .MuiInputBase-root': {
                  backgroundColor: '#fff',
                },
              }}
            />
          </Box>
        </Box>

        {loading && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              marginTop: 2,
            }}
          >
            <CircularProgress size={20} />
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              Loading orders...
            </Typography>
          </Box>
        )}

        {!loading && fetchError && (
          <Alert severity="error" sx={{ marginTop: 2 }}>
            {fetchError}
          </Alert>
        )}

        {!loading && !fetchError && orderCount !== null && (
          <Alert severity="info" sx={{ marginTop: 2 }}>
            {orderCount === 0
              ? 'No orders found for the selected criteria'
              : `${orderCount} order${orderCount === 1 ? '' : 's'} found for export`}
          </Alert>
        )}

        {!loading && !fetchError && orderCount !== null && orderCount > 0 && (
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', marginTop: 1 }}>
            Export will include all columns: Order Date, Order ID, Customer Name, Email, Order Status, Payment Status, Sub Total, Platform Fee, Tax, Tip, Grand Total, Phone, Address, Apt. No., Gate Code, Delivery Instructions, Instruction to Driver, Deliver On
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ paddingX: 3, paddingY: 2, borderTop: '1px solid #E5E7EB' }}>
        <Button
          onClick={handleClose}
          disabled={loading || exporting}
          sx={{
            textTransform: 'none',
            color: '#6B7280',
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={loading || exporting || orderCount === 0}
          startIcon={exporting ? <CircularProgress size={16} /> : <IconDownload size={18} />}
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
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
