'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Box,
  Chip,
  CardMedia,
} from '@mui/material';
import {
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconSortDescending,
  IconListDetails,
} from '@tabler/icons-react';
import { FoodCategory, CategoryListingType, CategoryDayWiseItem } from '@/types/order';
import { formatDateWithDay } from '@/utils/days';

interface CategoryCardProps {
  category: FoodCategory;
  onEdit: (category: FoodCategory) => void;
  onDelete: (category: FoodCategory) => void;
  onRefresh: () => void;
  onItemSequence: (category: FoodCategory) => void;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400';

export default function CategoryCard({ category, onEdit, onDelete, onRefresh, onItemSequence }: CategoryCardProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    onEdit(category);
  };

  const handleDelete = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    onDelete(category);
  };

  const handleItemSequence = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    onItemSequence(category);
  };

  const handleManageItems = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    router.push(`/admin/food-category/${category._id?.toString()}/items`);
  };

  const handleCardClick = () => {
    onEdit(category);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Helper functions for item counts
  const getItemCount = () => {
    // Use itemCount from API if available
    if (category.itemCount !== undefined) {
      return category.itemCount;
    }

    // Fallback to calculating for day-wise categories
    if (category.listingType === 'day-wise' && category.dayWiseItems) {
      return category.dayWiseItems.reduce((total, dayItem) => total + dayItem.items.length, 0);
    }

    return 0;
  };

  const getDayWiseItemCount = () => {
    if (!category.dayWiseItems || category.listingType !== 'day-wise') return 0;
    return category.dayWiseItems.reduce((total, dayItem) => total + dayItem.items.length, 0);
  };

  const getDayWiseItemBreakdown = () => {
    if (!category.dayWiseItems || category.listingType !== 'day-wise') return '';
    const daysWithItems = category.dayWiseItems
      .filter(dayItem => dayItem.items.length > 0)
      .map(dayItem => {
        const dayName = formatDateWithDay(dayItem.day).split(' ')[0]; // Extract day name (e.g., "Sat")
        return `${dayName} (${dayItem.items.length})`;
      });
    return daysWithItems.join(', ');
  };

  const getListingTypeColor = (listingType?: CategoryListingType) => {
    switch (listingType) {
      case 'day-wise':
        return '#8B5CF6'; // Purple
      case 'flat':
      default:
        return '#10B981'; // Green
    }
  };

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        width: 280,
        maxWidth: '100%',
        height: 340,
        borderRadius: 3,
        backgroundColor: '#FFF4E4',
        boxShadow: '3px 3px 10px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        '&:hover': {
          backgroundColor: '#FF9F0D',
          transform: 'translateY(-5px)',
          boxShadow: '3px 8px 15px rgba(0, 0, 0, 0.15)',
          '& .card-text': {
            color: '#fff',
          },
          '& .action-button': {
            color: '#fff',
            borderColor: '#fff',
          },
          '& .category-badge': {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            color: '#2A1A0C',
          },
          '& .category-badge:hover': {
            backgroundColor: 'rgba(217, 119, 6, 1) !important',
            transform: 'scale(1.05)',
          },
        },
      }}
    >
      {/* Top 60% - Image Section */}
      <Box
        sx={{
          height: '60%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5',
        }}
      >
        {/* Category Image - Rectangular */}
        <CardMedia
          component="img"
          image={category.url || DEFAULT_IMAGE}
          alt={category.name}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Sequence Badge - Top Right Fixed */}
        <Chip
          label={`#${category.sequence || 0}`}
          size="small"
          className="category-badge"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(79, 140, 255, 0.95)',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
            minWidth: 30,
            zIndex: 2,
            transition: 'all 0.3s ease',
          }}
        />

        {/* Listing Type Badge - Top Left Fixed */}
        {category.listingType && (
          <Chip
            label={category.listingType === 'day-wise' ? 'Day-wise' : 'Flat'}
            size="small"
            icon={category.listingType === 'day-wise' ? <IconCalendar size={12} /> : undefined}
            className="category-badge"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: `${getListingTypeColor(category.listingType)}E6`, // Add opacity
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
              minWidth: 65,
              zIndex: 2,
              transition: 'all 0.3s ease',
              '& .MuiChip-icon': {
                color: 'white',
                fontSize: '12px',
              },
            }}
          />
        )}

        {/* Draft Badge - Below Type Badge */}
        {category.isDraft && (
          <Chip
            label="Draft"
            size="small"
            className="category-badge"
            sx={{
              position: 'absolute',
              top: 35,
              left: 8,
              backgroundColor: 'rgba(107, 114, 128, 0.95)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
              minWidth: 48,
              zIndex: 2,
              transition: 'all 0.3s ease',
            }}
          />
        )}
      </Box>

      {/* Bottom 40% - Content Section */}
      <Box
        sx={{
          height: '40%',
          padding: 2,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Category Name - Single Line with Truncation */}
        <Typography
          variant="h6"
          className="card-text"
          sx={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#2A1A0C',
            transition: 'color 0.3s ease',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 0.5,
            paddingRight: 3, // Increased to avoid conflict with right-side elements
            lineHeight: 1.2,
          }}
          title={category.name}
        >
          {category.name}
        </Typography>

        {/* Category Description - Single line with ellipsis */}
        {category.description && (
          <Typography
            variant="body2"
            className="card-text"
            sx={{
              fontSize: '0.75rem',
              color: '#666',
              transition: 'color 0.3s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 0.5,
              lineHeight: 1.2,
            }}
            title={category.description}
          >
            {category.description}
          </Typography>
        )}

        {/* Item Count Badge - Top Right (below sequence badge) */}
        {getItemCount() > 0 && (
          <Chip
            label={`${getItemCount()} ${getItemCount() === 1 ? 'item' : 'items'}`}
            size="small"
            className="category-badge"
            onClick={(e) => {
              e.stopPropagation();
              handleManageItems(e);
            }}
            sx={{
              position: 'absolute',
              top: 35,
              right: 8,
              backgroundColor: 'rgba(245, 158, 11, 0.95)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
              minWidth: 55,
              zIndex: 2,
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(217, 119, 6, 1)',
                transform: 'scale(1.05)',
              },
            }}
          />
        )}

        {/* Action Menu Button - Bottom Right Fixed */}
        <IconButton
          className="action-button"
          onClick={(e) => {
            e.stopPropagation();
            handleMenuOpen(e);
          }}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            border: '2px solid #4F8CFF',
            color: '#4F8CFF',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(79, 140, 255, 0.1)',
            },
          }}
        >
          <IconDotsVertical size={18} />
        </IconButton>
      </Box>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: 2,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            minWidth: 180,
          },
        }}
      >
        <MenuItem onClick={handleManageItems} sx={{ gap: 1.5 }}>
          <ListItemIcon>
            <IconListDetails size={18} />
          </ListItemIcon>
          Manage Category Items
        </MenuItem>
        <MenuItem onClick={handleItemSequence} sx={{ gap: 1.5 }}>
          <ListItemIcon>
            <IconSortDescending size={18} />
          </ListItemIcon>
          Item Sequence
        </MenuItem>
        <MenuItem onClick={handleEdit} sx={{ gap: 1.5 }}>
          <ListItemIcon>
            <IconEdit size={18} />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ gap: 1.5, color: '#FF7675' }}>
          <ListItemIcon>
            <IconTrash size={18} color="#FF7675" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
}
