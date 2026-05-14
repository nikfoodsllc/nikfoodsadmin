'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import { CategoryDayWiseItem } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableDates } from '@/hooks/useAvailableDates';
import {
  formatDateLabel,
  formatDateShort,
  formatDateWithDay,
  isDateString,
  isDayName
} from '@/utils/days';
import { safeFormatCurrency } from '@/utils/currency';

interface FoodItem {
  _id: string;
  name: string;
  description?: string;
  veg: boolean;
  price: number;
}

interface DayWiseItemSelectorProps {
  value: CategoryDayWiseItem[];
  onChange: (dayWiseItems: CategoryDayWiseItem[]) => void;
  disabled?: boolean;
  categoryId?: string;
  categoryName?: string;
}

export default function DayWiseItemSelector({
  value,
  onChange,
  disabled = false,
  categoryId = '',
  categoryName = '',
}: DayWiseItemSelectorProps) {
  const { token, isAuthenticated } = useAuth();
  const { availableDates, loading: datesLoading, error: datesError } = useAvailableDates({
    dayWiseCategoryEnabledOnly: true
  });
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch food items on component mount (dates are handled by useAvailableDates hook)
  useEffect(() => {
    const fetchFoodItems = async () => {
      try {
        if (!token || !isAuthenticated) {
          setError('Authentication token not found');
          return;
        }

        const foodItemsResponse = await fetch('/api/admin/food-items?excludeDrafts=true&limit=10000', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!foodItemsResponse.ok) {
          throw new Error('Failed to fetch food items');
        }

        const foodItemsData = await foodItemsResponse.json();
        setFoodItems(foodItemsData.data?.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load food items');
      } finally {
        setLoading(false);
      }
    };

    fetchFoodItems();
  }, [token, isAuthenticated]);

  // Create date labels array for display
  const allDateLabels = useMemo(() => {
    // Sort dates by date and return formatted labels
    return availableDates
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(date => ({
        label: formatDateLabel(date.date),
        shortLabel: formatDateShort(date.date),
        displayLabel: formatDateWithDay(date.date),
        date: date.date,
        enabled: date.dayWiseCategoryEnabled
      }));
  }, [availableDates]);

  // Check if existing data uses old day-name format
  const hasLegacyDayFormat = useMemo(() => {
    return value.length > 0 && value.some(item => isDayName(item.day));
  }, [value]);

  // Sync value array with allDateLabels by matching day field
// remove old dates like Jan 28 automatically
useEffect(() => {

  if (allDateLabels.length === 0) return;

  const cleanedDayWiseItems: CategoryDayWiseItem[] =
    allDateLabels.map(dateInfo => {

      const existing = value.find(
        item => item.day === dateInfo.date
      );

      return {
        day: dateInfo.date,
        items: existing?.items || []
      };

    });

  onChange(cleanedDayWiseItems);

}, [allDateLabels]);

  const handleItemToggle = (dayIndex: number, itemId: string) => {
    const dateInfo = allDateLabels[dayIndex];
    if (!dateInfo) return;

    const newDayWiseItems = [...value];
    const dayEntryIndex = newDayWiseItems.findIndex(item => item.day === dateInfo.date);

    if (dayEntryIndex === -1) {
      // Create new entry for this date
      newDayWiseItems.push({
        day: dateInfo.date,
        items: [itemId]
      });
    } else {
      const dayItems = newDayWiseItems[dayEntryIndex].items;

      if (dayItems.includes(itemId)) {
        // Remove item from this day
        newDayWiseItems[dayEntryIndex].items = dayItems.filter(id => id !== itemId);
      } else {
        // Add item to this day
        newDayWiseItems[dayEntryIndex].items = [...dayItems, itemId];
      }
    }

    onChange(newDayWiseItems);
  };

  const handleClearAll = () => {
    const clearedDayWiseItems: CategoryDayWiseItem[] = allDateLabels.map(dateInfo => ({
      day: dateInfo.date,
      items: []
    }));
    onChange(clearedDayWiseItems);
  };

  const isItemSelectedForDay = (dayIndex: number, itemId: string) => {
    const dateInfo = allDateLabels[dayIndex];
    if (!dateInfo) return false;

    const dayEntry = value.find(item => item.day === dateInfo.date);
    return dayEntry?.items?.includes(itemId) || false;
  };

  const getSelectedItemsCount = (dayIndex: number) => {
    const dateInfo = allDateLabels[dayIndex];
    if (!dateInfo) return 0;

    const dayEntry = value.find(item => item.day === dateInfo.date);
    return dayEntry?.items?.length || 0;
  };

  if (!token || !isAuthenticated) {
    return (
      <Alert severity="error" sx={{ marginBottom: 2 }}>
        Authentication required. Please log in again.
      </Alert>
    );
  }

  // Show loading state while fetching initial data
  if (loading || (datesLoading && availableDates.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state if both food items and dates failed to load
  if (error && (!availableDates || availableDates.length === 0)) {
    return (
      <Alert severity="error" sx={{ marginBottom: 2 }}>
        {error}
      </Alert>
    );
  }

  // Show dates error if food items loaded but dates failed
  if (datesError && availableDates.length === 0) {
    return (
      <Alert severity="error" sx={{ marginBottom: 2 }}>
        {datesError}
      </Alert>
    );
  }

  // Show empty state if no dates are configured for day-wise categories
  if (availableDates.length === 0 && !datesLoading) {
    return (
      <Box sx={{ textAlign: 'center', padding: 4 }}>
        <Typography variant="h6" sx={{ color: '#666', marginBottom: 1 }}>
          No dates available for day-wise item assignment
        </Typography>
        <Typography variant="body2" sx={{ color: '#999' }}>
          Please configure dates in the Availability Calendar and enable "Day-wise Category" for at least one date.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
          Date-wise Item Assignment
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label="Clear All"
            onClick={handleClearAll}
            disabled={disabled}
            variant="outlined"
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'rgba(79, 140, 255, 0.04)',
              }
            }}
          />
        </Box>
      </Box>

      <Typography variant="body2" sx={{ color: '#666', marginBottom: 2 }}>
        Select items that will be available for each configured date. Items will only appear in the category on their assigned dates.
        Only dates with "Day-wise Category" enabled in the Availability Calendar are shown.
      </Typography>

      <Box sx={{ overflowX: 'auto' }}>
        <TableContainer
          component={Paper}
          sx={{
            boxShadow: 'none',
            border: '1px solid #E0E0E0',
            maxHeight: 500,     // 👈 height set karo
            overflowY: 'auto'   // 👈 vertical scroll enable
          }}
        >
          
          <Table stickyHeader aria-label="day-wise item assignment table">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    backgroundColor: '#F5F5F5',
                    minWidth: 200,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3
                  }}
                >
                  Food Item
                </TableCell>
                
                {allDateLabels.map((dateInfo, dateIndex) => (
                  <TableCell
                    key={dateInfo.date}
                    align="center"
                    sx={{
                      fontWeight: 600,
                      backgroundColor: '#F5F5F5',
                      minWidth: 100,
                    }}
                    >
                    
                    <Tooltip
                      title={dateInfo.label}
                      arrow
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: 'inherit',
                          }}
                        >
                          {dateInfo.displayLabel}
                        </Typography>
                        <Chip
                          label={`${getSelectedItemsCount(dateIndex)}`}
                          size="small"
                          variant={getSelectedItemsCount(dateIndex) > 0 ? 'filled' : 'outlined'}
                          color={getSelectedItemsCount(dateIndex) > 0 ? 'primary' : 'default'}
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                          }}
                        />
                      </Box>
                    </Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {foodItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={allDateLabels.length + 1} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      No food items available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                foodItems.map((item) => (
                  <TableRow
                    key={item._id}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(79, 140, 255, 0.04)',
                      }
                    }}
                  >
                    <TableCell
                      sx={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'inherit',
                        zIndex: 1,
                        borderRight: '1px solid #E0E0E0'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: item.veg ? '#4CAF50' : '#F44336',
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', lineHeight: 1.2 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                            {safeFormatCurrency(item.price)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    {allDateLabels.map((dateInfo, dateIndex) => (
                      <TableCell
                        key={`${item._id}-${dateInfo.date}`}
                        align="center"
                        sx={{
                          padding: '8px 16px',
                          minWidth: 100,
                          zIndex: 2,
                        }}
                      >
                        <Tooltip
                          title={`Toggle item for ${dateInfo.label}`}
                          arrow
                        >
                          <Checkbox
                            checked={isItemSelectedForDay(dateIndex, item._id)}
                            onChange={() => handleItemToggle(dateIndex, item._id)}
                            disabled={disabled}
                            size="small"
                            sx={{
                              color: '#4F8CFF',
                              '&.Mui-checked': {
                                color: '#4F8CFF',
                              },
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Mobile Responsive Summary */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
        <Typography variant="body2" sx={{ color: '#666', textAlign: 'center' }}>
          Swipe horizontally to see all dates
        </Typography>
      </Box>
    </Box>
  );
}