'use client';

import { Fragment, ReactNode } from 'react';
import { Box, TableRow as MuiTableRow, TableCell, Typography, IconButton, Checkbox } from '@mui/material';
import { IconEdit, IconTrash, IconCopy  } from '@tabler/icons-react';
import Image from 'next/image';
import TypeBadge from './TypeBadge';
import PreparationBadge from './PreparationBadge';
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
  preparationType?: 'cooked' | 'ready_to_eat';
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

interface TableRowProps {
  item: FoodItem;
  index: number;
  /** Columns to show, in order. */
  columns: { key: string }[];
  onEdit: (item: FoodItem) => void;
  onDelete: (item: FoodItem) => void;
  onDuplicate: (item: FoodItem) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export default function TableRow({ item, index, columns, onEdit, onDelete, onDuplicate, selected, onToggleSelect }: TableRowProps) {
  const cells: Record<string, ReactNode> = {
    // Select (for the bulk preparation-type update)
    select: (
      <TableCell sx={{ padding: '4px', verticalAlign: 'middle' }}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={() => onToggleSelect(item._id)}
          inputProps={{ 'aria-label': `Select ${item.name}` }}
        />
      </TableCell>
    ),
    // Actions
    actions: (
            <TableCell sx={{ padding: '8px', verticalAlign: 'middle' }}>
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
                <IconButton
        size="small"
        onClick={() => onDuplicate(item)}
        sx={{
          color: '#7C3AED',
          '&:hover': {
            backgroundColor: '#F3E8FF',
          },
        }}
      >
        <IconCopy size={18} />
      </IconButton>
              </Box>
            </TableCell>
    ),
    // Available
    available: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
    ),
    // Image
    image: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle' }}>
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
    ),
    // Name
    name: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle' }}>
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
    ),
    // Price
    price: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
    ),
    // Veg Indicator
    veg: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
    ),
    // Type Badge
    type: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle' }}>
        <TypeBadge type={item.itemType} />
      </TableCell>
    ),
    // Preparation type: Cooked / Ready to eat / (not set yet)
    preparation: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle' }}>
        <PreparationBadge value={item.preparationType} />
      </TableCell>
    ),
    // Description
    description: (
      <TableCell sx={{ padding: '8px', verticalAlign: 'middle' }}>
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
    ),
  };

  return (
    <MuiTableRow
      sx={{
        backgroundColor: selected ? '#EEF2FF' : index % 2 === 0 ? '#F6FAFF' : '#fff',
        '&:hover': {
          backgroundColor: '#F9FAFB',
        },
      }}
    >
      {columns.map((c) => (
        <Fragment key={c.key}>{cells[c.key]}</Fragment>
      ))}
    </MuiTableRow>
  );
}
