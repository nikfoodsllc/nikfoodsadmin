'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert,
  Snackbar,
  Paper,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import { IconRefresh, IconDownload } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPSTDate } from '@/utils/timezone';
import CustomDateRangePicker, { DateRange } from './CustomDateRangePicker';

interface OrderedItem {
  _id: string;
  orderId: string;
  orderDate: Date | string;
  deliveryDate: Date | string;
  customerName: string;
  customerPhone: string;
  itemId: string;
  itemName: string;
  itemDescription?: string;
  portionQuantity: string;
  quantity: number;
  spiceLevel: string;
  itemPrice: number;
  ecoContainer: boolean;
  ecoContainerAvailable: boolean;
}

interface OrderedItemsReportData {
  items: OrderedItem[];
  startDate: string;
  endDate: string;
  totalRecords: number;
}

export default function OrderedItemsReportPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [reportData, setReportData] = useState<OrderedItemsReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
  });

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

  // Fetch ordered items report data
  const fetchOrderedItemsReport = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      params.append('startDate', dateRange.startDate.toISOString().split('T')[0]);
      params.append('endDate', dateRange.endDate.toISOString().split('T')[0]);

      const response = await fetch(`/api/admin/reports/ordered-items?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch ordered items report');
      }

      const result = await response.json();
      setReportData(result.data);
    } catch (error) {
      console.error('Error fetching ordered items report:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to load ordered items report', 'error');
      setReportData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, token]);

  // Auto-load data on mount
  useEffect(() => {
    fetchOrderedItemsReport();
  }, []);

  // Fetch report when date range changes
  useEffect(() => {
    if (dateRange) {
      fetchOrderedItemsReport();
    }
  }, [fetchOrderedItemsReport]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrderedItemsReport();
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.items || reportData.items.length === 0) return;

    // CSV Headers
    const headers = [
      'Order ID',
      'Order Date',
      'Delivery Date',
      'Customer Name',
      'Customer Phone',
      'Item Name',
      'Item Description',
      'Portion Quantity',
      'Quantity',
      'Spice Level',
      'Item Price',
      'Eco Container Available',
      'Eco Container Selected',
    ];

    // Convert items to CSV rows
    const csvRows = reportData.items.map(item => {
      const row = [
        item.orderId,
        formatPSTDate(item.orderDate.toString()),
        formatPSTDate(item.deliveryDate.toString()),
        item.customerName,
        item.customerPhone,
        item.itemName,
        item.itemDescription || '',
        item.portionQuantity,
        item.quantity.toString(),
        item.spiceLevel,
        formatCurrency(item.itemPrice),
        item.ecoContainerAvailable ? 'Yes' : 'No',
        item.ecoContainer ? 'Yes' : 'No',
      ];

      return row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...csvRows
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const startDateStr = dateRange.startDate.toISOString().split('T')[0];
    const endDateStr = dateRange.endDate.toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `ordered-items-report-${startDateStr}-to-${endDateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSnackbar('CSV exported successfully!', 'success');
  };

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
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
            Ordered Items Report
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', marginTop: 0.5 }}>
            View detailed breakdown of all ordered items
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Box
        sx={{
          backgroundColor: '#fff',
          padding: 3,
          borderRadius: 2,
          marginBottom: 3,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Box>
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
            <CustomDateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
            <Tooltip title="Export to CSV">
              <Button
                variant="outlined"
                onClick={exportToCSV}
                disabled={loading || !reportData || !reportData.items || reportData.items.length === 0}
                startIcon={<IconDownload size={18} />}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3,
                }}
              >
                Export CSV
              </Button>
            </Tooltip>
            <Tooltip title="Refresh data">
              <IconButton
                onClick={handleRefresh}
                disabled={refreshing || loading}
                sx={{
                  border: '1px solid #e0e0e0',
                  '&:hover': {
                    backgroundColor: 'rgba(79, 140, 255, 0.04)',
                    borderColor: '#4F8CFF',
                  },
                }}
              >
                <IconRefresh
                  size={20}
                  style={{
                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {dateRange && (
          <Box sx={{ marginTop: 2 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
              Showing orders from <strong>{formatPSTDate(dateRange.startDate.toISOString())}</strong> to{' '}
              <strong>{formatPSTDate(dateRange.endDate.toISOString())}</strong>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Summary Cards */}
      {!loading && reportData && reportData.items && reportData.items.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box
            sx={{
              flex: '1 1 200px',
              backgroundColor: '#fff',
              padding: 2,
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px', fontWeight: 500 }}>
              Total Items Ordered
            </Typography>
            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 600, fontSize: '28px' }}>
              {reportData?.totalRecords ?? 0}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: '1 1 200px',
              backgroundColor: '#fff',
              padding: 2,
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px', fontWeight: 500 }}>
              Total Quantity
            </Typography>
            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 600, fontSize: '28px' }}>
              {reportData?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: '1 1 200px',
              backgroundColor: '#fff',
              padding: 2,
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px', fontWeight: 500 }}>
              Total Revenue
            </Typography>
            <Typography variant="h4" sx={{ color: '#111827', fontWeight: 600, fontSize: '28px' }}>
              {formatCurrency(
                reportData?.items.reduce((sum, item) => sum + (item.itemPrice * item.quantity), 0) ?? 0
              )}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Loading State */}
      {loading && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            gap: 2,
          }}
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Loading ordered items report...
          </Typography>
        </Box>
      )}

      {/* Report Content */}
      {!loading && reportData && (
        <Box>
          {/* No Data State */}
          {(!reportData.items || reportData.items.length === 0) ? (
            <Box
              sx={{
                textAlign: 'center',
                padding: 6,
                backgroundColor: '#fff',
                borderRadius: 2,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Typography variant="h6" sx={{ color: '#111827', marginBottom: 1 }}>
                No Items Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                There are no ordered items for the selected date range
              </Typography>
            </Box>
          ) : (
            /* Table */
            <TableContainer
              component={Paper}
              sx={{
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                borderRadius: 2,
              }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Order ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Order Date
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Delivery Date
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Customer Name
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Item Name
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Portion
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Quantity
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Spice Level
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      Eco Container
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.items.map((item, index) => (
                    <TableRow
                      key={`${item._id}-${index}`}
                      sx={{
                        '&:hover': {
                          backgroundColor: '#F9FAFB',
                        },
                      }}
                    >
                      <TableCell sx={{ fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {item.orderId}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {formatPSTDate(item.orderDate.toString())}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {formatPSTDate(item.deliveryDate.toString())}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        {item.customerName}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        {item.itemName}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#6B7280' }}>
                        {item.portionQuantity || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#374151' }}>
                        <Chip
                          label={item.quantity}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '12px',
                            backgroundColor: '#EEF2FF',
                            color: '#4F46E5',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#6B7280' }}>
                        {item.spiceLevel || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.itemPrice)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#6B7280' }}>
                        {item.ecoContainerAvailable ? (
                          item.ecoContainer ? (
                            <Chip
                              label="Yes"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '11px',
                                backgroundColor: '#D1FAE5',
                                color: '#065F46',
                                fontWeight: 600,
                              }}
                            />
                          ) : (
                            <Chip
                              label="No"
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '11px',
                                backgroundColor: '#FEE2E2',
                                color: '#991B1B',
                                fontWeight: 600,
                              }}
                            />
                          )
                        ) : (
                          <Chip
                            label="N/A"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '11px',
                              backgroundColor: '#F3F4F6',
                              color: '#6B7280',
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

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

      {/* CSS for spin animation */}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  );
}
