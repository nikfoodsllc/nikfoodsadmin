'use client';

import { Box, TextField, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface CustomDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function CustomDateRangePicker({ value, onChange }: CustomDateRangePickerProps) {
  const handleStartDateChange = (newDate: Date | null) => {
    if (newDate) {
      onChange({
        ...value,
        startDate: newDate,
      });
    }
  };

  const handleEndDateChange = (newDate: Date | null) => {
    if (newDate) {
      onChange({
        ...value,
        endDate: newDate,
      });
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box>
          <Typography
            variant="caption"
            sx={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#6B7280',
              marginBottom: 0.5,
              display: 'block',
            }}
          >
            From Date
          </Typography>
          <DatePicker
            value={value.startDate}
            onChange={handleStartDateChange}
            slotProps={{
              textField: {
                size: 'small',
                sx: {
                  width: '160px',
                  '& .MuiInputBase-input': {
                    fontSize: '14px',
                  },
                },
              },
            }}
            format="MMM dd, yyyy"
          />
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#6B7280',
              marginBottom: 0.5,
              display: 'block',
            }}
          >
            To Date
          </Typography>
          <DatePicker
            value={value.endDate}
            onChange={handleEndDateChange}
            slotProps={{
              textField: {
                size: 'small',
                sx: {
                  width: '160px',
                  '& .MuiInputBase-input': {
                    fontSize: '14px',
                  },
                },
              },
            }}
            format="MMM dd, yyyy"
            minDate={value.startDate}
          />
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
