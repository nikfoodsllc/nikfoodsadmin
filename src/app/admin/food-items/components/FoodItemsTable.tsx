'use client';

import { useMemo, useRef } from 'react';
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
} from '@mui/material';
import TableRowComponent from './TableRow';
import FoodItemSkeleton from './FoodItemSkeleton';
import ResizableHeaderCell from '@/components/table/ResizableHeaderCell';
import { useLiveColumnResize } from '@/hooks/useLiveColumnResize';
import { FoodItemsColumnDef } from './foodItemsColumns';

interface FoodItem {
  _id: string;
  name: string;
  description?: string;
  short_description?: string;
  price?: number;
  category: string[];
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'simple' | 'portions' | 'combo';
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  isDraft?: boolean;
  // Portions
  portions?: string[];
  portionPrices?: number[];

  // Combo
  sections?: Array<{
    title: string;
    selectedItems: Array<{
      item: string;
      portion?: string;
      price: number;
    }>;
  }>;
}

interface FoodItemsTableProps {
  items: FoodItem[];
  loading: boolean;

  /** Columns to show, in order (hidden ones already removed). */
  columns: FoodItemsColumnDef[];
  widths: Record<string, number>;
  totalWidth: number;
  onColumnResize: (key: string, width: number) => void;
  onColumnReset: (key: string) => void;

  onEdit: (item: FoodItem) => void;
  onDelete: (item: FoodItem) => void;

  // ADD THIS
  onDuplicate: (item: FoodItem) => void;
}

export default function FoodItemsTable({
  items,
  loading,
  columns,
  widths,
  totalWidth,
  onColumnResize,
  onColumnReset,
  onEdit,
  onDelete,
  onDuplicate,
}: FoodItemsTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const visibleKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);
  const handleLiveResize = useLiveColumnResize(tableRef, widths, totalWidth);

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
            // text that does not fit is cut; names and descriptions wrap / clamp inside their own cells
            '& .MuiTableCell-root': { overflow: 'hidden', textOverflow: 'ellipsis' },
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
              {columns.map((c) =>
                c.locked ? (
                  <TableCell
                    key={c.key}
                    sx={{ padding: '12px 8px', fontWeight: 600, color: '#374151', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    {c.label}
                  </TableCell>
                ) : (
                  <ResizableHeaderCell
                    key={c.key}
                    column={c}
                    width={widths[c.key] ?? c.defaultWidth}
                    onLiveResize={handleLiveResize}
                    onResizeEnd={onColumnResize}
                    onReset={onColumnReset}
                  />
                )
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <FoodItemSkeleton columns={columns} />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                  <Typography variant="body2" color="text.secondary">
                    No food items found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRowComponent
                  key={item._id}
                  item={item}
                  index={index}
                  visible={visibleKeys}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
