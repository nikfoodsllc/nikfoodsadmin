'use client';

import { useState } from 'react';
import { Box, Button, Menu, MenuItem, Divider, Stack } from '@mui/material';
import { IconCalendar, IconChevronDown } from '@tabler/icons-react';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear';

interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * Validates if a given value is a valid Date object
 */
const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Creates a timezone-safe Date object using local time components
 * This avoids timezone issues by explicitly setting all components
 */
const createSafeDate = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date => {
  const date = new Date(year, month, day, hour, minute, second);

  // Validate the created date
  if (!isValidDate(date)) {
    throw new Error(`Invalid date created: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`);
  }

  return date;
};

/**
 * Validates if the provided preset is a valid DateRangePreset
 */
const isValidDateRangePreset = (preset: string): preset is DateRangePreset => {
  const validPresets: DateRangePreset[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear'];
  return validPresets.includes(preset as DateRangePreset);
};

const getDateRange = (preset: DateRangePreset): DateRange => {
  // Input validation
  if (!preset || !isValidDateRangePreset(preset)) {
    console.warn(`Invalid date range preset provided: ${preset}. Defaulting to 'thisMonth'.`);
    preset = 'thisMonth';
  }

  const now = new Date();

  // Validate current date
  if (!isValidDate(now)) {
    throw new Error('Current system date is invalid');
  }

  const today = createSafeDate(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    switch (preset) {
      case 'today': {
        return {
          startDate: today,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'Today',
        };
      }
      case 'yesterday': {
        const yesterdayDate = new Date(today);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = createSafeDate(
          yesterdayDate.getFullYear(),
          yesterdayDate.getMonth(),
          yesterdayDate.getDate()
        );
        return {
          startDate: yesterday,
          endDate: createSafeDate(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59),
          label: 'Yesterday',
        };
      }
      case 'thisWeek': {
        const dayOfWeek = today.getDay();
        const startOfWeekDate = new Date(today);
        startOfWeekDate.setDate(today.getDate() - dayOfWeek);
        const startOfWeek = createSafeDate(
          startOfWeekDate.getFullYear(),
          startOfWeekDate.getMonth(),
          startOfWeekDate.getDate()
        );
        return {
          startDate: startOfWeek,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Week',
        };
      }
      case 'lastWeek': {
        const dayOfWeek = today.getDay();
        const startOfLastWeekDate = new Date(today);
        startOfLastWeekDate.setDate(today.getDate() - dayOfWeek - 7);
        const startOfLastWeek = createSafeDate(
          startOfLastWeekDate.getFullYear(),
          startOfLastWeekDate.getMonth(),
          startOfLastWeekDate.getDate()
        );

        const endOfLastWeekDate = new Date(startOfLastWeek);
        endOfLastWeekDate.setDate(startOfLastWeek.getDate() + 6);
        const endOfLastWeek = createSafeDate(
          endOfLastWeekDate.getFullYear(),
          endOfLastWeekDate.getMonth(),
          endOfLastWeekDate.getDate(),
          23, 59, 59
        );
        return {
          startDate: startOfLastWeek,
          endDate: endOfLastWeek,
          label: 'Last Week',
        };
      }
      case 'thisMonth': {
        const startOfMonth = createSafeDate(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: startOfMonth,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Month',
        };
      }
      case 'lastMonth': {
        const startOfLastMonth = createSafeDate(now.getFullYear(), now.getMonth() - 1, 1);

        // Get the last day of last month
        const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const endOfLastMonth = createSafeDate(
          lastMonth.getFullYear(),
          lastMonth.getMonth(),
          lastMonth.getDate(),
          23, 59, 59
        );
        return {
          startDate: startOfLastMonth,
          endDate: endOfLastMonth,
          label: 'Last Month',
        };
      }
      case 'thisYear': {
        const startOfYear = createSafeDate(now.getFullYear(), 0, 1);
        return {
          startDate: startOfYear,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Year',
        };
      }
      default: {
        // This should never be reached due to validation, but acts as a safety net
        console.warn(`Unhandled preset in switch statement: ${preset}. Defaulting to 'thisMonth'.`);
        const startOfMonth = createSafeDate(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: startOfMonth,
          endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
          label: 'This Month',
        };
      }
    }
  } catch (error) {
    console.error('Error creating date range:', error);
    // Fallback to current month as a safe default
    const startOfMonth = createSafeDate(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: startOfMonth,
      endDate: createSafeDate(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
      label: 'This Month',
    };
  }
};

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePresetSelect = (preset: DateRangePreset) => {
    const range = getDateRange(preset);
    onChange(range);
    handleClose();
  };

  return (
    <Box>
      <Button
        variant="outlined"
        startIcon={<IconCalendar size={18} />}
        endIcon={<IconChevronDown size={16} />}
        onClick={handleClick}
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          borderColor: '#e0e0e0',
          color: '#333',
          paddingX: 2,
          paddingY: 1,
          '&:hover': {
            borderColor: '#4F8CFF',
            backgroundColor: 'rgba(79, 140, 255, 0.04)',
          },
        }}
      >
        {value.label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        sx={{
          '& .MuiPaper-root': {
            marginTop: 1,
            minWidth: 180,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            borderRadius: 2,
          },
        }}
      >
        <Stack spacing={0.5} sx={{ padding: 1 }}>
          <MenuItem onClick={() => handlePresetSelect('today')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Today
          </MenuItem>
          <MenuItem onClick={() => handlePresetSelect('yesterday')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Yesterday
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('thisWeek')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            This Week
          </MenuItem>
          <MenuItem onClick={() => handlePresetSelect('lastWeek')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Last Week
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('thisMonth')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            This Month
          </MenuItem>
          <MenuItem onClick={() => handlePresetSelect('lastMonth')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Last Month
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('thisYear')} sx={{ borderRadius: 1, fontSize: '14px' }}>
            This Year
          </MenuItem>
        </Stack>
      </Menu>
    </Box>
  );
}

// Export helper function and default range
export { getDateRange };
export const defaultDateRange = getDateRange('thisMonth');
