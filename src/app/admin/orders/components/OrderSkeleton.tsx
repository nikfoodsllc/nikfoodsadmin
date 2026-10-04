'use client';

import { Box, TableCell, TableRow, Skeleton } from '@mui/material';

export default function OrderSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          {/* Select */}
          <TableCell>
            <Skeleton variant="rounded" width={20} height={20} />
          </TableCell>
          {/* Order Date */}
          <TableCell>
            <Skeleton variant="text" width={90} />
          </TableCell>
          {/* Order ID */}
          <TableCell>
            <Skeleton variant="text" width={130} />
          </TableCell>
          {/* Customer Name */}
          <TableCell>
            <Skeleton variant="text" width={110} />
          </TableCell>
          {/* Order Status */}
          <TableCell>
            <Skeleton variant="rounded" width={90} height={28} />
          </TableCell>
          {/* Payment Status */}
          <TableCell>
            <Skeleton variant="rounded" width={80} height={28} />
          </TableCell>
          {/* Instruction to Driver */}
          <TableCell>
            <Skeleton variant="text" width={110} />
          </TableCell>
          {/* Payment Method */}
          <TableCell>
            <Skeleton variant="text" width={80} />
          </TableCell>
          {/* Sub Total */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Service Fee */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Tax */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Tip */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Refunded Amt */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Grand Total */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Phone */}
          <TableCell>
            <Skeleton variant="text" width={90} />
          </TableCell>
          {/* Email */}
          <TableCell>
            <Skeleton variant="text" width={170} />
          </TableCell>
          {/* Address */}
          <TableCell>
            <Skeleton variant="text" width={140} />
          </TableCell>
          {/* Apt. No. */}
          <TableCell>
            <Skeleton variant="text" width={50} />
          </TableCell>
          {/* Gate Code */}
          <TableCell>
            <Skeleton variant="text" width={50} />
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
