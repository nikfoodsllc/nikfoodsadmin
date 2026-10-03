'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Divider,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material';
import { IconCalendar, IconChevronDown } from '@tabler/icons-react';
import {
  type DateRange,
  type DateRangePreset,
  getDateRange,
  getCustomDateRange,
  toDay,
  defaultDateRange,
} from '@/utils/dateRanges';

export type { DateRange, DateRangePreset };

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customError, setCustomError] = useState('');
  const isCustom = !value.preset;

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

  const handleCustomOpen = () => {
    // Start from the range that is showing now, so a small adjustment is quick
    setCustomStart(toDay(value.startDate));
    setCustomEnd(toDay(value.endDate));
    setCustomError('');
    setCustomOpen(true);
    handleClose();
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) {
      setCustomError('Choose both a start date and an end date.');
      return;
    }
    const range = getCustomDateRange(customStart, customEnd);
    if (!range) {
      setCustomError('The end date must be on or after the start date.');
      return;
    }
    onChange(range);
    setCustomOpen(false);
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
          borderColor: isCustom ? '#4F8CFF' : '#e0e0e0',
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
          <MenuItem onClick={handleCustomOpen} selected={isCustom} sx={{ borderRadius: 1, fontSize: '14px', fontWeight: 600 }}>
            Custom range…
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('today')} selected={value.preset === 'today'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Today
          </MenuItem>
          <MenuItem onClick={() => handlePresetSelect('yesterday')} selected={value.preset === 'yesterday'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Yesterday
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('thisWeek')} selected={value.preset === 'thisWeek'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            This Week
          </MenuItem>
          <MenuItem onClick={() => handlePresetSelect('lastWeek')} selected={value.preset === 'lastWeek'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Last Week
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('thisMonth')} selected={value.preset === 'thisMonth'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            This Month
          </MenuItem>
          <MenuItem onClick={() => handlePresetSelect('lastMonth')} selected={value.preset === 'lastMonth'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            Last Month
          </MenuItem>
          <Divider sx={{ marginY: 0.5 }} />
          <MenuItem onClick={() => handlePresetSelect('thisYear')} selected={value.preset === 'thisYear'} sx={{ borderRadius: 1, fontSize: '14px' }}>
            This Year
          </MenuItem>
        </Stack>
      </Menu>

      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Custom date range</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#6B7280', marginBottom: 2 }}>
            Both days are included. Your choice is remembered until you change it.
          </Typography>
          <Stack spacing={2} sx={{ marginTop: 1 }}>
            <TextField
              label="Start date"
              type="date"
              size="small"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setCustomError('');
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="End date"
              type="date"
              size="small"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setCustomError('');
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!customError}
              helperText={customError}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ paddingX: 3, paddingBottom: 2 }}>
          <Button onClick={() => setCustomOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleCustomApply} variant="contained" sx={{ textTransform: 'none' }}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Re-exported so existing imports keep working
export { getDateRange, defaultDateRange };
