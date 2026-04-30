'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  CircularProgress,
  InputAdornment,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  IconCalendar,
  IconDeviceFloppy,
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconMinus,
  IconX,
} from '@tabler/icons-react';
import WeeklyPlannerSkeleton from './WeeklyPlannerSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { safeFormatCurrency } from '@/utils/currency';
import { useAvailableDays } from '@/hooks/useAvailableDays';
import { DAYS_OF_WEEK, getDefaultDays, getDayAbbreviation } from '@/utils/days';

interface FoodItem {
  _id: string;
  name: string;
  price: number;
  veg: boolean;
  available: boolean;
  url?: string;
}

interface Category {
  _id: string;
  name: string;
  description?: string;
}

interface CategoryWithItems extends Category {
  items: FoodItem[];
}

export default function WeeklyPlannerPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const { availableDays, enabledDays, loading: daysLoading } = useAvailableDays();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Track selected items for each day - initialize with default days structure
  const [weeklyMenu, setWeeklyMenu] = useState<Record<string, string[]>>(() => {
    const defaultDays = getDefaultDays();
    const menu: Record<string, string[]> = {};
    defaultDays.forEach(day => {
      menu[day.day] = [];
    });
    return menu;
  });

  // Get week days and labels from utilities
  const weekDays = DAYS_OF_WEEK.map(day => day.toLowerCase());

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Create filtered days array based on enabled days from the hook
  const enabledDaysForTable = useMemo(() => {
    return enabledDays
      .sort((a, b) => a.sequence - b.sequence)
      .map(day => ({
        key: day.day,
        label: getDayAbbreviation(day.label)
      }));
  }, [enabledDays]);

  // Fetch weekly menu data on component mount
  useEffect(() => {
    async function fetchWeeklyMenu() {
      try {
        if (!token || !isAuthenticated) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('/api/admin/weekly-menu', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch weekly menu');
        }

        const { data: menu } = await response.json();

        if (menu) {
          // Convert full objects -> just IDs
          const normalizeDay = (items: Array<{ _id?: string } | string>) =>
            Array.isArray(items) ? items.map((item) => (typeof item === 'object' && item._id) ? item._id : item as string) : [];

          // Initialize with all week days from utilities
          const normalizedMenu: Record<string, string[]> = {};
          weekDays.forEach(day => {
            normalizedMenu[day] = normalizeDay(menu[day] || []);
          });

          setWeeklyMenu(normalizedMenu);
        }
      } catch (err) {
        console.error('Error fetching weekly menu:', err);
        showSnackbar('Failed to load weekly menu data', 'error');
      }
    }

    fetchWeeklyMenu();
  }, [token, isAuthenticated]);

  // Fetch categories and food items
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Fetch categories
      const categoriesResponse = await fetch('/api/admin/food-category', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!categoriesResponse.ok) {
        throw new Error('Failed to fetch categories');
      }

      const categoriesData = await categoriesResponse.json();

      // Filter out unwanted categories
      const filteredCategories = categoriesData.data.items.filter(
        (cat: Category) =>
          cat.name?.trim() !== 'Day Special' && cat.name?.trim() !== 'Plan Weekly Meal'
      );

      // Fetch food items for each category
      const categoriesWithItems = await Promise.all(
        filteredCategories.map(async (category: Category) => {
          const itemsResponse = await fetch(
            `/api/admin/food-items?category=${category._id?.toString()}&page=1&limit=100`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!itemsResponse.ok) {
            throw new Error(`Failed to fetch items for category ${category.name}`);
          }

          const itemsData = await itemsResponse.json();

          return {
            ...category,
            items: itemsData.data.items,
          };
        })
      );

      setCategories(categoriesWithItems);

      // Auto-expand all categories initially
      const expanded: Record<string, boolean> = {};
      categoriesWithItems.forEach((cat) => {
        expanded[cat._id] = true;
      });
      setExpandedCategories(expanded);
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Failed to load food items', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Toggle item for a specific day
  const toggleItemForDay = (itemId: string, day: string) => {
    setWeeklyMenu((prev) => {
      const dayItems = prev[day] || [];
      if (dayItems.includes(itemId)) {
        return {
          ...prev,
          [day]: dayItems.filter((id) => id !== itemId),
        };
      }
      return {
        ...prev,
        [day]: [...dayItems, itemId],
      };
    });
  };

  // Toggle item for all enabled days
  const toggleItemForAllDays = (itemId: string) => {
    const enabledDayKeys = enabledDaysForTable.map(day => day.key);
    const allEnabledDaysHaveItem = enabledDayKeys.every((day) => weeklyMenu[day]?.includes(itemId));

    setWeeklyMenu((prev) => {
      const newState = { ...prev };
      enabledDayKeys.forEach((day) => {
        const currentItems = newState[day] || [];
        if (allEnabledDaysHaveItem) {
          newState[day] = currentItems.filter((id) => id !== itemId);
        } else if (!currentItems.includes(itemId)) {
          newState[day] = [...currentItems, itemId];
        }
      });
      return newState;
    });
  };

  // Unselect all items for all days
  const unselectAllForAllDays = () => {
    const clearedMenu: Record<string, string[]> = {};
    weekDays.forEach(day => {
      clearedMenu[day] = [];
    });
    setWeeklyMenu(clearedMenu);
    showSnackbar('All selections cleared', 'success');
  };

  // Unselect all items within a specific category
  const unselectCategory = (categoryId: string) => {
    const category = categories.find(cat => cat._id?.toString() === categoryId);
    if (!category) return;

    const categoryItemIds = category.items.map(item => item._id);
    const enabledDayKeys = enabledDaysForTable.map(day => day.key);

    setWeeklyMenu((prev) => {
      const newState = { ...prev };
      enabledDayKeys.forEach((day) => {
        const currentItems = newState[day] || [];
        newState[day] = currentItems.filter((id) => !categoryItemIds.includes(id));
      });
      return newState;
    });

    showSnackbar(`Cleared all items from ${category.name}`, 'success');
  };

  // Check if item is selected for all enabled days
  const isSelectedForAllDays = (itemId: string) => {
    const enabledDayKeys = enabledDaysForTable.map(day => day.key);
    return enabledDayKeys.every((day) => weeklyMenu[day]?.includes(itemId));
  };

  // Check if item is partially selected (some enabled days but not all)
  const isPartiallySelected = (itemId: string) => {
    const enabledDayKeys = enabledDaysForTable.map(day => day.key);
    const selectedDays = enabledDayKeys.filter((day) => weeklyMenu[day]?.includes(itemId));
    return selectedDays.length > 0 && selectedDays.length < enabledDayKeys.length;
  };

  // Toggle category expansion
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      const totalItems = Object.values(weeklyMenu).reduce((sum, items) => sum + items.length, 0);

      if (totalItems === 0) {
        showSnackbar('Please add at least one item to the weekly menu', 'warning');
        return;
      }

      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const dataToSave: Record<string, string[]> = {
        allDays: [],
      };

      // Add all week days to the data structure
      weekDays.forEach(day => {
        dataToSave[day] = weeklyMenu[day] || [];
      });

      const response = await fetch('/api/admin/weekly-menu', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        throw new Error('Failed to save weekly menu');
      }

      setSaveSuccess(true);
      showSnackbar(`Successfully saved weekly menu with ${totalItems} items`, 'success');

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving weekly menu:', error);
      showSnackbar('Failed to save weekly menu. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filter items based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery]);

  if (authLoading) {
    return <WeeklyPlannerSkeleton />;
  }

  if (!isAuthenticated || !token) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Authentication required. Please log in again.
        </Typography>
      </Box>
    );
  }

  if (loading || daysLoading) {
    return <WeeklyPlannerSkeleton />;
  }

  return (
    <Box sx={{ p: 4, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Card */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          p: 3,
          borderRadius: 3,
          mb: 3,
          boxShadow: '0 8px 16px rgba(79, 70, 229, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconCalendar size={28} color="#fff" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
                Weekly Menu Planner
              </Typography>
              <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9, mt: 0.5 }}>
                Select which food items are available on each day of the week
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<IconX size={18} />}
              onClick={unselectAllForAllDays}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.5)',
                color: '#fff',
                textTransform: 'none',
                paddingX: 2,
                paddingY: 1.5,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.8)',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              Unselect All
            </Button>
            <Button
              variant="contained"
              startIcon={
                saving ? (
                  <CircularProgress size={16} sx={{ color: '#fff' }} />
                ) : saveSuccess ? (
                  <IconCheck size={18} />
                ) : (
                  <IconDeviceFloppy size={18} />
                )
              }
              onClick={handleSave}
              disabled={saving}
              sx={{
                backgroundColor: saveSuccess ? '#10B981' : 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                textTransform: 'none',
                paddingX: 3,
                paddingY: 1.5,
                '&:hover': {
                  backgroundColor: saveSuccess ? '#059669' : 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                },
              }}
            >
              {saving ? 'Saving...' : saveSuccess ? 'Menu Saved!' : 'Save Weekly Menu'}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Search Bar */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 3 }}>
        <TextField
          fullWidth
          placeholder="Search food items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={20} color="#6B7280" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                border: 'none',
              },
            },
          }}
        />
      </Card>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Table sx={{ minWidth: 900 }}>
          <TableHead
            sx={{
              backgroundColor: '#E6F0FF',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <TableRow
              sx={{
                borderBottom: '2px solid #4F8CFF',
              }}
            >
              <TableCell
                sx={{
                  width: '320px',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '14px',
                }}
              >
                Item Name
              </TableCell>
              {enabledDaysForTable.map((day) => (
                <TableCell
                  key={day.key}
                  align="center"
                  sx={{
                    width: '80px',
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '14px',
                  }}
                >
                  {day.label}
                </TableCell>
              ))}
              <TableCell
                align="center"
                sx={{
                  width: '100px',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '14px',
                }}
              >
                All Days
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCategories.map((category) => (
              <React.Fragment key={category._id?.toString()}>
                {/* Category Row */}
                <TableRow
                  sx={{
                    backgroundColor: '#F6FAFF',
                    '&:hover': {
                      backgroundColor: '#EEF2FF',
                    },
                  }}
                >
                  <TableCell colSpan={enabledDaysForTable.length + 2} sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                        onClick={() => toggleCategoryExpansion(category._id?.toString())}
                      >
                        <IconButton size="small" sx={{ p: 0 }}>
                          {expandedCategories[category._id?.toString()] ? (
                            <IconChevronDown size={18} />
                          ) : (
                            <IconChevronRight size={18} />
                          )}
                        </IconButton>
                        <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '16px' }}>
                          {category.name} ({category.items.length} items)
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<IconX size={16} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          unselectCategory(category._id?.toString());
                        }}
                        sx={{
                          borderColor: '#D1D5DB',
                          color: '#6B7280',
                          textTransform: 'none',
                          paddingX: 1.5,
                          paddingY: 0.75,
                          fontSize: '12px',
                          minWidth: 'auto',
                          '&:hover': {
                            borderColor: '#9CA3AF',
                            backgroundColor: '#F9FAFB',
                            color: '#374151',
                          },
                        }}
                      >
                        Unselect
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>

                {/* Items */}
                <React.Fragment>
                  {expandedCategories[category._id?.toString()] &&
                    category.items.map((item, itemIndex) => {
                      const allDaysChecked = isSelectedForAllDays(item._id);
                      const partiallySelected = isPartiallySelected(item._id);

                      return (
                        <TableRow
                          key={item._id}
                          sx={{
                            backgroundColor: itemIndex % 2 === 0 ? '#fff' : '#FAFAFA',
                            borderBottom: '1px solid #F0F0F0',
                            '&:hover': {
                              backgroundColor: '#F0F8FF',
                            },
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: '2px',
                                  border: `1.5px solid ${item.veg ? '#10B981' : '#EF4444'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: item.veg ? '#10B981' : '#EF4444',
                                  }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ fontSize: '14px' }}>
                                {item.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: '#6B7280', fontSize: '12px' }}
                              >
                                ({safeFormatCurrency(item.price)})
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Day Checkboxes */}
                          {enabledDaysForTable.map((day) => (
                            <TableCell key={day.key} align="center">
                              <Checkbox
                                checked={weeklyMenu[day.key]?.includes(item._id) || false}
                                onChange={() => toggleItemForDay(item._id, day.key)}
                                sx={{
                                  color: '#D1D5DB',
                                  '&.Mui-checked': {
                                    color: '#4F8CFF',
                                  },
                                }}
                              />
                            </TableCell>
                          ))}

                          {/* All Days Checkbox */}
                          <TableCell align="center">
                            <Checkbox
                              checked={allDaysChecked}
                              indeterminate={partiallySelected}
                              onChange={() => toggleItemForAllDays(item._id)}
                              icon={<Box sx={{ width: 18, height: 18 }} />}
                              indeterminateIcon={
                                <Box
                                  sx={{
                                    width: 18,
                                    height: 18,
                                    border: '2px solid #F59E0B',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <IconMinus size={12} color="#F59E0B" />
                                </Box>
                              }
                              sx={{
                                color: '#D1D5DB',
                                '&.Mui-checked': {
                                  color: '#10B981',
                                },
                                '&.MuiCheckbox-indeterminate': {
                                  color: '#F59E0B',
                                },
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </React.Fragment>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Snackbar */}
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
