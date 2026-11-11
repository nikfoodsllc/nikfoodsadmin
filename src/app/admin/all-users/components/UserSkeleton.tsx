'use client';

import { TableCell, TableRow, Skeleton } from '@mui/material';

export default function UserSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          {/* Tick box */}
          <TableCell sx={{ width: 48 }}>
            <Skeleton variant="rectangular" width={18} height={18} />
          </TableCell>
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
          {/* Texts */}
          <TableCell>
            <Skeleton variant="text" width={60} />
          </TableCell>
          {/* Emails */}
          <TableCell>
            <Skeleton variant="text" width={60} />
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
