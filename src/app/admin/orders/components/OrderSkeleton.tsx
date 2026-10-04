'use client';

import { TableCell, TableRow, Skeleton } from '@mui/material';
import { OrdersColumnDef } from './ordersColumns';

export default function OrderSkeleton({ columns }: { columns: OrdersColumnDef[] }) {
  return (
    <>
      {[...Array(10)].map((_, index) => (
        <TableRow key={index}>
          {columns.map((c) => (
            <TableCell key={c.key}>
              {c.skeleton === 'checkbox' ? (
                <Skeleton variant="rounded" width={20} height={20} />
              ) : c.skeleton === 'pill' ? (
                <Skeleton variant="rounded" width={c.skeletonWidth ?? 80} height={28} />
              ) : c.skeleton === 'button' ? (
                <Skeleton variant="rounded" width={c.skeletonWidth ?? 100} height={32} />
              ) : (
                <Skeleton variant="text" width={c.skeletonWidth ?? 80} />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
