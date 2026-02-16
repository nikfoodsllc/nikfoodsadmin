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
} from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import { DeliveryOrderReport } from '@/types/order';
import { generateDeliveryCSV, downloadCSV } from '@/utils/csv';
import { formatPSTDate } from '@/utils/timezone';

interface ExportToCsvDialogProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onExportSuccess: () => void;
  onExportError: (message: string) => void;
}

export default function ExportToCsvDialog({
  open,
  token,
  onClose,
  onExportSuccess,
  onExportError,
}: ExportToCsvDialogProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [orders, setOrders] = useState<DeliveryOrderReport[]>([]);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // Set today's date as default
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
      setOrders([]);
      setOrderCount(null);
      setFetchError('');
    }
  }, [open]);

  // Fetch orders when date changes
  useEffect(() => {
    if (open && selectedDate) {
      fetchOrdersForDate();
    }
  }, [selectedDate, open]);

  const fetchOrdersForDate = async () => {
    if (!selectedDate || !token) return;

    setLoading(true);
    setFetchError('');
    setOrderCount(null);

    try {
      const params = new URLSearchParams();
      params.append('date', selectedDate);

      const response = await fetch(`/api/admin/reports/delivery?${params.toString()}`, {
        headers: token ? {
          Authorization: `Bearer ${token}`,
        } : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch orders');
      }

      const result = await response.json();
      const fetchedOrders = result.data?.orders || [];

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
    if (!selectedDate || orders.length === 0) {
      onExportError('No orders to export');
      return;
    }

    setExporting(true);

    try {
      // Generate CSV content
      const csvContent = generateDeliveryCSV(orders);

      // Generate filename with delivery date
      const filename = `orders-delivery-${selectedDate}.csv`;

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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleClose = () => {
    if (!loading && !exporting) {
      onClose();
    }
  };

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
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
          Export Orders to CSV
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ paddingX: 3, paddingY: 3 }}>
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
            Delivery Date
          </Typography>
          <TextField
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            size="small"
            fullWidth
            disabled={loading || exporting}
            sx={{
              '& .MuiInputBase-root': {
                backgroundColor: '#fff',
              },
            }}
          />
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
              ? `No orders found for ${formatPSTDate(selectedDate)}`
              : `${orderCount} order${orderCount === 1 ? '' : 's'} found for ${formatPSTDate(selectedDate)}`}
          </Alert>
        )}

        {!loading && !fetchError && orderCount !== null && orderCount > 0 && (
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', marginTop: 1 }}>
            Each order will be exported as a single row with all items combined
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
          disabled={!selectedDate || loading || exporting || orderCount === 0}
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
