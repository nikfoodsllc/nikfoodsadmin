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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  SelectChangeEvent,
  useTheme,
} from '@mui/material';
import { IconRefresh, IconDownload, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPSTDate } from '@/utils/timezone';
import { OrderStatus } from '@/types/order';
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
  ecoContainerPrice: number;
  orderStatus: OrderStatus;
  hasCombo?: boolean;
  isComboSelection?: boolean;
  comboSectionTitle?: string;
  comboItemName?: string;
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
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([]);
  const theme = useTheme();

  // Order status options with display labels
  const statusOptions: { value: OrderStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

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
      
      // Add status filter if any statuses are selected
      if (selectedStatuses.length > 0) {
        params.append('status', selectedStatuses.join(','));
      }

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
  }, [dateRange, token, selectedStatuses]);

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

  const handleStatusChange = (event: SelectChangeEvent<typeof selectedStatuses>) => {
    const value = event.target.value;
    setSelectedStatuses(
      typeof value === 'string' ? value.split(',') as OrderStatus[] : value
    );
  };

  const getStatusLabel = (status: OrderStatus): string => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.label || status;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, set to ascending by default
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedItems = () => {
    if (!reportData || !reportData.items) return [];
    
    const items = [...reportData.items];
    
    if (!sortField) return items;
    
    return items.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case 'orderId':
          aVal = a.orderId;
          bVal = b.orderId;
          break;
        case 'orderDate':
          aVal = new Date(a.orderDate).getTime();
          bVal = new Date(b.orderDate).getTime();
          break;
        case 'deliveryDate':
          aVal = new Date(a.deliveryDate).getTime();
          bVal = new Date(b.deliveryDate).getTime();
          break;
        case 'customerName':
          aVal = a.customerName.toLowerCase();
          bVal = b.customerName.toLowerCase();
          break;
        case 'itemName':
          aVal = a.itemName.toLowerCase();
          bVal = b.itemName.toLowerCase();
          break;
        case 'portionQuantity':
          aVal = a.portionQuantity || '';
          bVal = b.portionQuantity || '';
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case 'spiceLevel':
          aVal = a.spiceLevel || '';
          bVal = b.spiceLevel || '';
          break;
        case 'itemPrice':
          aVal = a.itemPrice;
          bVal = b.itemPrice;
          break;
        case 'ecoContainer':
          aVal = a.ecoContainer ? 1 : 0;
          bVal = b.ecoContainer ? 1 : 0;
          break;
        case 'orderStatus':
          aVal = getStatusLabel(a.orderStatus).toLowerCase();
          bVal = getStatusLabel(b.orderStatus).toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <IconArrowUp size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
    ) : (
      <IconArrowDown size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const extractPortionQuantity = (portionQuantity: string): number => {
    if (!portionQuantity) return 0;
    // Extract numeric value from portion quantity (e.g., '12Oz' -> 12, 'Full' -> 1)
    const match = portionQuantity.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };

  const calculateItemTotalPrice = (item: OrderedItem): number => {
    // For combo selections, the itemPrice is the full combo price
    // The total should be combo price * quantity
    return item.itemPrice * item.quantity;
  };

  const calculateEcoContainerTotalPrice = (item: OrderedItem): number => {
    // Only show eco container price for the first combo selection row
    // to avoid duplicate eco container charges
    if (item.isComboSelection) {
      // Only show eco container price for non-combo items or first selection
      return item.ecoContainer ? item.ecoContainerPrice * item.quantity : 0;
    }
    return item.ecoContainer ? item.ecoContainerPrice * item.quantity : 0;
  };

  const calculateTotalOrderedQty = (portionQuantity: string, quantity: number): number => {
    const portionQty = extractPortionQuantity(portionQuantity);
    return portionQty * quantity;
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.items || reportData.items.length === 0) return;

    // CSV Headers
    const headers = [
      'Order ID',
      'Order Date',
      'Delivery Date',
      'Order Status',
      'Customer Name',
      'Item Name',
      'Portion Quantity',
      'Quantity',
      'Spice Level',
      'Item Price',
      'Eco Container Selected',
      'Eco Container Price',
      'Sub Total',
      'Total Ordered Qty',
    ];

    // Convert items to CSV rows
    const csvRows = reportData.items.map(item => {
      const row = [
        item.orderId,
        formatPSTDate(item.orderDate.toString()),
        formatPSTDate(item.deliveryDate.toString()),
        getStatusLabel(item.orderStatus),
        item.customerName,
        item.itemName,
        item.portionQuantity,
        item.quantity.toString(),
        item.spiceLevel,
        formatCurrency(item.itemPrice),
        item.ecoContainer ? 'Yes' : 'No',
        formatCurrency(item.ecoContainerPrice),
        formatCurrency(calculateItemTotalPrice(item)),
        calculateTotalOrderedQty(item.portionQuantity, item.quantity).toString(),
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
              Order Status
            </Typography>
            <FormControl sx={{ minWidth: 200 }} size="small">
              <InputLabel id="status-filter-label">Filter by Status</InputLabel>
              <Select
                labelId="status-filter-label"
                multiple
                value={selectedStatuses}
                onChange={handleStatusChange}
                input={<OutlinedInput label="Filter by Status" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={getStatusLabel(value)} 
                        size="small"
                        sx={{ 
                          height: 22, 
                          fontSize: '11px',
                          backgroundColor: theme.palette.primary.main,
                          color: '#fff',
                        }}
                      />
                    ))}
                  </Box>
                )}
                sx={{
                  backgroundColor: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#E5E7EB',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4F8CFF',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
                    <TableCell 
                      onClick={() => handleSort('orderId')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Order ID{renderSortIcon('orderId')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('orderDate')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Order Date{renderSortIcon('orderDate')}
                    </TableCell>
                    <TableCell
                      onClick={() => handleSort('deliveryDate')}
                      sx={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#374151',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Delivery Date{renderSortIcon('deliveryDate')}
                    </TableCell>
                    <TableCell
                      onClick={() => handleSort('orderStatus')}
                      sx={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#374151',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Order Status{renderSortIcon('orderStatus')}
                    </TableCell>
                    <TableCell
                      onClick={() => handleSort('customerName')}
                      sx={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#374151',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Customer Name{renderSortIcon('customerName')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('itemName')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Item Name{renderSortIcon('itemName')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('portionQuantity')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Portion{renderSortIcon('portionQuantity')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('quantity')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Quantity{renderSortIcon('quantity')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('spiceLevel')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Spice Level{renderSortIcon('spiceLevel')}
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSort('itemPrice')}
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': {
                          backgroundColor: '#E5E7EB',
                        },
                      }}
                    >
                      Price{renderSortIcon('itemPrice')}
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Eco Container Price
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Sub Total
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        color: '#374151', 
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Total Ordered Qty
                    </TableCell>

                  </TableRow>
                </TableHead>
                <TableBody>
                  {getSortedItems().map((item, index) => (
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
                      <TableCell sx={{ fontSize: '13px', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <Chip
                          label={getStatusLabel(item.orderStatus)}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor:
                              item.orderStatus === 'pending' ? '#FEF3C7' :
                              item.orderStatus === 'confirmed' ? '#DBEAFE' :
                              item.orderStatus === 'preparing' ? '#FED7AA' :
                              item.orderStatus === 'ready' ? '#D1FAE5' :
                              item.orderStatus === 'out_for_delivery' ? '#E0E7FF' :
                              item.orderStatus === 'delivered' ? '#D1FAE5' :
                              item.orderStatus === 'cancelled' ? '#FEE2E2' : '#F3F4F6',
                            color:
                              item.orderStatus === 'pending' ? '#92400E' :
                              item.orderStatus === 'confirmed' ? '#1E40AF' :
                              item.orderStatus === 'preparing' ? '#C2410C' :
                              item.orderStatus === 'ready' ? '#065F46' :
                              item.orderStatus === 'out_for_delivery' ? '#3730A3' :
                              item.orderStatus === 'delivered' ? '#065F46' :
                              item.orderStatus === 'cancelled' ? '#991B1B' : '#4B5563',
                          }}
                        />
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
                      <TableCell sx={{ fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {item.ecoContainer ? formatCurrency(item.ecoContainerPrice) : '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatCurrency(calculateItemTotalPrice(item))}
                      </TableCell>
                      <TableCell sx={{ fontSize: '13px', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {calculateTotalOrderedQty(item.portionQuantity, item.quantity)}
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
