'use client';

import { Box, Skeleton } from '@mui/material';

// Same shape as CategoryTable: a label column, then one column per category with its sub-categories underneath.
const COLUMN_WIDTH = 250;
const BORDER = '1px solid #E5E7EB';
const labelSx = {
  flexShrink: 0,
  boxSizing: 'border-box',
  bgcolor: '#F9FAFB',
  width: { xs: 104, sm: 132 },
  px: { xs: 1, sm: 2 },
  py: 1.5,
  borderRight: BORDER,
} as const;

export default function CategorySkeleton() {
  const columns = [...Array(4)];
  return (
    <Box
      aria-busy="true"
      aria-label="Loading categories"
      sx={{ overflowX: 'auto', bgcolor: '#fff', border: BORDER, borderRadius: 2, maxWidth: '100%' }}
    >
      <Box sx={{ width: 'max-content', minWidth: '100%' }}>
        <Box sx={{ display: 'flex', borderBottom: '2px solid #111827' }}>
          <Box sx={labelSx}>
            <Skeleton variant="text" width="80%" height={22} />
          </Box>
          {columns.map((_, index) => (
            <Box key={index} sx={{ width: COLUMN_WIDTH, flexShrink: 0, boxSizing: 'border-box', p: 1.5, borderRight: BORDER }}>
              <Skeleton variant="text" width="70%" height={24} />
              <Skeleton variant="rounded" width={64} height={20} sx={{ mt: 0.5 }} />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex' }}>
          <Box sx={{ ...labelSx, alignSelf: 'stretch' }}>
            <Skeleton variant="text" width="90%" height={22} />
          </Box>
          {columns.map((_, index) => (
            <Box key={index} sx={{ width: COLUMN_WIDTH, flexShrink: 0, boxSizing: 'border-box', borderRight: BORDER }}>
              {[...Array(4)].map((__, row) => (
                <Box key={row} sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: BORDER }}>
                  <Skeleton variant="rounded" width={44} height={44} sx={{ flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="75%" height={22} />
                    <Skeleton variant="rounded" width={52} height={18} sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
