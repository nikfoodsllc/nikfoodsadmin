'use client';

import { Box, Card, Skeleton } from '@mui/material';

export default function CategorySkeleton() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
      }}
    >
      {[...Array(8)].map((_, index) => (
        <Card
          key={index}
          sx={{
            width: 250,
            maxWidth: '100%',
            padding: 3,
            borderRadius: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Skeleton variant="circular" width={200} height={200} />
          <Skeleton variant="text" width="80%" height={28} />
          <Skeleton variant="text" width="100%" height={20} />
          <Skeleton variant="text" width="90%" height={20} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 1 }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Skeleton variant="circular" width={36} height={36} />
          </Box>
        </Card>
      ))}
    </Box>
  );
}
