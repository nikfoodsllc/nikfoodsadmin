'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Paper,
  IconButton,
} from '@mui/material';
import { IconArrowLeft, IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { FoodCategory, CategoryDayWiseItem } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import DayWiseItemSelector from '../../components/DayWiseItemSelector';
import AddItemDialog from '../../components/AddItemDialog';
import { safeFormatCurrency } from '@/utils/currency';
import { useAvailableDates } from '@/hooks/useAvailableDates';

interface FoodItem {
  _id: string;
  name: string;
  description?: string;
  veg: boolean;
  price?: number;
  itemType?: 'simple' | 'portions' | 'combo';
  portions?: string[];
  portionPrices?: number[];
}

interface AssignedItem {
  _id: string;
  name: string;
  description?: string;
  veg: boolean;
  price?: number;
  itemType?: 'simple' | 'portions' | 'combo';
  portions?: string[];
  portionPrices?: number[];
  mappingCategoryId: string;
}

interface ItemGroup {
  categoryId: string;
  categoryName: string;
  isSubCategory: boolean;
  items: AssignedItem[];
}

function categoryHasParent(category: FoodCategory): boolean {
  const parent = category.parentCategoryId;
  if (parent === undefined || parent === null) return false;
  if (typeof parent === 'string') return parent.trim().length > 0;
  return true;
}

export default function CategoryItemsPage() {
  const params = useParams();
  const router = useRouter();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const categoryId = params.categoryId as string;

  // Fetch available dates to filter out disabled dates
  const { availableDates } = useAvailableDates({
    dayWiseCategoryEnabledOnly: true
  });

  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [dayWiseItems, setDayWiseItems] = useState<CategoryDayWiseItem[]>([]);
  const [lockedItemIds, setLockedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Fetch category details
  const fetchCategory = useCallback(async () => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Fetch all categories and find the one we need
      const response = await fetch('/api/admin/food-category', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch category');
      }

      const data = await response.json();
      const categories = data.data?.items || [];
      const foundCategory = categories.find((cat: FoodCategory) => cat._id?.toString() === categoryId);

      if (!foundCategory) {
        throw new Error('Category not found');
      }

      setCategory(foundCategory);
      setLockedItemIds(
        Array.isArray(foundCategory.dayWiseLockedItemIds)
          ? foundCategory.dayWiseLockedItemIds
          : []
      );

      // Initialize state based on category type
      if (foundCategory.listingType === 'day-wise') {
        // Load day-wise items from the category-food-mapping API
        try {
          // Fetch day-wise mappings from API
          const daywiseResponse = await fetch(
            `/api/admin/category-food-mapping/daywise?categoryId=${categoryId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!daywiseResponse.ok) {
            throw new Error('Failed to fetch day-wise items');
          }

          const daywiseData = await daywiseResponse.json();
          const mappingsByDay = daywiseData.data?.mappingsByDay || [];

          // Create a Set of enabled dates for efficient lookup
          const enabledDatesSet = new Set(
            availableDates.map((date) => date.date)
          );

          // Filter mappings to only include enabled dates, then transform
          const transformedDayWiseItems: CategoryDayWiseItem[] = mappingsByDay
            .filter((dayMapping: { day: string }) => enabledDatesSet.has(dayMapping.day))
            .map((dayMapping: {
              day: string;
              mappings: Array<{ foodItemId: { toString: () => string }; sequence: number }>
            }) => ({
              day: dayMapping.day, // Already in YYYY-MM-DD format
              items: dayMapping.mappings
                .sort((a, b) => a.sequence - b.sequence)
                .map((mapping) => mapping.foodItemId.toString())
            }));

          setDayWiseItems(transformedDayWiseItems);
        } catch (err) {
          console.error('Error fetching day-wise items:', err);
          // Set empty array on error to prevent UI from breaking
          setDayWiseItems([]);
        }
      } else {
        setItemGroups([]);
        setSelectedItemIds([]);
      }
    } catch (err) {
      console.error('Error fetching category:', err);
      setError(err instanceof Error ? err.message : 'Failed to load category');
    }
  }, [token, isAuthenticated, categoryId, availableDates]);

  // Fetch all available food items
  const fetchFoodItems = useCallback(async () => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Fetch all food items without pagination for category management
      const response = await fetch('/api/admin/food-items?excludeDrafts=true&limit=10000', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch food items');
      }

      const data = await response.json();
      const allItems: FoodItem[] = data.data?.items || [];

      // For flat categories, fetch items using the new category-food-mapping API
      // to get the current mappings for this category
      const category = await fetch('/api/admin/food-category', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (category.ok) {
        const categoryData = await category.json();
        const categories = categoryData.data?.items || [];
        const foundCategory = categories.find((cat: FoodCategory) => cat._id?.toString() === categoryId);

        if (foundCategory && foundCategory.listingType === 'flat') {
          const includeSubCategories = !categoryHasParent(foundCategory);
          const params = new URLSearchParams({
            categoryId,
            mappingType: 'FLAT',
          });

          if (includeSubCategories) {
            params.append('includeSubCategories', 'true');
          }

          const mappingsResponse = await fetch(
            `/api/admin/category-food-mapping/items?${params.toString()}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (mappingsResponse.ok) {
            const mappingsData = await mappingsResponse.json();
            const foodItemMap = new Map(allItems.map((item) => [item._id, item]));

            const enrichItem = (
              item: {
                _id: string;
                name: string;
                description?: string;
                price?: number;
                mappingCategoryId?: string;
              },
              mappingCategoryId: string
            ): AssignedItem => {
              const details = foodItemMap.get(item._id);

              return {
                _id: item._id,
                name: item.name,
                description: item.description ?? details?.description,
                veg: details?.veg ?? true,
                price: item.price ?? details?.price,
                itemType: details?.itemType,
                portions: details?.portions,
                portionPrices: details?.portionPrices,
                mappingCategoryId,
              };
            };

            if (includeSubCategories && mappingsData.data?.groups?.length) {
              const groups: ItemGroup[] = mappingsData.data.groups.map(
                (group: {
                  categoryId: string;
                  categoryName: string;
                  isSubCategory: boolean;
                  items: Array<{
                    _id: string;
                    name: string;
                    description?: string;
                    price?: number;
                    mappingCategoryId?: string;
                  }>;
                }) => ({
                  categoryId: group.categoryId,
                  categoryName: group.categoryName,
                  isSubCategory: group.isSubCategory,
                  items: group.items.map((item) =>
                    enrichItem(item, item.mappingCategoryId || group.categoryId)
                  ),
                })
              );

              setItemGroups(groups);
              setSelectedItemIds(groups.flatMap((group) => group.items.map((item) => item._id)));
            } else {
              const items = mappingsData.data?.items || [];
              const assignedItems = items.map(
                (item: {
                  _id: string;
                  name: string;
                  description?: string;
                  price?: number;
                  mappingCategoryId?: string;
                }) => enrichItem(item, item.mappingCategoryId || categoryId)
              );

              setItemGroups([
                {
                  categoryId,
                  categoryName: foundCategory.name,
                  isSubCategory: false,
                  items: assignedItems,
                },
              ]);
              setSelectedItemIds(assignedItems.map((item: AssignedItem) => item._id));
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching food items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load food items');
    }
  }, [token, isAuthenticated, categoryId]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchCategory(), fetchFoodItems()]);
      } finally {
        setLoading(false);
      }
    };

    if (token && isAuthenticated) {
      loadData();
    }
  }, [token, isAuthenticated, fetchCategory, fetchFoodItems]);

  // Handle save
  const handleSave = async () => {
    if (!category) return;

    setSaving(true);
    setError('');

    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      if (category.listingType === 'day-wise') {
        // For day-wise categories, use the new POST /api/admin/category-food-mapping/daywise endpoint
        // First, delete all existing day-wise mappings for this category
        const deleteResponse = await fetch(`/api/admin/category-food-mapping/daywise?categoryId=${categoryId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json();
          throw new Error(errorData.error || 'Failed to clear existing mappings');
        }

        // Prepare the mappings array
        const mappings: Array<{
          foodItemId: string;
          categoryId: string;
          day: string;
          sequence: number;
        }> = [];

        for (const dayItem of dayWiseItems) {
          for (let sequence = 0; sequence < dayItem.items.length; sequence++) {
            mappings.push({
              foodItemId: dayItem.items[sequence],
              categoryId: categoryId,
              day: dayItem.day,
              sequence,
            });
          }
        }

        // Create new mappings using the bulk endpoint
        if (mappings.length > 0) {
          const response = await fetch('/api/admin/category-food-mapping/daywise', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ mappings }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update day-wise items');
          }
        }

        const lockResponse = await fetch('/api/admin/food-category', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            _id: categoryId,
            dayWiseLockedItemIds: lockedItemIds,
          }),
        });

        if (!lockResponse.ok) {
          const errorData = await lockResponse.json();
          throw new Error(errorData.error || 'Failed to save locked rows');
        }

        if (mappings.length > 0) {
          showSnackbar('Day-wise items updated successfully');
        } else {
          showSnackbar('Day-wise items cleared successfully');
        }
      } else {
        // For flat categories, item assignment is managed through the food items themselves
        // Show a message directing to the food items page
        showSnackbar('For flat categories, manage items through the Food Items page', 'success');
      }
    } catch (err) {
      console.error('Error saving category items:', err);
      setError(err instanceof Error ? err.message : 'Failed to save category items');
      showSnackbar('Failed to save category items', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    router.push('/admin/food-category');
  };

  // Handle adding items - refresh the items list
  const handleItemsAdded = async () => {
    // Refresh the food items to show newly added items
    await fetchFoodItems();
    showSnackbar('Items added successfully', 'success');
  };

  // Handle removing an item from the category
  const handleRemoveItem = async (itemId: string, mappingCategoryId: string) => {
    if (!token || !isAuthenticated) {
      showSnackbar('Authentication required', 'error');
      return;
    }

    try {
      // Use the new category-food-mapping API to delete the FLAT mapping
      const deleteResponse = await fetch(
        `/api/admin/category-food-mapping?foodItemId=${itemId}&categoryId=${mappingCategoryId}&mappingType=FLAT`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || 'Failed to remove item');
      }

      // Refresh the items list
      await fetchFoodItems();
      showSnackbar('Item removed successfully', 'success');
    } catch (err) {
      console.error('Error removing item:', err);
      showSnackbar(err instanceof Error ? err.message : 'Failed to remove item', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#F6FAFF',
        }}
      >
        <CircularProgress sx={{ color: '#4F8CFF' }} />
        <Typography variant="body2" sx={{ color: '#666', marginTop: 2 }}>
          Loading category items...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#F6FAFF', minHeight: '100vh' }}>
        <Typography variant="h6" color="error">
          Authentication required. Please log in again.
        </Typography>
      </Box>
    );
  }

  if (error && !category) {
    return (
      <Box sx={{ p: 4, backgroundColor: '#F6FAFF', minHeight: '100vh' }}>
        <Button
          startIcon={<IconArrowLeft size={20} />}
          onClick={handleBack}
          sx={{ marginBottom: 3, textTransform: 'none', color: '#4F8CFF' }}
        >
          Back to Categories
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!category) {
    return null;
  }

  const isDayWise = category.listingType === 'day-wise';
  const totalAssignedItems = itemGroups.reduce((count, group) => count + group.items.length, 0);
  const showSubCategoryGroups =
    !isDayWise && !categoryHasParent(category) && itemGroups.some((group) => group.isSubCategory);

  const renderAssignedItem = (item: AssignedItem) => (
    <Box
      key={`${item.mappingCategoryId}-${item._id}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: 2,
        borderRadius: 1,
        border: '1px solid #E0E0E0',
        backgroundColor: '#FAFAFA',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: '#4F8CFF',
          backgroundColor: 'rgba(79, 140, 255, 0.04)',
        },
      }}
    >
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: item.veg ? '#4CAF50' : '#F44336',
          mr: 2,
          flexShrink: 0,
        }}
      />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>
          {item.name}
        </Typography>
        {item.description && (
          <Typography
            variant="caption"
            sx={{
              color: '#666',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.description}
          </Typography>
        )}
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: '#4F8CFF',
          mr: 2,
          flexShrink: 0,
        }}
      >
        {item.itemType === 'portions' &&
        item.portionPrices &&
        item.portionPrices.length > 0 ? (
          <>
            {safeFormatCurrency(Math.min(...item.portionPrices))} -{' '}
            {safeFormatCurrency(Math.max(...item.portionPrices))}
          </>
        ) : item.price !== undefined && item.price !== null ? (
          safeFormatCurrency(item.price)
        ) : (
          'N/A'
        )}
      </Typography>

      <IconButton
        onClick={() => handleRemoveItem(item._id, item.mappingCategoryId)}
        size="small"
        sx={{
          color: '#F44336',
          flexShrink: 0,
          '&:hover': {
            backgroundColor: 'rgba(244, 67, 54, 0.08)',
          },
        }}
        title="Remove item from category"
      >
        <IconTrash size={18} />
      </IconButton>
    </Box>
  );

  return (
    <Box
      sx={{
        backgroundColor: '#F6FAFF',
        minHeight: '100vh',
        padding: { xs: 2, sm: 3, md: 4 },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Button
            startIcon={<IconArrowLeft size={20} />}
            onClick={handleBack}
            sx={{
              marginBottom: 2,
              textTransform: 'none',
              color: '#4F8CFF',
              '&:hover': {
                backgroundColor: 'rgba(79, 140, 255, 0.04)',
              },
            }}
          >
            Back to Categories
          </Button>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '24px', sm: '28px', md: '32px' },
              color: '#333',
              marginBottom: 1,
            }}
          >
            {category.name}
          </Typography>

          {category.description && (
            <Typography
              variant="body1"
              sx={{
                color: '#666',
                marginBottom: 2,
                maxWidth: '600px',
              }}
            >
              {category.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label={isDayWise ? 'Day-wise Category' : 'Flat Category'}
              size="small"
              sx={{
                backgroundColor: isDayWise ? '#8B5CF6' : '#10B981',
                color: 'white',
                fontWeight: 500,
              }}
            />
            {category.isDraft && (
              <Chip
                label="Draft"
                size="small"
                sx={{
                  backgroundColor: '#FFA726',
                  color: 'white',
                  fontWeight: 500,
                }}
              />
            )}
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <IconCheck size={20} />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            paddingX: 3,
            paddingY: 1.5,
            minWidth: 120,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError('')}
          sx={{ marginBottom: 3 }}
        >
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Paper
        sx={{
          backgroundColor: 'white',
          borderRadius: 3,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ padding: { xs: 2, sm: 3, md: 4 } }}>
          {isDayWise ? (
            // Day-wise Category: Use DayWiseItemSelector
            <DayWiseItemSelector
              value={dayWiseItems}
              onChange={setDayWiseItems}
              lockedItemIds={lockedItemIds}
              onLockedItemIdsChange={setLockedItemIds}
              disabled={saving}
              categoryId={categoryId}
              categoryName={category.name}
            />
          ) : (
            // Flat Category: Show items with add/remove functionality
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
                  Currently Assigned Items
                  {totalAssignedItems > 0 && (
                    <Chip
                      label={`${totalAssignedItems}`}
                      size="small"
                      sx={{
                        ml: 2,
                        backgroundColor: '#4F8CFF',
                        color: 'white',
                        fontWeight: 500,
                      }}
                    />
                  )}
                </Typography>

                <Button
                  variant="contained"
                  startIcon={<IconPlus size={20} />}
                  onClick={() => setAddItemDialogOpen(true)}
                  sx={{
                    textTransform: 'none',
                    backgroundColor: '#4F8CFF',
                    minWidth: 120,
                    '&:hover': {
                      backgroundColor: '#3B7AE8',
                    },
                  }}
                >
                  Add Item
                </Button>
              </Box>

              {totalAssignedItems === 0 ? (
                <Box sx={{ textAlign: 'center', padding: 4, backgroundColor: '#FAFAFA', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#666', marginBottom: 2 }}>
                    No items are currently assigned to this category
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<IconPlus size={18} />}
                    onClick={() => setAddItemDialogOpen(true)}
                    sx={{
                      textTransform: 'none',
                      borderColor: '#4F8CFF',
                      color: '#4F8CFF',
                      '&:hover': {
                        borderColor: '#3B7AE8',
                        backgroundColor: 'rgba(79, 140, 255, 0.04)',
                      },
                    }}
                  >
                    Add First Item
                  </Button>
                </Box>
              ) : showSubCategoryGroups ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {itemGroups.map((group) => {
                    if (group.items.length === 0) {
                      return null;
                    }

                    return (
                      <Box key={group.categoryId}>
                        <Box
                          sx={{
                            mb: 1.5,
                            pl: 2,
                            py: 1,
                            borderLeft: '4px solid',
                            borderColor: group.isSubCategory ? '#8B5CF6' : '#4F8CFF',
                            borderRadius: '0 10px 10px 0',
                            backgroundColor: group.isSubCategory
                              ? 'rgba(139, 92, 246, 0.06)'
                              : 'rgba(79, 140, 255, 0.06)',
                          }}
                        >
                          <Typography
                            component="h3"
                            sx={{
                              fontWeight: 600,
                              color: '#1E3A5F',
                              fontSize: { xs: '0.95rem', sm: '1.05rem' },
                            }}
                          >
                            {group.categoryName}
                            {group.isSubCategory && (
                              <Chip
                                label="Sub-category"
                                size="small"
                                sx={{
                                  ml: 1.5,
                                  height: 22,
                                  backgroundColor: '#8B5CF6',
                                  color: 'white',
                                  fontWeight: 500,
                                  fontSize: '0.7rem',
                                }}
                              />
                            )}
                            <Typography
                              component="span"
                              sx={{
                                ml: 1,
                                fontWeight: 500,
                                color: '#666',
                                fontSize: '0.85rem',
                              }}
                            >
                              ({group.items.length}{' '}
                              {group.items.length === 1 ? 'item' : 'items'})
                            </Typography>
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {group.items.map((item) => renderAssignedItem(item))}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {itemGroups.flatMap((group) => group.items).map((item) => renderAssignedItem(item))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Add Item Dialog */}
      <AddItemDialog
        open={addItemDialogOpen}
        categoryId={categoryId}
        existingItemIds={selectedItemIds}
        token={token}
        onClose={() => setAddItemDialogOpen(false)}
        onItemsAdded={handleItemsAdded}
      />
    </Box>
  );
}
