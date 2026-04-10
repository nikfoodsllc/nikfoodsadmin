'use client';

import { TableCell, TableRow, Skeleton } from '@mui/material';

export default function UserSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          {/* Name */}
          <TableCell>
            <Skeleton variant="text" width={140} />
          </TableCell>
          {/* Email */}
          <TableCell>
            <Skeleton variant="text" width={180} />
          </TableCell>
          {/* Phone */}
          <TableCell>
            <Skeleton variant="text" width={120} />
          </TableCell>
          {/* Registered On */}
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
