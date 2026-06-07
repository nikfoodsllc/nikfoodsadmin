'use client';

import { Box, TableCell, TableRow, Skeleton } from '@mui/material';

export default function FoodItemSkeleton() {
  return (
    <>
      {[...Array(7)].map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton variant="rounded" width={80} height={80} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={120} />
          </TableCell>
          <TableCell>
            <Skeleton variant="rounded" width={70} height={24} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={200} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          <TableCell>
            <Skeleton variant="circular" width={24} height={24} />
          </TableCell>
          <TableCell>
            <Skeleton variant="circular" width={24} height={24} />
          </TableCell>
          <TableCell>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
            </Box>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
