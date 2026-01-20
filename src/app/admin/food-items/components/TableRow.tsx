'use client';

import { Box, TableRow as MuiTableRow, TableCell, Typography, Chip, IconButton } from '@mui/material';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import Image from 'next/image';
import TypeBadge from './TypeBadge';
import { safeFormatCurrency } from '@/utils/currency';

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

interface Category {
  _id: string;
  name: string;
}

interface TableRowProps {
  item: FoodItem;
  categories: Category[];
  index: number;
  onEdit: (item: FoodItem) => void;
  onDelete: (item: FoodItem) => void;
}

export default function TableRow({ item, categories, index, onEdit, onDelete }: TableRowProps) {
  // Get category names from IDs
  const getCategoryNames = () => {
    return item.category
      .map((catId) => {
        const cat = categories.find((c) => c._id === catId);
        return cat?.name || '';
      })
      .filter((name) => name);
  };

  const categoryNames = getCategoryNames();

  return (
    <MuiTableRow
      sx={{
        backgroundColor: index % 2 === 0 ? '#F6FAFF' : '#fff',
        '&:hover': {
          backgroundColor: '#F9FAFB',
        },
      }}
    >
      {/* Image */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: '#F3F4F6',
            border: '1px solid #E5E7EB',
          }}
        >
          {item.url ? (
            <Image src={item.url} alt={item.name} fill style={{ objectFit: 'cover' }} />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                No image
              </Typography>
            </Box>
          )}
        </Box>
      </TableCell>

      {/* Name */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            mb: 0.5,
          }}
        >
          {item.name}
        </Typography>
      </TableCell>

      {/* Type Badge */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        <TypeBadge type={item.itemType} />
      </TableCell>

      {/* Description */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle', maxWidth: 250 }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.5,
          }}
        >
          {item.description || 'No description'}
        </Typography>
      </TableCell>

      {/* Price */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        {item.itemType === 'portions' && item.portionPrices && item.portionPrices.length > 0 ? (
          <Box>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              {safeFormatCurrency(item.portionPrices && item.portionPrices.length > 0 ? Math.min(...item.portionPrices) : 0)} - {safeFormatCurrency(item.portionPrices && item.portionPrices.length > 0 ? Math.max(...item.portionPrices) : 0)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              {item.portions?.length || 0} portions
            </Typography>
          </Box>
        ) : item.itemType === 'combo' ? (
          <Box>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              {safeFormatCurrency(item.price)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              Base price
            </Typography>
          </Box>
        ) : (
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            {safeFormatCurrency(item.price)}
          </Typography>
        )}
      </TableCell>

      {/* Categories */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle', maxWidth: 200 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {categoryNames.length > 0 ? (
            categoryNames.map((name, index) => (
              <Chip
                key={index}
                label={name}
                size="small"
                sx={{
                  fontSize: '11px',
                  fontWeight: 500,
                  height: 22,
                  backgroundColor: '#E6F0FF',
                  color: '#4F8CFF',
                  '& .MuiChip-label': {
                    paddingX: 1,
                  },
                }}
              />
            ))
          ) : (
            <Typography variant="caption" color="text.secondary">
              No categories
            </Typography>
          )}
        </Box>
      </TableCell>

      {/* Veg Indicator */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            paddingX: 1.5,
            paddingY: 0.5,
            borderRadius: 1.5,
            backgroundColor: item.veg ? '#ECFDF5' : '#FEE2E2',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: item.veg ? '#10B981' : '#EF4444',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontSize: '12px',
              fontWeight: 600,
              color: item.veg ? '#10B981' : '#EF4444',
            }}
          >
            {item.veg ? 'Veg' : 'Non-Veg'}
          </Typography>
        </Box>
      </TableCell>

      {/* Available */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            paddingX: 1.5,
            paddingY: 0.5,
            borderRadius: 1.5,
            backgroundColor: item.available ? '#ECFDF5' : '#FEF3F2',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: item.available ? '#10B981' : '#F97316',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontSize: '12px',
              fontWeight: 600,
              color: item.available ? '#10B981' : '#F97316',
            }}
          >
            {item.available ? 'Available' : 'Unavailable'}
          </Typography>
        </Box>
      </TableCell>

      {/* Status - Draft Badge */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        {item.isDraft && (
          <Chip
            label="Draft"
            size="small"
            sx={{
              fontSize: '11px',
              fontWeight: 600,
              height: 24,
              backgroundColor: '#6B7280',
              color: 'white',
              '& .MuiChip-label': {
                paddingX: 1,
              },
            }}
          />
        )}
      </TableCell>

      {/* Actions */}
      <TableCell sx={{ padding: '12px', verticalAlign: 'middle' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onEdit(item)}
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
            onClick={() => onDelete(item)}
            sx={{
              color: '#EF4444',
              '&:hover': {
                backgroundColor: '#FEE2E2',
              },
            }}
          >
            <IconTrash size={18} />
          </IconButton>
        </Box>
      </TableCell>
    </MuiTableRow>
  );
}
