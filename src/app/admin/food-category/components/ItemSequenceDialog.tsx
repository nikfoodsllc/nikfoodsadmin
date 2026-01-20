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
import { FoodCategory, CategoryListingType } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateWithDay } from '@/utils/days';
import { safeFormatCurrency } from '@/utils/currency';

interface FoodItem {
  _id: string;
  name: string;
  url?: string;
  price?: number;
  sequence?: number;
  mappingId?: string; // ID of the category-food-mapping document
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

  // Reset state when dialog opens
  useEffect(() => {
    if (open && category) {
      setError('');
      if (category.listingType === 'day-wise' && category.dayWiseItems && category.dayWiseItems.length > 0) {
        // For day-wise, select the first day that has items
        const firstDayWithItems = category.dayWiseItems.find(d => d.items && d.items.length > 0);
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

  // Fetch items when category or selected day changes
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
      // Build query parameters for the new items endpoint
      const params = new URLSearchParams({
        categoryId: category._id?.toString() || '',
      });

      if (category.listingType === 'day-wise') {
        // For day-wise categories, add mapping type and day filters
        params.append('mappingType', 'DAY_WISE');

        if (!selectedDay) {
          setItems([]);
          setLoading(false);
          return;
        }

        params.append('day', selectedDay);
        console.log('[ItemSequenceDialog] Fetching DAY_WISE items for category:', category.name, 'day:', selectedDay);
      } else {
        // For flat categories, add FLAT mapping type filter
        params.append('mappingType', 'FLAT');
        console.log('[ItemSequenceDialog] Fetching FLAT items for category:', category.name);
      }

      // Fetch items with mapping details in a single call
      const response = await fetch(`/api/admin/category-food-mapping/items?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch category items');
      }

      const data = await response.json();
      const fetchedItems: FoodItem[] = data.data?.items || [];

      console.log('[ItemSequenceDialog] Fetched items:', fetchedItems.length);

      // Items are already sorted by sequence from the API
      setItems(fetchedItems);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch food items');
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

    // Update sequence values
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
      // Prepare batch update payload
      const updates = items.map((item, index) => ({
        mappingId: item.mappingId,
        sequence: index,
      }));

      // Validate all items have mappingId
      const missingMappingId = items.find(item => !item.mappingId);
      if (missingMappingId) {
        throw new Error(`Mapping ID not found for item: ${missingMappingId.name}`);
      }

      // Call the batch-sequence endpoint
      const response = await fetch('/api/admin/category-food-mapping/batch-sequence', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update sequence');
      }

      const result = await response.json();

      // Check if all updates succeeded
      if (!result.success && result.data?.failureCount > 0) {
        throw new Error(
          `Failed to update ${result.data.failureCount} item(s). Only ${result.data.successCount} succeeded.`
        );
      }

      console.log('[ItemSequenceDialog] Successfully updated', result.data?.successCount, 'mappings');
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving sequence:', err);
      setError(err instanceof Error ? err.message : 'Failed to save sequence');
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
    return category.dayWiseItems.filter(d => d.items && d.items.length > 0);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
        Reorder Items - {category?.name || 'Category'}
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {category?.listingType === 'day-wise' && (
            <FormControl fullWidth>
              <InputLabel id="day-select-label">Select Day</InputLabel>
              <Select
                labelId="day-select-label"
                value={selectedDay}
                label="Select Day"
                onChange={(e) => setSelectedDay(e.target.value)}
                disabled={loading || saving}
                sx={{
                  backgroundColor: '#F6FAFF',
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: '#4F8CFF',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#4F8CFF',
                    },
                  },
                }}
              >
                {getAvailableDays().map((dayItem) => (
                  <MenuItem key={dayItem.day} value={dayItem.day}>
                    {formatDateWithDay(dayItem.day)} ({dayItem.items.length} items)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                padding: 4,
                backgroundColor: '#f5f5f5',
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: '#666' }}>
                {category?.listingType === 'day-wise' && !selectedDay
                  ? 'Please select a day to view items'
                  : 'No items found for this category'}
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
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      backgroundColor: snapshot.isDraggingOver ? '#F6FAFF' : 'transparent',
                      borderRadius: 2,
                      padding: 1,
                      minHeight: items.length > 0 ? 'auto' : 100,
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
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              padding: 2,
                              backgroundColor: snapshot.isDragging ? '#E3F2FD' : '#fff',
                              border: '1px solid #E0E0E0',
                              borderRadius: 2,
                              boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
                              cursor: 'grab',
                              '&:hover': {
                                backgroundColor: '#F9FAFB',
                                borderColor: '#4F8CFF',
                              },
                              '&:active': {
                                cursor: 'grabbing',
                              },
                              ...provided.draggableProps.style,
                            }}
                          >
                            {/* Drag Handle */}
                            <Box
                              {...provided.dragHandleProps}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#999',
                                '&:hover': {
                                  color: '#4F8CFF',
                                },
                              }}
                            >
                              <IconGripVertical size={20} />
                            </Box>

                            {/* Sequence Number */}
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                backgroundColor: '#4F8CFF',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                flexShrink: 0,
                              }}
                            >
                              {index + 1}
                            </Box>

                            {/* Item Image */}
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                borderRadius: 1.5,
                                overflow: 'hidden',
                                backgroundColor: '#F3F4F6',
                                border: '1px solid #E5E7EB',
                                flexShrink: 0,
                                position: 'relative',
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
                                    fontSize: '0.6rem',
                                    color: '#999',
                                    textAlign: 'center',
                                    padding: 0.5,
                                  }}
                                >
                                  No Image
                                </Box>
                              )}
                            </Box>

                            {/* Item Name */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  color: '#333',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.name}
                              </Typography>
                              {item.price !== undefined && item.price !== null && !Number.isNaN(item.price) && Number.isFinite(item.price) && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#666',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {safeFormatCurrency(item.price)}
                                </Typography>
                              )}
                            </Box>
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

      <DialogActions sx={{ padding: 3, gap: 1 }}>
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
            minWidth: 100,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
          }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
