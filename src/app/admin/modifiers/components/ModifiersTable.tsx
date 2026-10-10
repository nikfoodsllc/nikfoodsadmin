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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
} from '@mui/material';
import { IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import TablePagination from '../../food-items/components/TablePagination';
import type { PageSize } from '@/utils/pageSize';
import { FoodModifier, ModifierItemType } from '@/types/modifier';

interface ModifiersTableProps {
  modifiers: FoodModifier[];
  loading: boolean;
  searchQuery: string;
  itemTypeFilter: ModifierItemType | 'all';
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  onSearch: (query: string) => void;
  onItemTypeFilter: (itemType: ModifierItemType | 'all') => void;
  onPageChange: (page: number) => void;
  onEdit: (modifier: FoodModifier) => void;
  onDelete: (modifier: FoodModifier) => void;
}

// Helper function to get item type badge color
const getItemTypeColor = (itemType: ModifierItemType): string => {
  switch (itemType) {
    case 'simple':
      return '#10B981';
    case 'portions':
      return '#F59E0B';
    case 'combo':
      return '#8B5CF6';
    case 'all':
      return '#4F8CFF';
    default:
      return '#666';
  }
};

// Helper function to get item type label
const getItemTypeLabel = (itemType: ModifierItemType): string => {
  switch (itemType) {
    case 'simple':
      return 'Simple';
    case 'portions':
      return 'Portions';
    case 'combo':
      return 'Combo';
    case 'all':
      return 'All Items';
    default:
      return itemType;
  }
};

export default function ModifiersTable({
  modifiers,
  loading,
  searchQuery,
  itemTypeFilter,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageSizeChange,
  onSearch,
  onItemTypeFilter,
  onPageChange,
  onEdit,
  onDelete,
}: ModifiersTableProps) {
  return (
    <Box>
      {/* Filters */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          marginBottom: 3,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <TextField
          placeholder="Search modifiers..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          size="small"
          sx={{
            flex: 1,
            minWidth: 250,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
          InputProps={{
            startAdornment: <IconSearch size={20} color="#666" style={{ marginRight: 8 }} />,
          }}
        />

        {/* Item Type Filter */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Item Type</InputLabel>
          <Select
            value={itemTypeFilter}
            label="Item Type"
            onChange={(e) => onItemTypeFilter(e.target.value as ModifierItemType | 'all')}
            sx={{ backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="simple">Simple Items</MenuItem>
            <MenuItem value="portions">Portions Items</MenuItem>
            <MenuItem value="combo">Combo Items</MenuItem>
            <MenuItem value="all">All Items</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            minWidth: 900,
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
                  Name
                </TableCell>
                <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Description
                </TableCell>
                <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Item Type
                </TableCell>
                <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Price
                </TableCell>
                <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Available
                </TableCell>
                <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Default
                </TableCell>
                <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                  Order
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                    <Typography variant="body2" color="text.secondary">
                      Loading modifiers...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : modifiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery || itemTypeFilter !== 'all'
                        ? 'No modifiers found matching your filters'
                        : 'No modifiers found. Click "Add Modifier" to create one.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                modifiers.map((modifier) => (
                  <TableRow
                    key={modifier._id?.toString()}
                    sx={{
                      '&:hover': {
                        backgroundColor: '#F9FAFB',
                      },
                    }}
                  >
                    <TableCell sx={{ padding: '12px' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => onEdit(modifier)}
                          sx={{
                            color: '#4F8CFF',
                            '&:hover': {
                              backgroundColor: '#E6F0FF',
                            },
                          }}
                        >
                          <IconEdit size={18} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => onDelete(modifier)}
                          sx={{
                            color: '#EF4444',
                            '&:hover': {
                              backgroundColor: '#FEF2F2',
                            },
                          }}
                        >
                          <IconTrash size={18} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                        {modifier.name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#6B7280',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {modifier.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Chip
                        label={getItemTypeLabel(modifier.itemType)}
                        size="small"
                        sx={{
                          backgroundColor: `${getItemTypeColor(modifier.itemType)}20`,
                          color: getItemTypeColor(modifier.itemType),
                          fontWeight: 500,
                          fontSize: '12px',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                        ${modifier.price.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Chip
                        label={modifier.available ? 'Yes' : 'No'}
                        size="small"
                        sx={{
                          backgroundColor: modifier.available ? '#D1FAE5' : '#FEE2E2',
                          color: modifier.available ? '#065F46' : '#991B1B',
                          fontWeight: 500,
                          fontSize: '12px',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Chip
                        label={modifier.isDefault ? 'Yes' : 'No'}
                        size="small"
                        sx={{
                          backgroundColor: modifier.isDefault ? '#D1FAE5' : '#F3F4F6',
                          color: modifier.isDefault ? '#065F46' : '#6B7280',
                          fontWeight: 500,
                          fontSize: '12px',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
                        {modifier.sequence ?? 0}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Pagination */}
      {!loading && totalItems > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          totalItems={totalItems}
        />
      )}
    </Box>
  );
}
