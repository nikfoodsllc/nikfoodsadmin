'use client';

import { Box, TableCell, TableRow, Skeleton } from '@mui/material';

export default function OrderSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          {/* Order ID */}
          <TableCell>
            <Skeleton variant="text" width={140} />
          </TableCell>
          {/* Customer */}
          <TableCell>
            <Skeleton variant="text" width={120} />
          </TableCell>
          {/* Email */}
          <TableCell>
            <Skeleton variant="text" width={180} />
          </TableCell>
          {/* Created At */}
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
          {/* Order Status */}
          <TableCell>
            <Skeleton variant="rounded" width={100} height={28} />
          </TableCell>
          {/* Payment Status */}
          <TableCell>
            <Box>
              <Skeleton variant="rounded" width={90} height={28} sx={{ marginBottom: 0.5 }} />
              <Skeleton variant="text" width={80} />
            </Box>
          </TableCell>
          {/* Total */}
          <TableCell>
            <Skeleton variant="text" width={70} />
          </TableCell>
          {/* Actions */}
          <TableCell>
            <Skeleton variant="rounded" width={100} height={32} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
