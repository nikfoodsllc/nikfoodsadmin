'use client';

import { Box, Typography } from '@mui/material';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';

interface TrendIndicatorProps {
  value?: number;
  suffix?: string;
}

export default function TrendIndicator({ value, suffix = '%' }: TrendIndicatorProps) {
  // Handle undefined/null values to prevent toFixed error
  if (value === undefined || value === null || isNaN(value)) {
    return null;
  }

  const isPositive = value >= 0;
  const displayValue = Math.abs(value).toFixed(1);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        paddingX: 1,
        paddingY: 0.5,
        borderRadius: 1,
        backgroundColor: isPositive ? 'rgba(95, 208, 104, 0.1)' : 'rgba(255, 118, 117, 0.1)',
      }}
    >
      {isPositive ? (
        <IconArrowUp size={14} color="#5FD068" />
      ) : (
        <IconArrowDown size={14} color="#FF7675" />
      )}
      <Typography
        variant="caption"
        sx={{
          fontSize: '11px',
          fontWeight: 600,
          color: isPositive ? '#5FD068' : '#FF7675',
        }}
      >
        {displayValue}{suffix}
      </Typography>
    </Box>
  );
}
