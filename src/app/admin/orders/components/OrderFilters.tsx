'use client';

import { Box, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment, Button } from '@mui/material';
import { IconSearch, IconFilterOff } from '@tabler/icons-react';
import { OPTIMO_FILTER_OPTIONS } from '@/utils/orderOptimoView';

interface OrderFiltersProps {
  searchValue: string;
  selectedStatus: string;
  selectedPaymentStatus: string;
  selectedPaymentMethod: string;
  selectedOptimo: string;
  selectedRescheduled: string;
  startDate: string;
  endDate: string;
  sortBy: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPaymentStatusChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onOptimoChange: (value: string) => void;
  onRescheduledChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onClearFilters: () => void;
}

export default function OrderFilters({
  searchValue,
  selectedStatus,
  selectedPaymentStatus,
  selectedPaymentMethod,
  selectedOptimo,
  selectedRescheduled,
  startDate,
  endDate,
  sortBy,
  onSearchChange,
  onStatusChange,
  onPaymentStatusChange,
  onPaymentMethodChange,
  onOptimoChange,
  onRescheduledChange,
  onStartDateChange,
  onEndDateChange,
  onSortByChange,
  onClearFilters,
}: OrderFiltersProps) {
  const hasActiveFilters =
    searchValue ||
    selectedStatus !== 'all' ||
    selectedPaymentStatus !== 'all' ||
    selectedPaymentMethod !== 'all' ||
    selectedOptimo !== 'all' ||
    selectedRescheduled !== 'all' ||
    startDate ||
    endDate ||
    sortBy !== 'date_desc';

  return (
    <Box>
      {/* First Row: Search and Clear Filters */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          marginBottom: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder="Search by Order ID, Name, Email..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          sx={{
            flex: 1,
            minWidth: 300,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={20} color="#666" />
              </InputAdornment>
            ),
          }}
        />

        {hasActiveFilters && (
          <Button
            variant="outlined"
            startIcon={<IconFilterOff size={18} />}
            onClick={onClearFilters}
            sx={{
              textTransform: 'none',
              borderColor: '#E5E7EB',
              color: '#6B7280',
              '&:hover': {
                borderColor: '#4F8CFF',
                backgroundColor: '#F6FAFF',
              },
            }}
          >
            Clear All Filters
          </Button>
        )}
      </Box>

      {/* Second Row: Filters */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {/* Order Status Filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Order Status</InputLabel>
          <Select
            value={selectedStatus}
            label="Order Status"
            onChange={(e) => onStatusChange(e.target.value)}
            sx={{ backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="preparing">Preparing</MenuItem>
            <MenuItem value="ready">Ready</MenuItem>
            <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        {/* Payment Status Filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Payment Status</InputLabel>
          <Select
            value={selectedPaymentStatus}
            label="Payment Status"
            onChange={(e) => onPaymentStatusChange(e.target.value)}
            sx={{ backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="unpaid">Unpaid</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="partially_refunded">Partially refunded</MenuItem>
            <MenuItem value="refunded">Refunded</MenuItem>
          </Select>
        </FormControl>

        {/* Payment Method Filter */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Payment Method</InputLabel>
          <Select
            value={selectedPaymentMethod}
            label="Payment Method"
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            sx={{ backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All Methods</MenuItem>
            <MenuItem value="Credit Card">Credit Card</MenuItem>
            <MenuItem value="Apple Pay">Apple Pay</MenuItem>
            <MenuItem value="Google Pay">Google Pay</MenuItem>
            <MenuItem value="Bank">Bank</MenuItem>
            <MenuItem value="Link">Link</MenuItem>
            <MenuItem value="Klarna">Klarna</MenuItem>
            <MenuItem value="Zelle">Zelle</MenuItem>
            <MenuItem value="Other">Other</MenuItem>
            <MenuItem value="Cash on Delivery">Cash on Delivery</MenuItem>
          </Select>
        </FormControl>

        {/* OptimoRoute Filter (is the delivery stop in the route planner) */}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>OptimoRoute</InputLabel>
          <Select
            value={selectedOptimo}
            label="OptimoRoute"
            onChange={(e) => onOptimoChange(e.target.value)}
            sx={{ backgroundColor: '#fff' }}
          >
            {OPTIMO_FILTER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.value === 'all' ? 'All' : option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Rescheduled Filter (an admin moved the delivery date) */}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Rescheduled</InputLabel>
          <Select
            value={selectedRescheduled}
            label="Rescheduled"
            onChange={(e) => onRescheduledChange(e.target.value)}
            sx={{ backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="yes">Rescheduled</MenuItem>
            <MenuItem value="no">Not rescheduled</MenuItem>
          </Select>
        </FormControl>

        {/* Start Date */}
        <TextField
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{
            minWidth: 160,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
        />

        {/* End Date */}
        <TextField
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          sx={{
            minWidth: 160,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
        />

        {/* Sort By */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortBy}
            label="Sort By"
            onChange={(e) => onSortByChange(e.target.value)}
            sx={{ backgroundColor: '#fff' }}
          >
            <MenuItem value="date_desc">Latest First</MenuItem>
            <MenuItem value="date_asc">Oldest First</MenuItem>
            <MenuItem value="amount_desc">Amount: High to Low</MenuItem>
            <MenuItem value="amount_asc">Amount: Low to High</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
