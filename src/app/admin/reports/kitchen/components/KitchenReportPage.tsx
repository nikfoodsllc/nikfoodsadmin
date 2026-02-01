'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
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
} from '@mui/material';
import { IconRefresh } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPSTDate } from '@/utils/timezone';

interface ItemWiseTotal {
  itemName: string;
  spiceLevel: string;
  totalQuantity: number;
}

interface OrderItem {
  name: string;
  quantity: number;
  spiceLevel?: string;
}

interface OrderWiseDetail {
  orderId: string;
  customerName: string;
  items: OrderItem[];
}

interface KitchenReportData {
  itemWiseTotals: ItemWiseTotal[];
  orderWiseDetails: OrderWiseDetail[];
  startDate: string;
  endDate: string;
}

export default function KitchenReportPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [reportData, setReportData] = useState<KitchenReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Fetch kitchen report data
  const fetchKitchenReport = useCallback(async () => {
    try {
      setLoading(true);
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/admin/reports/kitchen?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch kitchen report');
      }

      const data = await response.json();
      setReportData(data.data);
    } catch (error) {
      console.error('Error fetching kitchen report:', error);
      showSnackbar('Failed to load kitchen report', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, token]);

  // Fetch report when date filters change
  useEffect(() => {
    fetchKitchenReport();
  }, [fetchKitchenReport]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchKitchenReport();
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
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
            Kitchen Report
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', marginTop: 0.5 }}>
            View item-wise totals and order-wise details for kitchen operations
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
            alignItems: 'flex-end',
          }}
        >
          <Box sx={{ flex: { xs: '1 1 200px', sm: '1 1 250px' } }}>
            <Typography
              variant="body2"
              sx={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: 1,
              }}
            >
              Start Date
            </Typography>
            <TextField
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              size="small"
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: '#fff',
                },
              }}
            />
          </Box>

          <Box sx={{ flex: { xs: '1 1 200px', sm: '1 1 250px' } }}>
            <Typography
              variant="body2"
              sx={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: 1,
              }}
            >
              End Date
            </Typography>
            <TextField
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              size="small"
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: '#fff',
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={handleClearFilters}
              disabled={loading || refreshing}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
              }}
            >
              Clear
            </Button>
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

        {reportData?.startDate && reportData?.endDate && (
          <Box sx={{ marginTop: 2 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
              Showing data from <strong>{formatPSTDate(reportData.startDate)}</strong> to{' '}
              <strong>{formatPSTDate(reportData.endDate)}</strong>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Loading State */}
      {loading && (
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
      )}

      {/* Report Content */}
      {!loading && reportData && (
        <Box>
          {/* Section 1: Item-wise Totals */}
          <Box sx={{ marginBottom: 4 }}>
            <Typography
              variant="h6"
              sx={{
                fontSize: '17px',
                fontWeight: 600,
                marginBottom: 2,
                color: '#111827',
              }}
            >
              Item-wise Totals
            </Typography>

            {(!reportData.itemWiseTotals || reportData.itemWiseTotals.length === 0) ? (
              <Box
                sx={{
                  textAlign: 'center',
                  padding: 4,
                  backgroundColor: '#fff',
                  borderRadius: 2,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Typography variant="body1" sx={{ color: '#6B7280' }}>
                  No items found for the selected date range
                </Typography>
              </Box>
            ) : (
              <TableContainer
                component={Paper}
                sx={{
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                        }}
                      >
                        Food Item
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                        }}
                      >
                        Spice Level
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                        }}
                        align="right"
                      >
                        Total Quantity
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.itemWiseTotals?.map((item, index) => (
                      <TableRow
                        key={`${item.itemName}-${item.spiceLevel}-${index}`}
                        sx={{
                          '&:hover': {
                            backgroundColor: '#f9fafb',
                          },
                        }}
                      >
                        <TableCell
                          sx={{
                            fontSize: '14px',
                            color: '#111827',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          {item.itemName}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '14px',
                            color: '#6B7280',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          {item.spiceLevel || 'N/A'}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '14px',
                            color: '#111827',
                            fontWeight: 600,
                            borderBottom: '1px solid #f3f4f6',
                          }}
                          align="right"
                        >
                          {item.totalQuantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Section 2: Order-wise Details */}
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontSize: '17px',
                fontWeight: 600,
                marginBottom: 2,
                color: '#111827',
              }}
            >
              Order-wise Details
            </Typography>

            {(!reportData.orderWiseDetails || reportData.orderWiseDetails.length === 0) ? (
              <Box
                sx={{
                  textAlign: 'center',
                  padding: 4,
                  backgroundColor: '#fff',
                  borderRadius: 2,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Typography variant="body1" sx={{ color: '#6B7280' }}>
                  No orders found for the selected date range
                </Typography>
              </Box>
            ) : (
              <TableContainer
                component={Paper}
                sx={{
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                        }}
                      >
                        Order ID
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                        }}
                      >
                        Customer Name
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#374151',
                          borderBottom: '2px solid #e5e7eb',
                        }}
                      >
                        Items
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.orderWiseDetails?.map((order) => (
                      <TableRow
                        key={order.orderId}
                        sx={{
                          '&:hover': {
                            backgroundColor: '#f9fafb',
                          },
                        }}
                      >
                        <TableCell
                          sx={{
                            fontSize: '14px',
                            color: '#111827',
                            fontWeight: 500,
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          {order.orderId}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '14px',
                            color: '#6B7280',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          {order.customerName}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '14px',
                            color: '#111827',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                        >
                          {order.items.map((item, idx) => (
                            <Box
                              key={idx}
                              sx={{
                                marginBottom: idx < order.items.length - 1 ? 1 : 0,
                                paddingBottom: idx < order.items.length - 1 ? 1 : 0,
                                borderBottom:
                                  idx < order.items.length - 1 ? '1px dashed #e5e7eb' : 'none',
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500, color: '#111827' }}
                              >
                                {item.name} × {item.quantity}
                              </Typography>
                              {item.spiceLevel && (
                                <Typography
                                  variant="caption"
                                  sx={{ color: '#6B7280', fontSize: '12px' }}
                                >
                                  Spice: {item.spiceLevel}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
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
