'use client';

import { Box, Card, Skeleton, Stack } from '@mui/material';

export default function DashboardSkeleton() {
  return (
    <Box>
      {/* Header Skeleton */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 2 }}>
        <Skeleton variant="text" width={200} height={32} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Skeleton variant="rounded" width={150} height={40} />
          <Skeleton variant="rounded" width={40} height={40} />
        </Box>
      </Box>

      {/* Platform Stats Section - 3 cards */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={150} height={28} sx={{ marginBottom: 2 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              sx={{
                padding: 2.5,
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Skeleton variant="rounded" width={48} height={48} />
              </Box>
              <Skeleton variant="text" width="60%" height={20} sx={{ marginBottom: 1 }} />
              <Skeleton variant="text" width="40%" height={32} />
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Order Stats Section - 3 cards */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={150} height={28} sx={{ marginBottom: 2 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              sx={{
                padding: 2.5,
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Skeleton variant="rounded" width={48} height={48} />
                {i <= 2 && <Skeleton variant="rounded" width={60} height={24} />}
              </Box>
              <Skeleton variant="text" width="60%" height={20} sx={{ marginBottom: 1 }} />
              <Skeleton variant="text" width="40%" height={32} />
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Revenue Stats Section - 4 cards */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={150} height={28} sx={{ marginBottom: 2 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              sx={{
                padding: 2.5,
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Skeleton variant="rounded" width={48} height={48} />
                {i === 1 && <Skeleton variant="rounded" width={60} height={24} />}
              </Box>
              <Skeleton variant="text" width="70%" height={20} sx={{ marginBottom: 1 }} />
              <Skeleton variant="text" width="50%" height={32} />
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Customer & Order Insights - 2 cards */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={200} height={28} sx={{ marginBottom: 2 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          }}
        >
          {[1, 2].map((i) => (
            <Card
              key={i}
              sx={{
                padding: 2.5,
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Skeleton variant="rounded" width={48} height={48} />
                {i === 1 && <Skeleton variant="rounded" width={60} height={24} />}
              </Box>
              <Skeleton variant="text" width="70%" height={20} sx={{ marginBottom: 1 }} />
              <Skeleton variant="text" width="50%" height={32} />
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Top Selling Items Skeleton */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={150} height={28} sx={{ marginBottom: 2 }} />
        <Card sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', overflow: 'hidden' }}>
          <Box sx={{ padding: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
            <Skeleton variant="text" width="100%" height={20} />
          </Box>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <Box
              key={i}
              sx={{
                padding: 2,
                borderBottom: i < 10 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <Skeleton variant="text" width="100%" height={20} />
            </Box>
          ))}
        </Card>
      </Box>

      {/* Payment Methods - 2 cards */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={150} height={28} sx={{ marginBottom: 2 }} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          }}
        >
          {[1, 2].map((i) => (
            <Card
              key={i}
              sx={{
                padding: 2.5,
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginBottom: 2 }}>
                <Skeleton variant="rounded" width={40} height={40} />
                <Skeleton variant="text" width={100} height={20} />
              </Box>
              <Skeleton variant="text" width="60%" height={32} sx={{ marginBottom: 0.5 }} />
              <Skeleton variant="text" width="40%" height={16} />
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Status Breakdown */}
      <Box sx={{ marginBottom: 4 }}>
        <Skeleton variant="text" width={200} height={28} sx={{ marginBottom: 2 }} />
        <Card sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Box
                key={i}
                sx={{
                  flex: { xs: '1 1 100%', sm: '1 1 50%', md: '1 1 25%' },
                  padding: '20px',
                  textAlign: 'center',
                  borderRight: { xs: 'none', md: i < 4 ? '1px solid #f0f0f0' : 'none' },
                  borderBottom: { xs: i < 7 ? '1px solid #f0f0f0' : 'none', md: i < 5 ? '1px solid #f0f0f0' : 'none' },
                }}
              >
                <Skeleton
                  variant="circular"
                  width={48}
                  height={48}
                  sx={{ margin: '0 auto 12px' }}
                />
                <Skeleton variant="text" width="60%" height={16} sx={{ margin: '0 auto' }} />
              </Box>
            ))}
          </Stack>
        </Card>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
          paddingTop: 3,
          borderTop: '1px solid #e0e0e0',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Skeleton variant="text" width={180} height={20} />
        <Skeleton variant="text" width={220} height={20} />
      </Box>
    </Box>
  );
}
