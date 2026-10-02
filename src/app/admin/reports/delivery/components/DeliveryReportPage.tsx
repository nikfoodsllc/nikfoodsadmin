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
  Collapse,
  Chip,
} from '@mui/material';
import { IconRefresh, IconChevronDown, IconChevronUp, IconMapPin, IconPhone, IconPackage, IconDownload } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { OrderDayItem, AddressSnapshot, OrderDay } from '@/types/order';
import { formatPSTDate, formatPSTTime } from '@/utils/timezone';
import { buildDeliveryDateColumnsBySpec, collectDeliveryDateColumns } from '@/utils/delivery';
import { escapeCSVValue } from '@/utils/csv';

interface DeliveryOrder {
  orderId: string;
  orderDate: string | Date;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  address: AddressSnapshot;
  allOrderDays?: OrderDay[];
  items: OrderDayItem[]; // Use full OrderDayItem type
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  tip: number;
  totalPaid: number;
  deliveryMessages?: string[];
  deliveryDay?: string;
}

interface DeliveryReportData {
  deliveryDate: string;
  orders: DeliveryOrder[];
  summary: {
    totalOrders: number;
    totalItems: number;
    totalRevenue: number;
  };
}

interface ExpandedState {
  [orderId: string]: boolean;
}

export default function DeliveryReportPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [reportData, setReportData] = useState<DeliveryReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<ExpandedState>({});
  const [groupByLocation, setGroupByLocation] = useState(true);

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

  // Fetch delivery report data
  const fetchDeliveryReport = useCallback(async () => {
    if (!selectedDate) {
      setReportData(null);
      return;
    }

    try {
      setLoading(true);
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      params.append('date', selectedDate);

      const response = await fetch(`/api/admin/reports/delivery?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch delivery report');
      }

      const result = await response.json();
      setReportData(result.data);
    } catch (error) {
      console.error('Error fetching delivery report:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to load delivery report', 'error');
      setReportData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, token]);

  // Auto-load today's data on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // Fetch report when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchDeliveryReport();
    }
  }, [fetchDeliveryReport]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeliveryReport();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setExpandedOrders({});
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const exportToCSV = () => {
    if (!reportData || !reportData.orders) return;

    const MAX_ITEMS = 10;
    const orderDayRecords = reportData.orders.map(({ allOrderDays }) => ({ allOrderDays }));
    const deliveryDateColumnSpecs = collectDeliveryDateColumns(orderDayRecords);

    // CSV Headers
    const headers = [
      // Order Info
      'Order ID',
      'Order Date',
      'Order Time',
      'Delivery Day',
    ];

    for (const column of deliveryDateColumnSpecs) {
      headers.push(column.header);
    }

    headers.push(
      'Status',
      'Payment Status',
      'Payment Method',
      // Customer Info
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      // Address
      'Street',
      'Apartment',
      'City',
      'State',
      'Zip Code',
      'Gate Code',
      'Delivery Instructions',
      'Landmark',
    );

    // Add item columns for each position
    for (let i = 1; i <= MAX_ITEMS; i++) {
      headers.push(
        `Item ${i} Name`,
        `Item ${i} Quantity`,
        `Item ${i} Price`,
        `Item ${i} Spice Level`,
        `Item ${i} Portion`,
        `Item ${i} Eco Container`,
        `Item ${i} Eco Charge`,
        `Item ${i} Notes`,
        `Item ${i} Combo Selections`
      );
    }

    // Pricing
    headers.push(
      'Subtotal',
      'Delivery Fee',
      'Eco Container Charges',
      'Tip',
      'Total'
    );

    // Delivery Messages
    headers.push('Delivery Messages');

    // Convert orders to CSV rows
    const csvRows = reportData.orders.map(order => {
      const row = [];

      // Order Info
      row.push(order.orderId);
      row.push(formatPSTDate(order.orderDate.toString()));
      row.push(formatPSTTime(order.orderDate));
      row.push('');
      row.push(...buildDeliveryDateColumnsBySpec({ allOrderDays: order.allOrderDays }, deliveryDateColumnSpecs));
      row.push(order.status);
      row.push(order.paymentStatus);
      row.push(order.paymentMethod);

      // Customer Info
      row.push(order.customerInfo.name);
      row.push(order.customerInfo.email);
      row.push(order.customerInfo.phone);

      // Address
      row.push(order.address.street);
      row.push(order.address.apartment || '');
      row.push(order.address.city);
      row.push(order.address.state);
      row.push(order.address.zipCode);
      row.push(order.address.entrance || '');
      row.push(order.address.floor || '');
      row.push(order.address.landmark || '');

      // Items - fill up to MAX_ITEMS
      for (let i = 0; i < MAX_ITEMS; i++) {
        const item = order.items[i];
        if (item) {
          row.push(item.food.name || '');
          row.push(item.quantity.toString());
          row.push(formatCurrency(item.price));
          row.push(item.spiceLevel || '');
          row.push(item.selectedPortion || (item.food.portions?.[item.portions || 0]) || '');
          row.push(item.isEcoFriendlyContainer ? 'Yes' : 'No');
          row.push(item.ecoContainerCharge ? formatCurrency(item.ecoContainerCharge) : '');
          row.push(item.notes || '');

          // Format combo selections
          if (item.comboSelections && item.food.sections) {
            const comboText = item.food.sections
              .map(section => {
                const selectedItemIds = item.comboSelections![section._id] || [];
                const selectedItems = section.selectedItems.filter(si =>
                  selectedItemIds.includes(si._id)
                );
                if (selectedItems.length === 0) return '';
                return `${section.title}: ${selectedItems.map(si => si.item.name).join(', ')}`;
              })
              .filter(Boolean)
              .join(' | ');
            row.push(comboText);
          } else {
            row.push('');
          }
        } else {
          // Empty columns for unused item positions
          for (let j = 0; j < 9; j++) {
            row.push('');
          }
        }
      }

      // Calculate eco charges
      const totalEcoCharges = order.items.reduce((sum, item) =>
        sum + (item.ecoContainerCharge || 0) * item.quantity, 0
      );

      // Pricing
      row.push(formatCurrency(order.subtotal));
      row.push(formatCurrency(order.deliveryFee));
      row.push(formatCurrency(totalEcoCharges));
      row.push(formatCurrency(order.tip));
      row.push(formatCurrency(order.totalPaid));

      // Delivery Messages
      row.push(order.deliveryMessages ? order.deliveryMessages.join('; ') : '');

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
      headers.map(escapeCSVValue).join(','),
      ...csvRows
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const dateStr = selectedDate || formatPSTDate(new Date().toISOString());
    link.setAttribute('href', url);
    link.setAttribute('download', `delivery-report-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSnackbar('CSV exported successfully!', 'success');
  };

  // Group orders by location (city-state-zip)
  const groupOrdersByLocation = (orders: DeliveryOrder[]) => {
    const grouped: Record<string, DeliveryOrder[]> = {};

    orders.forEach((order) => {
      const key = `${order.address.city}, ${order.address.state} ${order.address.zipCode}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(order);
    });

    return grouped;
  };

  const renderAddress = (address: AddressSnapshot) => {
    return (
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
          <IconMapPin size={16} style={{ marginTop: '3px', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: '#374151', fontSize: '13px' }}>
            {address.street}
            {address.apartment && `, ${address.apartment}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2.5, mb: 0.5 }}>
          <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
            {address.city}, {address.state} {address.zipCode}
          </Typography>
        </Box>
        {address.entrance && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2.5, mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
              Gate Code: {address.entrance}
            </Typography>
          </Box>
        )}
        {address.floor && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2.5, mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
              Delivery instructions: {address.floor}
            </Typography>
          </Box>
        )}
        {address.landmark && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2.5 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
              Landmark: {address.landmark}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  const renderItems = (items: OrderDayItem[]) => {
    return (
      <Box sx={{ mt: 1 }}>
        {items.map((item, idx) => (
          <Box
            key={`${item.food._id}-${idx}`}
            sx={{
              pb: idx < items.length - 1 ? 1 : 0,
              mb: idx < items.length - 1 ? 1 : 0,
              borderBottom: idx < items.length - 1 ? '1px dashed #e5e7eb' : 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <IconPackage size={16} style={{ marginTop: '2px', color: '#6B7280', flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                {/* Item name with veg indicator */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  {/* Veg indicator */}
                  {item.food.veg !== undefined && (
                    <Box sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: item.food.veg ? '#10B981' : '#EF4444',
                      border: '2px solid',
                      borderColor: item.food.veg ? '#10B981' : '#EF4444',
                      flexShrink: 0,
                    }} />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827', fontSize: '13px' }}>
                    {item.food.name}
                  </Typography>
                  <Chip
                    label={`× ${item.quantity}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '11px',
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                      fontWeight: 600,
                    }}
                  />
                  {item.isEcoFriendlyContainer && (
                    <Chip
                      label="🌱 Eco Container"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '11px',
                        backgroundColor: '#D1FAE5',
                        color: '#065F46',
                        fontWeight: 600,
                      }}
                    />
                  )}
                </Box>

                {/* Description */}
                {item.food.description && (
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', display: 'block', fontStyle: 'italic', ml: 3.25 }}>
                    {item.food.description}
                  </Typography>
                )}

                {/* Customizations */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5, ml: 3.25 }}>
                  {item.spiceLevel && (
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                      Spice: {item.spiceLevel}
                    </Typography>
                  )}
                  {(item.selectedPortion || item.portions !== undefined) && (
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                      Portion: {item.selectedPortion || (item.food.portions?.[item.portions || 0]) || `#${item.portions}`}
                    </Typography>
                  )}
                  {item.isEcoFriendlyContainer && item.ecoContainerCharge && (
                    <Typography variant="caption" sx={{ color: '#059669', fontWeight: 500, fontSize: '12px' }}>
                      +{formatCurrency(item.ecoContainerCharge)} per item
                    </Typography>
                  )}
                </Box>

                {/* Combo selections */}
                {item.comboSelections && Object.keys(item.comboSelections).length > 0 && item.food.sections && (
                  <Box sx={{ ml: 3.25, mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', fontWeight: 500 }}>
                      Combo Selections:
                    </Typography>
                    {item.food.sections.map(section => {
                      const selectedItemIds = item.comboSelections![section._id] || [];
                      const selectedItems = section.selectedItems.filter(si =>
                        selectedItemIds.includes(si._id)
                      );
                      if (selectedItems.length === 0) return null;

                      return (
                        <Box key={section._id} sx={{ ml: 1 }}>
                          <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                            {section.title}:
                          </Typography>
                          {selectedItems.map(si => (
                            <Typography key={si._id} variant="caption" sx={{ display: 'block', ml: 1, color: '#374151', fontSize: '12px' }}>
                              • {si.item.name} {si.portion && `(${si.portion})`}
                            </Typography>
                          ))}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* Customer notes */}
                {item.notes && (
                  <Box sx={{ ml: 3.25, mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px', fontStyle: 'italic' }}>
                      Note: {item.notes}
                    </Typography>
                  </Box>
                )}

                {/* Item total */}
                <Box sx={{ mt: 0.5, ml: 3.25 }}>
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                    Price: {formatCurrency(item.price)} × {item.quantity}
                    {item.isEcoFriendlyContainer && item.ecoContainerCharge && (
                      <> + Eco ({formatCurrency(item.ecoContainerCharge)} × {item.quantity})</>
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', fontSize: '13px', ml: 0.5 }}>
                    = {formatCurrency(item.price * item.quantity + (item.ecoContainerCharge || 0) * item.quantity)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  const renderOrderRow = (order: DeliveryOrder) => {
    const isExpanded = expandedOrders[order.orderId];

    return (
      <Box
        key={order.orderId}
        sx={{
          backgroundColor: '#fff',
          borderRadius: 2,
          mb: 2,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        {/* Main Row - Always Visible */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: '#f9fafb',
            },
          }}
          onClick={() => toggleOrderExpansion(order.orderId)}
        >
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>
                {order.orderId}
              </Typography>
              <Chip
                label={order.status.replace(/_/g, ' ')}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '11px',
                  backgroundColor: order.status === 'delivered' ? '#D1FAE5' : '#FEF3C7',
                  color: order.status === 'delivered' ? '#065F46' : '#92400E',
                  fontWeight: 600,
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>
                {order.customerInfo.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconPhone size={14} style={{ color: '#6B7280' }} />
                <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
                  {order.customerInfo.phone}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ flex: 1, minWidth: 250 }}>
            {renderAddress(order.address)}
          </Box>

          <Box sx={{ textAlign: 'right', minWidth: 120 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', fontSize: '15px' }}>
              {formatCurrency(order.totalPaid)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
              {order.items?.length || 0} items
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleOrderExpansion(order.orderId);
            }}
            sx={{
              ml: 1,
              backgroundColor: '#f3f4f6',
              '&:hover': {
                backgroundColor: '#e5e7eb',
              },
            }}
          >
            {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
          </IconButton>
        </Box>

        {/* Expanded Details */}
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box
            sx={{
              p: 2,
              pt: 0,
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            {/* Order Info */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', fontSize: '13px', mb: 1 }}>
                Order Information
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                    Order Date
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#111827', fontSize: '13px' }}>
                    {formatPSTDate(order.orderDate.toString())}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                    Order Time
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#111827', fontSize: '13px' }}>
                    {formatPSTTime(order.orderDate)}
                  </Typography>
                </Box>
                {order.deliveryDay && (
                  <Box>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                      Delivery Day
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#111827', fontSize: '13px' }}>
                      {order.deliveryDay}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                    Payment Method
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#111827', fontSize: '13px' }}>
                    {order.paymentMethod === 'Credit Card'
                      ? 'Card'
                      : order.paymentMethod === 'Cash on Delivery'
                        ? 'Cash on Delivery'
                        : order.paymentMethod}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                    Payment Status
                  </Typography>
                  <Chip
                    label={order.paymentStatus}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '11px',
                      backgroundColor: order.paymentStatus === 'paid' ? '#D1FAE5' : '#FEE2E2',
                      color: order.paymentStatus === 'paid' ? '#065F46' : '#991B1B',
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Items */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', fontSize: '13px', mb: 1 }}>
                Items to Deliver
              </Typography>
              {renderItems(order.items)}
            </Box>

            {/* Pricing Breakdown */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', fontSize: '13px', mb: 1 }}>
                Price Breakdown
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, backgroundColor: '#fff', p: 1.5, borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <Typography variant="body2" sx={{ color: '#6B7280' }}>Subtotal</Typography>
                  <Typography variant="body2" sx={{ color: '#111827' }}>{formatCurrency(order.subtotal)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <Typography variant="body2" sx={{ color: '#6B7280' }}>Delivery Fee</Typography>
                  <Typography variant="body2" sx={{ color: '#111827' }}>{formatCurrency(order.deliveryFee)}</Typography>
                </Box>
                {order.items.some(item => item.isEcoFriendlyContainer && item.ecoContainerCharge) && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <Typography variant="body2" sx={{ color: '#6B7280' }}>Eco Container Charges</Typography>
                    <Typography variant="body2" sx={{ color: '#111827' }}>
                      {formatCurrency(order.items.reduce((sum, item) =>
                        sum + (item.ecoContainerCharge || 0) * item.quantity, 0
                      ))}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <Typography variant="body2" sx={{ color: '#6B7280' }}>Tip</Typography>
                  <Typography variant="body2" sx={{ color: '#111827' }}>{formatCurrency(order.tip)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, pt: 0.5, borderTop: '1px solid #e5e7eb' }}>
                  <Typography variant="body2" sx={{ color: '#111827' }}>Total</Typography>
                  <Typography variant="body2" sx={{ color: '#4F46E5' }}>{formatCurrency(order.totalPaid)}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Delivery Messages */}
            {order.deliveryMessages && order.deliveryMessages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151', fontSize: '13px', mb: 1 }}>
                  Special Delivery Notes
                </Typography>
                <Box sx={{ backgroundColor: '#FFFBEB', p: 1.5, borderRadius: 1, border: '1px solid #FDE68A' }}>
                  {order.deliveryMessages.map((message, idx) => (
                    <Typography key={idx} variant="body2" sx={{ color: '#92400E', fontSize: '13px', mb: idx < order.deliveryMessages!.length - 1 ? 0.5 : 0 }}>
                      • {message}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    );
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
            Delivery Report
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', marginTop: 0.5 }}>
            View comprehensive delivery information by date
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
              Delivery Date
            </Typography>
            <TextField
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              size="small"
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: '#fff',
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setSelectedDate(today);
              }}
              disabled={loading || refreshing}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
              }}
            >
              Today
            </Button>
            <Tooltip title="Export to CSV">
              <Button
                variant="outlined"
                onClick={exportToCSV}
                disabled={loading || !reportData || !reportData.orders || reportData.orders.length === 0}
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
                disabled={refreshing || loading || !selectedDate}
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

        {selectedDate && (
          <Box sx={{ marginTop: 2 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '13px' }}>
              Showing deliveries for <strong>{formatPSTDate(selectedDate)}</strong>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Empty State */}
      {!loading && !selectedDate && (
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
            Select a Delivery Date
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Choose a date to view the delivery report
          </Typography>
        </Box>
      )}

      {/* Loading State */}
      {loading && selectedDate && (
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
            Loading delivery report...
          </Typography>
        </Box>
      )}

      {/* Report Content */}
      {!loading && selectedDate && reportData && (
        <Box>
          {/* Summary Cards */}
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
                Total Orders
              </Typography>
              <Typography variant="h4" sx={{ color: '#111827', fontWeight: 600, fontSize: '28px' }}>
                {reportData?.summary?.totalOrders ?? 0}
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
                Total Items
              </Typography>
              <Typography variant="h4" sx={{ color: '#111827', fontWeight: 600, fontSize: '28px' }}>
                {reportData?.summary?.totalItems ?? 0}
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
                {formatCurrency(reportData?.summary?.totalRevenue ?? 0)}
              </Typography>
            </Box>
          </Box>

          {/* No Data State */}
          {(!reportData.orders || reportData.orders.length === 0) ? (
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
                No Deliveries Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                There are no deliveries scheduled for {formatPSTDate(selectedDate)}
              </Typography>
            </Box>
          ) : (
            <>
              {/* Group by Location View */}
              {groupByLocation ? (
                <Box>
                  {reportData.orders && Object.entries(groupOrdersByLocation(reportData.orders)).map(([location, orders]) => (
                    <Box key={location} sx={{ mb: 3 }}>
                      <Box
                        sx={{
                          backgroundColor: '#EEF2FF',
                          padding: '12px 16px',
                          borderRadius: '8px 8px 0 0',
                          borderBottom: '2px solid #C7D2FE',
                        }}
                      >
                        <Typography variant="h6" sx={{ fontSize: '15px', fontWeight: 600, color: '#4338CA' }}>
                          📍 {location}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6366F1', fontSize: '12px' }}>
                          {orders.length} {orders.length === 1 ? 'delivery' : 'deliveries'}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 1 }}>
                        {orders.map((order) => renderOrderRow(order))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box>{reportData.orders?.map((order) => renderOrderRow(order)) ?? null}</Box>
              )}
            </>
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
