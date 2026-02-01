'use client';

import { Box, Card, Typography } from '@mui/material';
import { TablerIcon } from '@tabler/icons-react';
import TrendIndicator from './TrendIndicator';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: TablerIcon;
  iconColor: string;
  iconBgColor: string;
  trend?: number;
  suffix?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBgColor,
  trend,
  suffix,
}: StatCardProps) {
  return (
    <Card
      sx={{
        padding: 2.5,
        borderRadius: 3,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 2,
            backgroundColor: iconBgColor,
          }}
        >
          <Icon size={24} color={iconColor} />
        </Box>
        {trend !== undefined && <TrendIndicator value={trend} suffix={suffix} />}
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#666',
          marginBottom: 0.5,
        }}
      >
        {title}
      </Typography>

      <Typography
        variant="h4"
        sx={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#111',
        }}
      >
        {value}
      </Typography>
    </Card>
  );
}
