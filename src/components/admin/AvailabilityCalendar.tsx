'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconCheck,
  IconX,
  IconClock,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { AvailableDate } from '@/types/order';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns';
import { formatInPST } from '@/utils/timezone';
import {
  cutoffStatus,
  ITEM_KINDS,
  ITEM_KIND_LABEL,
  overrideForKind,
  DEFAULT_CUTOFF_HOUR_BY_KIND,
  type ItemKind,
  describeCutoff,
  formatCutoff,
  extendCutoff,
  inputValueToInstant,
  instantToInputValue,
  parseCutoff,
  validateCutoff,
} from '@/utils/orderCutoff';

interface DateCellData {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  isCurrentMonth: boolean;
  isPadding: boolean;
  availability?: AvailableDate;
}

interface AvailabilityCalendarProps {
  onDateClick?: (date: string, availability: AvailableDate | undefined) => void;
  initialMonth?: Date;
}

export default function AvailabilityCalendar({ onDateClick, initialMonth }: AvailabilityCalendarProps) {
  const { token, isAuthenticated } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth || new Date());
  const [datesData, setDatesData] = useState<Record<string, AvailableDate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // the cutoff time typed in the dialog for each kind of item, as a Pacific-time datetime-local value
  const [cutoffInputs, setCutoffInputs] = useState<Record<ItemKind, string>>({ flat: '', 'day-wise': '' });
  const [error, setError] = useState<string | null>(null);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Fetch dates for current month view
  const fetchDatesData = useCallback(async () => {
    if (!token || !isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = formatInPST(monthStart, 'yyyy-MM-dd');
      const endDate = formatInPST(monthEnd, 'yyyy-MM-dd');

      const response = await fetch(
        `/api/admin/available-dates?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch availability data');
      }

      const result = await response.json();
      const datesMap: Record<string, AvailableDate> = {};

      result.data?.forEach((item: AvailableDate) => {
        datesMap[item.date] = item;
      });

      setDatesData(datesMap);
    } catch (err) {
      console.error('Error fetching dates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load availability data');
      showSnackbar('Failed to load availability data', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, currentMonth]);

  useEffect(() => {
    fetchDatesData();
  }, [fetchDatesData]);

  // Navigate to previous month
  const handlePrevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  // Navigate to next month
  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // Navigate to today
  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  // Handle date cell click
  const handleDateClick = (dateData: DateCellData) => {
    setSelectedDate(dateData.date);
    setDialogOpen(true);
    if (onDateClick) {
      onDateClick(dateData.date, dateData.availability);
    }
  };

  // Show the cutoff in effect for the selected date (custom or standard) when the dialog opens or the data is saved
  useEffect(() => {
    if (!dialogOpen || !selectedDate) return;
    const data = datesData[selectedDate];
    setCutoffInputs({
      flat: instantToInputValue(cutoffStatus(selectedDate, overrideForKind(data, 'flat'), new Date(), 'flat').closesAt),
      'day-wise': instantToInputValue(cutoffStatus(selectedDate, overrideForKind(data, 'day-wise'), new Date(), 'day-wise').closesAt),
    });
  }, [dialogOpen, selectedDate, datesData]);

  // Update single date availability
  const updateDateAvailability = async (
    date: string,
    flatCategoryEnabled: boolean,
    dayWiseCategoryEnabled: boolean,
    /** per kind of item: undefined = leave the custom order cutoff as it is, null = back to the standard cutoff, string = set it (ISO) */
    cutoffs?: { flatCutoffAt?: string | null; dayWiseCutoffAt?: string | null },
    successMessage = 'Availability updated successfully'
  ) => {
    if (!token || !isAuthenticated) return;

    try {
      setSaving((prev) => ({ ...prev, [date]: true }));

      const response = await fetch('/api/admin/available-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date,
          flatCategoryEnabled,
          dayWiseCategoryEnabled,
          ...(cutoffs?.flatCutoffAt !== undefined ? { flatCutoffAt: cutoffs.flatCutoffAt } : {}),
          ...(cutoffs?.dayWiseCutoffAt !== undefined ? { dayWiseCutoffAt: cutoffs.dayWiseCutoffAt } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update availability');
      }

      const result = await response.json();

      // Update local state
      setDatesData((prev) => ({
        ...prev,
        [date]: result.data,
      }));

      showSnackbar(
        result.livesiteNotified === false
          ? `${successMessage}. The customer menu may take up to 5 minutes to follow.`
          : successMessage,
        result.livesiteNotified === false ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('Error updating date:', err);
      showSnackbar(err instanceof Error ? err.message : 'Failed to update availability', 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [date]: false }));
    }
  };

  // Handle dialog save
  const handleDialogSave = async (
    flatCategoryEnabled: boolean,
    dayWiseCategoryEnabled: boolean
  ) => {
    if (!selectedDate) return;

    await updateDateAvailability(selectedDate, flatCategoryEnabled, dayWiseCategoryEnabled);
    setDialogOpen(false);
    setSelectedDate(null);
  };

  // Bulk enable all for month
  const handleEnableAllForMonth = async () => {
    if (!token || !isAuthenticated) return;

    try {
      setBulkSaving(true);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const dates = daysInMonth.map((day) => ({
        date: formatInPST(day, 'yyyy-MM-dd'),
        flatCategoryEnabled: true,
        dayWiseCategoryEnabled: true,
      }));

      const startDate = formatInPST(monthStart, 'yyyy-MM-dd');
      const endDate = formatInPST(monthEnd, 'yyyy-MM-dd');

      const response = await fetch('/api/admin/available-dates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dates,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enable all dates');
      }

      await fetchDatesData();
      showSnackbar('All dates enabled for this month');
    } catch (err) {
      console.error('Error enabling all:', err);
      showSnackbar('Failed to enable all dates', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  // Bulk disable all for month
  const handleDisableAllForMonth = async () => {
    if (!token || !isAuthenticated) return;

    try {
      setBulkSaving(true);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const dates = daysInMonth.map((day) => ({
        date: formatInPST(day, 'yyyy-MM-dd'),
        flatCategoryEnabled: false,
        dayWiseCategoryEnabled: false,
      }));

      const startDate = formatInPST(monthStart, 'yyyy-MM-dd');
      const endDate = formatInPST(monthEnd, 'yyyy-MM-dd');

      const response = await fetch('/api/admin/available-dates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dates,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to disable all dates');
      }

      await fetchDatesData();
      showSnackbar('All dates disabled for this month');
    } catch (err) {
      console.error('Error disabling all:', err);
      showSnackbar('Failed to disable all dates', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  // Generate calendar days
  const generateCalendarDays = useCallback((): DateCellData[] => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map((day) => {
      const dateString = formatInPST(day, 'yyyy-MM-dd');
      const dayOfWeek = formatInPST(day, 'EEE');
      const isCurrentMonth = isSameMonth(day, currentMonth);
      const isPadding = !isCurrentMonth;

      return {
        date: dateString,
        dayOfWeek,
        isCurrentMonth,
        isPadding,
        availability: datesData[dateString],
      };
    });
  }, [currentMonth, datesData]);

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get status for a date cell
  const getDateStatus = (dateData: DateCellData): 'both' | 'flat' | 'daywise' | 'none' => {
    const { availability } = dateData;

    if (!availability) return 'none';

    const flat = availability.flatCategoryEnabled;
    const daywise = availability.dayWiseCategoryEnabled;

    if (flat && daywise) return 'both';
    if (flat) return 'flat';
    if (daywise) return 'daywise';
    return 'none';
  };

  // Get cell color based on status
  const getCellColor = (status: string) => {
    switch (status) {
      case 'both':
        return {
          bg: '#D1FAE5',
          border: '#10B981',
          text: '#065F46',
        };
      case 'flat':
        return {
          bg: '#DBEAFE',
          border: '#4F8CFF',
          text: '#1E40AF',
        };
      case 'daywise':
        return {
          bg: '#EDE9FE',
          border: '#8B5CF6',
          text: '#5B21B6',
        };
      default:
        return {
          bg: '#F3F4F6',
          border: '#D1D5DB',
          text: '#6B7280',
        };
    }
  };

  if (!isAuthenticated || !token) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Authentication required. Please log in again.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Controls Card */}
      <Card sx={{ mb: 3, p: 2, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          {/* Month Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handlePrevMonth} sx={{ backgroundColor: '#F3F4F6' }}>
              <IconChevronLeft size={20} />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
              {formatInPST(currentMonth, 'MMMM yyyy')}
            </Typography>
            <IconButton onClick={handleNextMonth} sx={{ backgroundColor: '#F3F4F6' }}>
              <IconChevronRight size={20} />
            </IconButton>
            <Button variant="outlined" size="small" onClick={handleToday}>
              Today
            </Button>
          </Box>

          {/* Bulk Actions */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={bulkSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <IconCheck size={18} />}
              onClick={handleEnableAllForMonth}
              disabled={bulkSaving || loading}
              sx={{
                backgroundColor: '#10B981',
                '&:hover': { backgroundColor: '#059669' },
                textTransform: 'none',
              }}
            >
              Enable All
            </Button>
            <Button
              variant="outlined"
              startIcon={bulkSaving ? <CircularProgress size={16} /> : <IconX size={18} />}
              onClick={handleDisableAllForMonth}
              disabled={bulkSaving || loading}
              sx={{
                borderColor: '#EF4444',
                color: '#EF4444',
                '&:hover': {
                  borderColor: '#DC2626',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                },
                textTransform: 'none',
              }}
            >
              Disable All
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Legend */}
      <Card sx={{ mb: 3, px: 1.5, py: 1, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Legend
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: '#D1FAE5',
                  border: '2px solid #10B981',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption" sx={{ color: '#374151', fontSize: '12px', fontWeight: 500 }}>
                Both
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: '#DBEAFE',
                  border: '2px solid #4F8CFF',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption" sx={{ color: '#374151', fontSize: '12px', fontWeight: 500 }}>
                Flat
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: '#EDE9FE',
                  border: '2px solid #8B5CF6',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption" sx={{ color: '#374151', fontSize: '12px', fontWeight: 500 }}>
                Day-wise
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: '#F3F4F6',
                  border: '2px solid #D1D5DB',
                  borderRadius: 1,
                }}
              />
              <Typography variant="caption" sx={{ color: '#374151', fontSize: '12px', fontWeight: 500 }}>
                None
              </Typography>
            </Box>
          </Box>
        </Box>
      </Card>

      {/* Calendar Grid */}
      <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          {error && (
            <Alert severity="error" sx={{ m: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {/* Weekday Headers */}
              <Grid container spacing={1} sx={{ mb: 1 }}>
                {weekDays.map((day) => (
                  <Grid size={12 / 7} key={day}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        textAlign: 'center',
                        fontWeight: 600,
                        color: '#6B7280',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {day}
                    </Typography>
                  </Grid>
                ))}
              </Grid>

              {/* Calendar Days */}
              <Grid container spacing={1}>
                {calendarDays.map((dateData) => {
                  const status = getDateStatus(dateData);
                  const colors = getCellColor(status);
                  const dateObj = parseISO(dateData.date);
                  const isTodayDate = isToday(dateObj);

                  return (
                    <Grid size={12 / 7} key={dateData.date}>
                      <Box
                    onClick={() => handleDateClick(dateData)}
                    sx={{
                      minHeight: 80,
                      backgroundColor: dateData.isPadding ? '#F9FAFB' : colors.bg,
                      border: `2px solid ${dateData.isPadding ? '#E5E7EB' : colors.border}`,
                      borderRadius: 2,
                      p: 1,
                      cursor: dateData.isPadding ? 'default' : 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      opacity: dateData.isPadding ? 0.5 : 1,
                      '&:hover': !dateData.isPadding ? {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      } : {},
                      ...(isTodayDate && {
                        boxShadow: '0 0 0 3px #8B5CF6',
                      }),
                    }}
                  >
                    {/* Date Number */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: dateData.isPadding ? '#9CA3AF' : colors.text,
                        fontSize: '14px',
                        mb: 0.5,
                      }}
                    >
                      {formatInPST(dateObj, 'd')}
                    </Typography>

                    {/* Status Indicators - only show for current month */}
                    {!dateData.isPadding && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Chip
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {dateData.availability?.flatCategoryEnabled ? (
                                <IconCheck size={12} />
                              ) : (
                                <IconX size={12} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '10px' }}>
                                Flat
                              </Typography>
                            </Box>
                          }
                          size="small"
                          sx={{
                            height: 20,
                            backgroundColor: dateData.availability?.flatCategoryEnabled
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                            color: dateData.availability?.flatCategoryEnabled ? '#065F46' : '#991B1B',
                            border: `1px solid ${
                              dateData.availability?.flatCategoryEnabled ? '#10B981' : '#EF4444'
                            }`,
                            '& .MuiChip-label': {
                              fontSize: '10px',
                              fontWeight: 500,
                            },
                          }}
                        />
                        <Chip
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {dateData.availability?.dayWiseCategoryEnabled ? (
                                <IconCheck size={12} />
                              ) : (
                                <IconX size={12} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '10px' }}>
                                Day-wise
                              </Typography>
                            </Box>
                          }
                          size="small"
                          sx={{
                            height: 20,
                            backgroundColor: dateData.availability?.dayWiseCategoryEnabled
                              ? 'rgba(139, 92, 246, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                            color: dateData.availability?.dayWiseCategoryEnabled ? '#5B21B6' : '#991B1B',
                            border: `1px solid ${
                              dateData.availability?.dayWiseCategoryEnabled ? '#8B5CF6' : '#EF4444'
                            }`,
                            '& .MuiChip-label': {
                              fontSize: '10px',
                              fontWeight: 500,
                            },
                          }}
                        />
                        {ITEM_KINDS.some((k) => parseCutoff(overrideForKind(dateData.availability, k))) && (
                          <Chip
                            icon={<IconClock size={12} />}
                            label="Custom cutoff"
                            size="small"
                            sx={{
                              height: 20,
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              color: '#92400E',
                              border: '1px solid #F59E0B',
                              '& .MuiChip-label': { fontSize: '10px', fontWeight: 500, px: 0.75 },
                              '& .MuiChip-icon': { ml: 0.5, color: '#92400E' },
                            }}
                          />
                        )}
                      </Box>
                    )}

                    {/* Loading Indicator */}
                    {saving[dateData.date] && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          borderRadius: 1,
                          p: 1,
                        }}
                      >
                        <CircularProgress size={20} />
                      </Box>
                    )}
                  </Box>
                </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Edit Availability for {selectedDate && formatInPST(parseISO(selectedDate), 'MMM dd, yyyy')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
              Toggle category availability for this date
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 2,
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Flat Category
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    Enable flat listing categories
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  value={
                    selectedDate && datesData[selectedDate]?.flatCategoryEnabled ? 'enabled' : 'disabled'
                  }
                  exclusive
                  onChange={(event, value) => {
                    if (value && selectedDate) {
                      const enabled = value === 'enabled';
                      const dayWiseEnabled = datesData[selectedDate]?.dayWiseCategoryEnabled ?? false;
                      updateDateAvailability(selectedDate, enabled, dayWiseEnabled);
                    }
                  }}
                  size="small"
                >
                  <ToggleButton value="enabled" sx={{ textTransform: 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconCheck size={16} />
                      <span>Enabled</span>
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="disabled" sx={{ textTransform: 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconX size={16} />
                      <span>Disabled</span>
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 2,
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Day-wise Category
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    Enable day-wise listing categories
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  value={
                    selectedDate && datesData[selectedDate]?.dayWiseCategoryEnabled
                      ? 'enabled'
                      : 'disabled'
                  }
                  exclusive
                  onChange={(event, value) => {
                    if (value && selectedDate) {
                      const enabled = value === 'enabled';
                      const flatEnabled = datesData[selectedDate]?.flatCategoryEnabled ?? false;
                      updateDateAvailability(selectedDate, flatEnabled, enabled);
                    }
                  }}
                  size="small"
                >
                  <ToggleButton value="enabled" sx={{ textTransform: 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconCheck size={16} />
                      <span>Enabled</span>
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="disabled" sx={{ textTransform: 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconX size={16} />
                      <span>Disabled</span>
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {selectedDate && ITEM_KINDS.map((kind) => {
                const availability = datesData[selectedDate];
                const override = overrideForKind(availability, kind);
                const status = cutoffStatus(selectedDate, override, new Date(), kind);
                const input = cutoffInputs[kind];
                const typed = inputValueToInstant(input);
                const problem = typed ? validateCutoff(selectedDate, typed) : 'Pick a date and time';
                const unchanged =
                  !!typed && Math.abs(typed.getTime() - status.closesAt.getTime()) < 60 * 1000 && status.overridden;
                const busy = !!saving[selectedDate];
                // a kind that is switched off for the date cannot be ordered at all, whatever its cutoff says
                const switchedOn = !!(kind === 'flat' ? availability?.flatCategoryEnabled : availability?.dayWiseCategoryEnabled);
                const field = kind === 'flat' ? 'flatCutoffAt' : 'dayWiseCutoffAt';
                const standardHour = DEFAULT_CUTOFF_HOUR_BY_KIND[kind];
                const standardTime = `${standardHour > 12 ? standardHour - 12 : standardHour}:00 ${standardHour >= 12 ? 'PM' : 'AM'}`;
                const setInfo = (kind === 'flat' ? availability?.flatCutoffSet : availability?.dayWiseCutoffSet) ?? null;
                const setAt = setInfo ? parseCutoff(setInfo.at) : null;
                const saveCutoff = (value: string | null, message: string) =>
                  updateDateAvailability(
                    selectedDate,
                    availability?.flatCategoryEnabled ?? false,
                    availability?.dayWiseCategoryEnabled ?? false,
                    { [field]: value },
                    message
                  );
                return (
                  <Box key={kind} sx={{ p: 2, backgroundColor: '#F9FAFB', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Order cutoff: {ITEM_KIND_LABEL[kind]}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6B7280' }}>
                          When customers can no longer order these items for this date. The standard time is {standardTime} the day before.
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={!switchedOn ? 'Disabled: not offered' : status.isOpen ? 'Open for orders' : 'Closed for orders'}
                        sx={{
                          fontWeight: 600,
                          backgroundColor: !switchedOn ? 'rgba(107, 114, 128, 0.15)' : status.isOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: !switchedOn ? '#374151' : status.isOpen ? '#065F46' : '#991B1B',
                        }}
                      />
                    </Box>

                    {!switchedOn && (
                      <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600, color: '#374151' }}>
                        {kind === 'flat' ? 'Flat' : 'Day-wise'} category is disabled for this date, so customers cannot order these items at all. The cutoff below only matters once you enable it.
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 500, ...(switchedOn ? {} : { color: '#6B7280' }) }}>
                      {describeCutoff(selectedDate, override, new Date(), kind)}
                    </Typography>
                    {status.overridden && (
                      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
                        {setAt
                          ? `Custom cutoff set ${formatCutoff(setAt)} Pacific${setInfo?.by ? ` by ${setInfo.by}` : ''}`
                          : 'Custom cutoff (the time it was set was not recorded)'}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                      {[1, 2].map((hours) => (
                        <Button
                          key={hours}
                          variant="contained"
                          size="small"
                          disabled={busy}
                          onClick={() =>
                            saveCutoff(
                              extendCutoff(selectedDate, override, hours, new Date(), kind).toISOString(),
                              `Cutoff extended by ${hours} hour${hours > 1 ? 's' : ''}`
                            )
                          }
                          sx={{ textTransform: 'none' }}
                        >
                          Extend {hours} hour{hours > 1 ? 's' : ''}
                        </Button>
                      ))}
                      {status.overridden && (
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={busy}
                          onClick={() => saveCutoff(null, 'Back to the standard cutoff')}
                          sx={{ textTransform: 'none' }}
                        >
                          Back to standard
                        </Button>
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.75 }}>
                      Extending counts from now if the cutoff has already passed, so a closed day reopens right away.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <TextField
                        type="datetime-local"
                        size="small"
                        label="Close ordering at (Pacific time)"
                        value={input}
                        onChange={(e) => setCutoffInputs((prev) => ({ ...prev, [kind]: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        error={!!input && !!problem}
                        helperText={input && problem ? problem : undefined}
                        sx={{ flex: '1 1 220px', minWidth: 220 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={busy || !!problem || unchanged}
                        onClick={() => typed && saveCutoff(typed.toISOString(), 'Cutoff saved')}
                        sx={{ textTransform: 'none', height: 40 }}
                      >
                        Save cutoff
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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
