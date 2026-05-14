'use client';

import { Box, TableCell, TableRow, Skeleton } from '@mui/material';

export default function OrderSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          {/* Order Date */}
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
          {/* Order ID */}
          <TableCell>
            <Skeleton variant="text" width={140} />
          </TableCell>
          {/* Customer Name */}
          <TableCell>
            <Skeleton variant="text" width={120} />
          </TableCell>
          {/* Email */}
          <TableCell>
            <Skeleton variant="text" width={180} />
          </TableCell>
          {/* Order Status */}
          <TableCell>
            <Skeleton variant="rounded" width={100} height={28} />
          </TableCell>
          {/* Payment Status */}
          <TableCell>
            <Skeleton variant="rounded" width={90} height={28} />
          </TableCell>
          {/* Sub Total */}
          <TableCell>
            <Skeleton variant="text" width={70} />
          </TableCell>
          {/* Service Fee */}
          <TableCell>
            <Skeleton variant="text" width={70} />
          </TableCell>
          {/* Tax */}
          <TableCell>
            <Skeleton variant="text" width={70} />
          </TableCell>
          {/* Tip */}
          <TableCell>
            <Skeleton variant="text" width={70} />
          </TableCell>
          {/* Grand Total */}
          <TableCell>
            <Skeleton variant="text" width={70} />
          </TableCell>
          {/* Phone */}
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
          {/* Address */}
          <TableCell>
            <Skeleton variant="text" width={150} />
          </TableCell>
          {/* Apt. No. */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Gate Code */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Instruction to Driver */}
          <TableCell>
            <Skeleton variant="text" width={120} />
          </TableCell>
          {/* Deliver On */}
          <TableCell>
            <Skeleton variant="text" width={150} />
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
