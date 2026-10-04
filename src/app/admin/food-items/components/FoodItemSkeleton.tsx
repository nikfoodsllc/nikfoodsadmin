'use client';

import { Box, TableCell, TableRow, Skeleton } from '@mui/material';
import { FoodItemsColumnDef } from './foodItemsColumns';

export default function FoodItemSkeleton({ columns }: { columns: FoodItemsColumnDef[] }) {
  return (
    <>
      {[...Array(7)].map((_, index) => (
        <TableRow key={index}>
          {columns.map((c) => (
            <TableCell key={c.key}>
              {c.skeleton === 'circles' ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="circular" width={28} height={28} />
                </Box>
              ) : c.skeleton === 'image' ? (
                <Skeleton variant="rounded" width={80} height={80} />
              ) : c.skeleton === 'pill' ? (
                <Skeleton variant="rounded" width={c.skeletonWidth ?? 70} height={24} />
              ) : (
                <Skeleton variant="text" width={c.skeletonWidth ?? 100} />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
