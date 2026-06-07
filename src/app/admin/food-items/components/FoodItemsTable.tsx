'use client';

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

  onEdit: (item: FoodItem) => void;
  onDelete: (item: FoodItem) => void;

  // ADD THIS
  onDuplicate: (item: FoodItem) => void;
}

export default function FoodItemsTable({
  items,
  loading,
  onEdit,
  onDelete,
  onDuplicate,
}: FoodItemsTableProps) {
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          minWidth: 1790,
          borderRadius: 3,
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: '#F9FAFB',
              }}
            >
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Actions
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Image
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Name
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Type
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Description
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Price
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Veg
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Available
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <FoodItemSkeleton />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', padding: '48px 16px' }}>
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
