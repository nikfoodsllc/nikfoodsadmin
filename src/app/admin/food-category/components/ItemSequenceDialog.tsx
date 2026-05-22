'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
} from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { IconGripVertical } from '@tabler/icons-react';
import { FoodCategory } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateWithDay } from '@/utils/days';
import { safeFormatCurrency } from '@/utils/currency';

interface FoodItem {
  _id: string;
  name: string;
  url?: string;
  price?: number;
  sequence?: number;
  mappingId?: string;
}

interface ItemSequenceDialogProps {
  open: boolean;
  category: FoodCategory | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ItemSequenceDialog({
  open,
  category,
  onClose,
  onSave,
}: ItemSequenceDialogProps) {
  const { token } = useAuth();

  const [selectedDay, setSelectedDay] = useState<string>('');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && category) {
      setError('');

      if (
        category.listingType === 'day-wise' &&
        category.dayWiseItems &&
        category.dayWiseItems.length > 0
      ) {
        const firstDayWithItems = category.dayWiseItems.find(
          (d) => d.items && d.items.length > 0
        );

        if (firstDayWithItems) {
          setSelectedDay(firstDayWithItems.day);
        } else {
          setSelectedDay('');
        }
      } else {
        setSelectedDay('');
      }

      setItems([]);
    }
  }, [open, category]);

  useEffect(() => {
    if (open && category && token) {
      fetchItems();
    }
  }, [open, category, selectedDay, token]);

  const fetchItems = async () => {
    if (!category || !token) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        categoryId: category._id?.toString() || '',
      });

      if (category.listingType === 'day-wise') {
        params.append('mappingType', 'DAY_WISE');

        if (!selectedDay) {
          setItems([]);
          setLoading(false);
          return;
        }

        params.append('day', selectedDay);
      } else {
        params.append('mappingType', 'FLAT');
      }

      const response = await fetch(
        `/api/admin/category-food-mapping/items?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch category items');
      }

      const data = await response.json();

      const fetchedItems: FoodItem[] = data.data?.items || [];

      setItems(fetchedItems);
    } catch (err) {
      console.error('Error fetching items:', err);

      setError(
        err instanceof Error ? err.message : 'Failed to fetch food items'
      );

      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newItems = Array.from(items);

    const [reorderedItem] = newItems.splice(result.source.index, 1);

    newItems.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = newItems.map((item, index) => ({
      ...item,
      sequence: index,
    }));

    setItems(updatedItems);
  };

  const handleSave = async () => {
    if (!category || !token) return;

    setSaving(true);
    setError('');

    try {
      const updates = items.map((item, index) => ({
        mappingId: item.mappingId,
        sequence: index,
      }));

      const missingMappingId = items.find((item) => !item.mappingId);

      if (missingMappingId) {
        throw new Error(
          `Mapping ID not found for item: ${missingMappingId.name}`
        );
      }

      const response = await fetch(
        '/api/admin/category-food-mapping/batch-sequence',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ updates }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || 'Failed to update sequence');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving sequence:', err);

      setError(
        err instanceof Error ? err.message : 'Failed to save sequence'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const getAvailableDays = () => {
    if (!category?.dayWiseItems) return [];

    return category.dayWiseItems.filter(
      (d) => d.items && d.items.length > 0
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
          width: '95vw',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '1.4rem',
        }}
      >
        Reorder Items - {category?.name || 'Category'}
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 2,
          }}
        >
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {category?.listingType === 'day-wise' && (
            <FormControl fullWidth>
              <InputLabel id="day-select-label">
                Select Day
              </InputLabel>

              <Select
                labelId="day-select-label"
                value={selectedDay}
                label="Select Day"
                onChange={(e) => setSelectedDay(e.target.value)}
                disabled={loading || saving}
              >
                {getAvailableDays().map((dayItem) => (
                  <MenuItem
                    key={dayItem.day}
                    value={dayItem.day}
                  >
                    {formatDateWithDay(dayItem.day)} (
                    {dayItem.items.length} items)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 6,
              }}
            >
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                p: 6,
                backgroundColor: '#F8F9FA',
                borderRadius: 2,
              }}
            >
              <Typography>
                No items found for this category
              </Typography>
            </Box>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="items-list">
                {(provided, snapshot) => (
                  <Box
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(1, 1fr)',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(3, 1fr)',
                        lg: 'repeat(4, 1fr)',
                        xl: 'repeat(6, 1fr)',
                      },
                      gap: 2,
                      backgroundColor: snapshot.isDraggingOver
                        ? '#F6FAFF'
                        : 'transparent',
                      borderRadius: 2,
                      p: 1,
                    }}
                  >
                    {items.map((item, index) => (
                      <Draggable
                        key={item._id}
                        draggableId={item._id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 1.5,
                              p: 2,
                              borderRadius: 3,
                              border: '1px solid #E5E7EB',
                              backgroundColor: snapshot.isDragging
                                ? '#E3F2FD'
                                : '#fff',
                              boxShadow: snapshot.isDragging
                                ? '0 8px 20px rgba(0,0,0,0.15)'
                                : '0 2px 6px rgba(0,0,0,0.05)',
                              transition: '0.2s',
                              cursor: 'grab',
                              minHeight: 220,
                              '&:hover': {
                                borderColor: '#4F8CFF',
                                transform: 'translateY(-2px)',
                              },
                              '&:active': {
                                cursor: 'grabbing',
                              },
                              ...provided.draggableProps.style,
                            }}
                          >
                            {/* Top Row */}
                            <Box
                              sx={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Box
                                sx={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: '50%',
                                  backgroundColor: '#4F8CFF',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                }}
                              >
                                {index + 1}
                              </Box>

                              <IconGripVertical
                                size={20}
                                color="#999"
                              />
                            </Box>

                            {/* Image */}
                            <Box
                              sx={{
                                width: 100,
                                height: 100,
                                borderRadius: 3,
                                overflow: 'hidden',
                                border: '1px solid #E5E7EB',
                                backgroundColor: '#F3F4F6',
                              }}
                            >
                              {item.url ? (
                                <Box
                                  component="img"
                                  src={item.url}
                                  alt={item.name}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    color: '#999',
                                  }}
                                >
                                  No Image
                                </Box>
                              )}
                            </Box>

                            {/* Name */}
                            <Typography
                              sx={{
                                fontWeight: 600,
                                textAlign: 'center',
                                fontSize: '0.95rem',
                                lineHeight: 1.4,
                                minHeight: 42,
                              }}
                            >
                              {item.name}
                            </Typography>

                            {/* Price */}
                            {item.price !== undefined &&
                              item.price !== null &&
                              !Number.isNaN(item.price) &&
                              Number.isFinite(item.price) && (
                                <Typography
                                  sx={{
                                    color: '#4F8CFF',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                  }}
                                >
                                  {safeFormatCurrency(item.price)}
                                </Typography>
                              )}
                          </Box>
                        )}
                      </Draggable>
                    ))}

                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          p: 3,
          gap: 1,
        }}
      >
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{
            textTransform: 'none',
            color: '#666',
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={handleSave}
          disabled={loading || saving || items.length === 0}
          variant="contained"
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            minWidth: 120,
            borderRadius: 2,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
          }}
        >
          {saving ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            'Save'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}