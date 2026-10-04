'use client';

import { useRef } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Checkbox,
} from '@mui/material';
import OrderTableRow from './OrderTableRow';
import OrderSkeleton from './OrderSkeleton';
import ResizableHeaderCell from '@/components/table/ResizableHeaderCell';
import { OrdersColumnDef } from './ordersColumns';
import { Order } from '@/types/order';
import { useLiveColumnResize } from '@/hooks/useLiveColumnResize';

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
  onViewDetails: (order: Order) => void;
  /** Columns to show, in order (hidden ones already removed). */
  columns: OrdersColumnDef[];
  widths: Record<string, number>;
  totalWidth: number;
  onColumnResize: (key: string, width: number) => void;
  onColumnReset: (key: string) => void;
  selectedOrderIds: Set<string>;
  onSelectAll: () => void;
  onSelectOrder: (orderId: string) => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  disableSelection?: boolean;
}

export default function OrdersTable({
  orders,
  loading,
  onViewDetails,
  columns,
  widths,
  totalWidth,
  onColumnResize,
  onColumnReset,
  selectedOrderIds,
  onSelectAll,
  onSelectOrder,
  isAllSelected,
  isIndeterminate,
  disableSelection = false,
}: OrdersTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const handleLiveResize = useLiveColumnResize(tableRef, widths, totalWidth);

  const plainHeaderSx = { padding: '12px 8px', fontWeight: 600, color: '#374151', fontSize: '13px', whiteSpace: 'nowrap' } as const;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          width: 'max-content',
          borderRadius: 3,
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
      >
        <Table
          ref={tableRef}
          style={{ width: totalWidth }}
          sx={{
            tableLayout: 'fixed',
            '& .MuiTableCell-root': { overflow: 'hidden', textOverflow: 'ellipsis' },
            '& tbody .MuiTableCell-root': { whiteSpace: 'nowrap' },
            '& tbody .MuiTableCell-root .MuiTypography-root': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          }}
        >
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} data-col={c.key} style={{ width: widths[c.key] ?? c.defaultWidth }} />
            ))}
          </colgroup>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: '#F9FAFB',
              }}
            >
              {columns.map((c) => {
                if (c.key === 'select') {
                  return (
                    <TableCell key={c.key} sx={{ padding: '12px 8px' }}>
                      <Checkbox
                        checked={isAllSelected}
                        indeterminate={isIndeterminate}
                        onChange={onSelectAll}
                        disabled={loading || orders.length === 0 || disableSelection}
                        sx={{
                          color: '#9CA3AF',
                          '&.Mui-checked': {
                            color: '#4F8CFF',
                          },
                          '&.MuiCheckbox-indeterminate': {
                            color: '#4F8CFF',
                          },
                        }}
                      />
                    </TableCell>
                  );
                }
                if (c.locked) {
                  return (
                    <TableCell key={c.key} sx={plainHeaderSx}>
                      {c.label}
                    </TableCell>
                  );
                }
                return (
                  <ResizableHeaderCell
                    key={c.key}
                    column={c}
                    width={widths[c.key] ?? c.defaultWidth}
                    onLiveResize={handleLiveResize}
                    onResizeEnd={onColumnResize}
                    onReset={onColumnReset}
                  />
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <OrderSkeleton columns={columns} />
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                  <Typography variant="body2" color="text.secondary">
                    No orders found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order, index) => (
                <OrderTableRow
                  key={order._id || order.orderId}
                  order={order}
                  index={index}
                  onViewDetails={onViewDetails}
                  columns={columns}
                  selected={Boolean(order._id && selectedOrderIds.has(order._id))}
                  onToggleSelect={onSelectOrder}
                  disableSelection={disableSelection || !order._id}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
