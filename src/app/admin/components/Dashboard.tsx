'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Stack, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
  IconToolsKitchen2,
  IconCategory,
  IconShoppingCart,
  IconCircleCheck,
  IconClock,
  IconRefresh,
  IconChartBar,
  IconUsers,
  IconCreditCard,
  IconCash,
  IconWallet,
} from '@tabler/icons-react';
import StatCard from './StatCard';
import DateRangeSelector, { defaultDateRange } from './DateRangeSelector';
import DashboardSkeleton from './DashboardSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDate, formatPSTDateTime } from '@/utils/timezone';

interface TopItem {
  itemId: string;
  itemName: string;
  totalOrders: number;
  totalQuantity: number;
  revenue: number;
}

interface StatusBreakdown {
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
}

interface PaymentMethodBreakdown {
  creditCard: {
    count: number;
    revenue: number;
  };
  cashOnDelivery: {
    count: number;
    revenue: number;
  };
  walletsAndBank: {
    count: number;
    revenue: number;
  };
}

interface AdminStats {
  // Existing metrics
  totalOrders: number;
  completedOrders: number;
  upcomingOrders: number;
  totalOrdersChange: number;
  completedOrdersChange: number;
  revenueChange: number;
  revenueInRange: number;
  todayRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  totalFoodItems: number;
  totalCategories: number;

  // New metrics
  averageOrderValue: number;
  averageOrderValueChange: number;
  statusBreakdown: StatusBreakdown;
  topSellingItems: TopItem[];
  newCustomers: number;
  paymentMethodBreakdown: PaymentMethodBreakdown;
  activeFoodItems: number;

  dateRange: {
    startDate: string;
    endDate: string;
  };
  lastUpdated: string;
}

// Helper function to validate date objects
const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

export default function Dashboard() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState(defaultDateRange);

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

  const fetchStats = useCallback(async () => {
    try {
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Validate date objects before making API call
      if (!isValidDate(dateRange.startDate) || !isValidDate(dateRange.endDate)) {
        console.error('Invalid date objects in dateRange:', dateRange);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      const response = await fetch(`/api/admin/stats?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      // Direct state updates without startTransition/unstable_batchedUpdates
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      // Ensure loading states are always updated
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleDateRangeChange = (newRange: typeof dateRange) => {
    // Validate the new date range before updating state
    if (!isValidDate(newRange.startDate) || !isValidDate(newRange.endDate)) {
      console.error('Invalid date range provided to handleDateRangeChange:', newRange);
      return;
    }

    // Direct state update without startTransition/unstable_batchedUpdates
    setDateRange(newRange);
    setLoading(true);
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    // Use safeFormatCurrency with 0 decimal places for dashboard display
    return safeFormatCurrency(value, { decimals: 0 });
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!stats) {
    return (
      <Box sx={{ textAlign: 'center', paddingY: 8 }}>
        <Typography variant="h6" color="text.secondary">
          Failed to load dashboard data
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px' }}>
          Dashboard Overview
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
          <Tooltip title="Refresh data">
            <IconButton
              onClick={handleRefresh}
              disabled={refreshing}
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

      {/* Platform Statistics */}
      <Box sx={{ marginBottom: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
        >
          Platform Statistics
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          <StatCard
            title="Total Food Items"
            value={stats.totalFoodItems}
            icon={IconToolsKitchen2}
            iconColor="#4F8CFF"
            iconBgColor="#E6F0FF"
          />
          <StatCard
            title="Active Food Items"
            value={stats.activeFoodItems}
            icon={IconToolsKitchen2}
            iconColor="#5FD068"
            iconBgColor="#EBFBEF"
          />
          <StatCard
            title="Food Categories"
            value={stats.totalCategories}
            icon={IconCategory}
            iconColor="#FFB84F"
            iconBgColor="#FFF5E6"
          />
        </Stack>
      </Box>

      {/* Order Statistics */}
      <Box sx={{ marginBottom: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
        >
          Order Statistics
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          <StatCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={IconShoppingCart}
            iconColor="#5FD068"
            iconBgColor="#EBFBEF"
            trend={stats.totalOrdersChange}
          />
          <StatCard
            title="Completed Orders"
            value={stats.completedOrders}
            icon={IconCircleCheck}
            iconColor="#00B894"
            iconBgColor="#E5FAF4"
            trend={stats.completedOrdersChange}
          />
          <StatCard
            title="Upcoming Orders"
            value={stats.upcomingOrders}
            icon={IconClock}
            iconColor="#FF7675"
            iconBgColor="#FFF0F0"
          />
        </Stack>
      </Box>

      {/* Revenue Metrics */}
      <Box sx={{ marginBottom: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
        >
          Revenue Metrics
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}
        >
          <StatCard
            title="Revenue (Period)"
            value={formatCurrency(stats.revenueInRange)}
            icon={IconShoppingCart}
            iconColor="#6C5CE7"
            iconBgColor="#F0EEFF"
            trend={stats.revenueChange}
          />
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(stats.todayRevenue)}
            icon={IconShoppingCart}
            iconColor="#FF9F43"
            iconBgColor="#FFF5E6"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(stats.monthlyRevenue)}
            icon={IconShoppingCart}
            iconColor="#1DD1A1"
            iconBgColor="#E6FBF5"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={IconShoppingCart}
            iconColor="#5758BB"
            iconBgColor="#F0EEFF"
          />
        </Stack>
      </Box>

      {/* Additional Insights */}
      <Box sx={{ marginBottom: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
        >
          Customer & Order Insights
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          }}
        >
          <StatCard
            title="Average Order Value"
            value={formatCurrency(stats.averageOrderValue)}
            icon={IconChartBar}
            iconColor="#8E44AD"
            iconBgColor="#F4ECFC"
            trend={stats.averageOrderValueChange}
          />
          <StatCard
            title="New Customers"
            value={stats.newCustomers}
            icon={IconUsers}
            iconColor="#E74C3C"
            iconBgColor="#FDEDEC"
          />
        </Stack>
      </Box>

      {/* Top Selling Items */}
      {stats.topSellingItems && stats.topSellingItems.length > 0 && (
        <Box sx={{ marginBottom: 4 }}>
          <Typography
            variant="h6"
            sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
          >
            Top Selling Items
          </Typography>
          <Box
            sx={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#fff',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
                padding: '12px 16px',
                backgroundColor: '#f5f5f5',
                fontWeight: 600,
                fontSize: '13px',
                color: '#666',
                borderBottom: '1px solid #e0e0e0',
              }}
            >
              <Box>Item Name</Box>
              <Box sx={{ textAlign: 'center' }}>Orders</Box>
              <Box sx={{ textAlign: 'center' }}>Quantity</Box>
              <Box sx={{ textAlign: 'right' }}>Revenue</Box>
            </Box>
            {stats.topSellingItems.map((item, index) => (
              <Box
                key={item.itemId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
                  padding: '14px 16px',
                  borderBottom: index < stats.topSellingItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                  '&:hover': {
                    backgroundColor: '#fafafa',
                  },
                }}
              >
                <Box sx={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>
                  {item.itemName}
                </Box>
                <Box sx={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
                  {item.totalOrders}
                </Box>
                <Box sx={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
                  {item.totalQuantity}
                </Box>
                <Box sx={{ textAlign: 'right', fontSize: '14px', color: '#5FD068', fontWeight: 600 }}>
                  {formatCurrency(item.revenue)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Payment Method Breakdown */}
      <Box sx={{ marginBottom: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
        >
          Payment Methods
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          }}
        >
          <Box
            sx={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#E6F0FF',
                }}
              >
                <IconCreditCard size={20} color="#4F8CFF" />
              </Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#666' }}>
                Credit Card
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#333', marginBottom: 0.5 }}>
              {formatCurrency(stats.paymentMethodBreakdown.creditCard.revenue)}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#999' }}>
              {stats.paymentMethodBreakdown.creditCard.count} orders
            </Typography>
          </Box>

          <Box
            sx={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F3EBFF',
                }}
              >
                <IconWallet size={20} color="#8B5CF6" />
              </Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#666' }}>
                Apple Pay, Google Pay &amp; Bank
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#333', marginBottom: 0.5 }}>
              {formatCurrency(stats.paymentMethodBreakdown.walletsAndBank?.revenue ?? 0)}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#999' }}>
              {stats.paymentMethodBreakdown.walletsAndBank?.count ?? 0} orders
            </Typography>
          </Box>

          <Box
            sx={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#EBFBEF',
                }}
              >
                <IconCash size={20} color="#5FD068" />
              </Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#666' }}>
                Cash on Delivery
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#333', marginBottom: 0.5 }}>
              {formatCurrency(stats.paymentMethodBreakdown.cashOnDelivery.revenue)}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#999' }}>
              {stats.paymentMethodBreakdown.cashOnDelivery.count} orders
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Status Breakdown */}
      <Box sx={{ marginBottom: 4 }}>
        <Typography
          variant="h6"
          sx={{ fontSize: '17px', fontWeight: 600, marginBottom: 2, color: '#333' }}
        >
          Order Status Breakdown
        </Typography>
        <Box
          sx={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}
        >
          <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
            {[
              { label: 'Pending', value: stats.statusBreakdown.pending, color: '#FFB84F', bgColor: '#FFF5E6' },
              { label: 'Confirmed', value: stats.statusBreakdown.confirmed, color: '#4F8CFF', bgColor: '#E6F0FF' },
              { label: 'Preparing', value: stats.statusBreakdown.preparing, color: '#8E44AD', bgColor: '#F4ECFC' },
              { label: 'Ready', value: stats.statusBreakdown.ready, color: '#1DD1A1', bgColor: '#E6FBF5' },
              { label: 'Out for Delivery', value: stats.statusBreakdown.out_for_delivery, color: '#6C5CE7', bgColor: '#F0EEFF' },
              { label: 'Delivered', value: stats.statusBreakdown.delivered, color: '#5FD068', bgColor: '#EBFBEF' },
              { label: 'Cancelled', value: stats.statusBreakdown.cancelled, color: '#FF7675', bgColor: '#FFF0F0' },
            ].map((status, index) => (
              <Box
                key={status.label}
                sx={{
                  flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' },
                  padding: '20px',
                  borderRight: { xs: 'none', md: index < 3 ? '1px solid #f0f0f0' : 'none' },
                  borderBottom: { xs: index < 6 ? '1px solid #f0f0f0' : 'none', md: index < 4 ? '1px solid #f0f0f0' : 'none' },
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: status.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Typography sx={{ fontSize: '18px', fontWeight: 700, color: status.color }}>
                    {status.value}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '13px', color: '#666', fontWeight: 500 }}>
                  {status.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Footer Info */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
          paddingTop: 3,
          borderTop: '1px solid #e0e0e0',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: '#666', fontSize: '13px' }}>
          Showing data from{' '}
          <strong>{formatPSTDate(stats.dateRange.startDate)}</strong> to{' '}
          <strong>{formatPSTDate(stats.dateRange.endDate)}</strong>
        </Typography>
        <Typography variant="body2" sx={{ color: '#999', fontSize: '12px' }}>
          Last updated: {formatPSTDateTime(stats.lastUpdated)}
        </Typography>
      </Box>

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
