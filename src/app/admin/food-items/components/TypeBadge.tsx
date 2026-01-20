'use client';

import { Box, Typography } from '@mui/material';

type ItemType = 'simple' | 'portions' | 'combo';

interface TypeBadgeProps {
  type: ItemType;
}

const typeConfig = {
  simple: {
    label: 'Simple',
    color: '#4F8CFF',
    bgColor: '#E6F0FF',
  },
  portions: {
    label: 'Portions',
    color: '#9333EA',
    bgColor: '#F3E8FF',
  },
  combo: {
    label: 'Combo',
    color: '#FF9F0D',
    bgColor: '#FFF4E4',
  },
};

export default function TypeBadge({ type }: TypeBadgeProps) {
  const config = typeConfig[type] || typeConfig.simple;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        paddingX: 1.5,
        paddingY: 0.5,
        borderRadius: 1.5,
        backgroundColor: config.bgColor,
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: config.color,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          fontSize: '12px',
          fontWeight: 600,
          color: config.color,
        }}
      >
        {config.label}
      </Typography>
    </Box>
  );
}
