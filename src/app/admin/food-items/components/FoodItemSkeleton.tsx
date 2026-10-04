'use client';

import { Box, TableCell, TableRow, Skeleton } from '@mui/material';

export default function FoodItemSkeleton() {
  return (
    <>
      {[...Array(7)].map((_, index) => (
        <TableRow key={index}>
          {/* Actions */}
          <TableCell>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
            </Box>
          </TableCell>
          {/* Available */}
          <TableCell>
            <Skeleton variant="rounded" width={90} height={24} />
          </TableCell>
          {/* Image */}
          <TableCell>
            <Skeleton variant="rounded" width={80} height={80} />
          </TableCell>
          {/* Name */}
          <TableCell>
            <Skeleton variant="text" width={120} />
          </TableCell>
          {/* Price */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Veg/Non-Veg */}
          <TableCell>
            <Skeleton variant="rounded" width={70} height={24} />
          </TableCell>
          {/* Type */}
          <TableCell>
            <Skeleton variant="rounded" width={70} height={24} />
          </TableCell>
          {/* Description */}
          <TableCell>
            <Skeleton variant="text" width={200} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
