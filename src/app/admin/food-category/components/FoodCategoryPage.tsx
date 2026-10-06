'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, Alert, Snackbar, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { IconPlus, IconFilter } from '@tabler/icons-react';
import { CategoryListingType } from '@/types/order';
import CategoryCard from './CategoryCard';
import CategoryDialog from './CategoryDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import CategorySkeleton from './CategorySkeleton';
import ItemSequenceDialog from './ItemSequenceDialog';
import { FoodCategory } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';
import { groupCategoriesByParent } from '@/utils/categoryTree';

function categoryHasParent(c: FoodCategory): boolean {
  const p = c.parentCategoryId;
  if (p === undefined || p === null) return false;
  if (typeof p === 'string') return p.trim().length > 0;
  return true;
}

export default function FoodCategoryPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<FoodCategory | null>(null);
  const [selectedCategoryForSequence, setSelectedCategoryForSequence] = useState<FoodCategory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [filterType, setFilterType] = useState<CategoryListingType | 'all'>('all');

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleFilterChange = (
    event: React.MouseEvent<HTMLElement>,
    newFilter: CategoryListingType | 'all',
  ) => {
    if (newFilter !== null) {
      setFilterType(newFilter);
    }
  };

  // Filter categories based on selected filter type
  const filteredCategories = categories.filter((category) => {
    if (filterType === 'all') return true;
    return category.listingType === filterType;
  });

  // Get category counts for display
  const flatCount = categories.filter(cat => cat.listingType === 'flat' || !cat.listingType).length;
  const dayWiseCount = categories.filter(cat => cat.listingType === 'day-wise').length;

  const parentCategoryOptions = categories.filter((c) => !categoryHasParent(c));

  const fetchCategories = useCallback(async () => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/food-category', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();

      // Set categories and sort by sequence
      const categoriesData = data.data?.items || [];
      setCategories(categoriesData.sort((a: FoodCategory, b: FoodCategory) => (a.sequence || 0) - (b.sequence || 0)));
    } catch (error) {
      console.error('Error fetching categories:', error);
      showSnackbar('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAddClick = () => {
    setSelectedCategory(null);
    setDialogOpen(true);
  };

  const handleEditClick = (category: FoodCategory) => {
    setSelectedCategory(category);
    setDialogOpen(true);
  };

  const handleDeleteClick = (category: FoodCategory) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleItemSequenceClick = (category: FoodCategory) => {
    setSelectedCategoryForSequence(category);
    setSequenceDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedCategory(null);
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleSequenceDialogClose = () => {
    setSequenceDialogOpen(false);
    setSelectedCategoryForSequence(null);
  };

  const handleSequenceSave = async () => {
    try {
      await fetchCategories();
      showSnackbar('Item sequence updated successfully');
      handleSequenceDialogClose();
    } catch (error) {
      console.error('Error updating sequence:', error);
      showSnackbar('Failed to update item sequence', 'error');
    }
  };

  const handleSave = async (data: Partial<Omit<FoodCategory, '_id'>> & { _id?: string; isImageUpdated?: boolean }) => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const isEdit = !!data._id;
      const url = '/api/admin/food-category';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save category');
      }

      showSnackbar(isEdit ? 'Category updated successfully' : 'Category created successfully');
      await fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    setDeleteLoading(true);
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/food-category?id=${categoryToDelete._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }

      showSnackbar('Category deleted successfully');
      await fetchCategories();
      handleDeleteDialogClose();
    } catch (error) {
      console.error('Error deleting category:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to delete category', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (authLoading) {
    return <CategorySkeleton />;
  }

  if (!isAuthenticated || !token) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Authentication required. Please log in again.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return <CategorySkeleton />;
  }

  return (
    <Box>
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
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', marginBottom: 2 }}>
            Food Category
          </Typography>

          {/* Category Type Summary */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', marginBottom: 3 }}>
            <Chip
              label={`All: ${categories.length}`}
              size="small"
              variant={filterType === 'all' ? 'filled' : 'outlined'}
              onClick={() => setFilterType('all')}
              sx={{
                backgroundColor: filterType === 'all' ? '#4F8CFF' : 'transparent',
                color: filterType === 'all' ? 'white' : '#4F8CFF',
                borderColor: '#4F8CFF',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: filterType === 'all' ? '#3B7AE8' : 'rgba(79, 140, 255, 0.1)',
                },
              }}
            />
            <Chip
              label={`Flat: ${flatCount}`}
              size="small"
              variant={filterType === 'flat' ? 'filled' : 'outlined'}
              onClick={() => setFilterType('flat')}
              sx={{
                backgroundColor: filterType === 'flat' ? '#10B981' : 'transparent',
                color: filterType === 'flat' ? 'white' : '#10B981',
                borderColor: '#10B981',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: filterType === 'flat' ? '#059669' : 'rgba(16, 185, 129, 0.1)',
                },
              }}
            />
            <Chip
              label={`Day-wise: ${dayWiseCount}`}
              size="small"
              variant={filterType === 'day-wise' ? 'filled' : 'outlined'}
              onClick={() => setFilterType('day-wise')}
              sx={{
                backgroundColor: filterType === 'day-wise' ? '#8B5CF6' : 'transparent',
                color: filterType === 'day-wise' ? 'white' : '#8B5CF6',
                borderColor: '#8B5CF6',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: filterType === 'day-wise' ? '#7C3AED' : 'rgba(139, 92, 246, 0.1)',
                },
              }}
            />
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<IconPlus size={20} />}
          onClick={handleAddClick}
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            paddingX: 3,
            paddingY: 1.5,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
          }}
        >
          Add Food Category
        </Button>
      </Box>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            paddingY: 8,
            backgroundColor: '#f5f5f5',
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: '#666', marginBottom: 1 }}>
            No categories found
          </Typography>
          <Typography variant="body2" sx={{ color: '#999' }}>
            Click &quot;Add Food Category&quot; to create your first category
          </Typography>
        </Box>
      ) : filteredCategories.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            paddingY: 8,
            backgroundColor: '#f5f5f5',
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: '#666', marginBottom: 1 }}>
            No {filterType} categories found
          </Typography>
          <Typography variant="body2" sx={{ color: '#999' }}>
            Try selecting a different filter or create a new {filterType} category
          </Typography>
        </Box>
      ) : (
        <Box>
          {/* Filter Indicator */}
          {filterType !== 'all' && (
            <Box sx={{ marginBottom: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconFilter size={18} color="#666" />
              <Typography variant="body2" sx={{ color: '#666' }}>
                Showing {filterType === 'flat' ? 'Flat' : 'Day-wise'} categories ({filteredCategories.length} of {categories.length})
              </Typography>
            </Box>
          )}

          {/* Each category followed by its own sub-categories, both in rank order */}
          {groupCategoriesByParent(filteredCategories, categories).map((group) => (
            <Box key={group.parentId} sx={{ mb: 5 }}>
              {group.parent ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: group.children.length > 0 ? 2 : 0 }}>
                  <CategoryCard
                    key={group.parent._id?.toString()}
                    category={group.parent}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onRefresh={fetchCategories}
                    onItemSequence={handleItemSequenceClick}
                  />
                </Box>
              ) : null}

              {group.children.length > 0 && (
                <Box sx={{ pl: { xs: 1.5, sm: 3 }, borderLeft: '3px solid #E5E7EB', ml: { xs: 0.5, sm: 1 } }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: '#6B7280' }}>
                    {group.parentName ? `Sub categories of ${group.parentName}` : 'Sub categories'} ({group.children.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {group.children.map((category) => (
                      <CategoryCard
                        key={category._id?.toString()}
                        category={category}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onRefresh={fetchCategories}
                        onItemSequence={handleItemSequenceClick}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <CategoryDialog
        open={dialogOpen}
        category={selectedCategory}
        parentCategoryOptions={parentCategoryOptions}
        onClose={handleDialogClose}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        categoryName={categoryToDelete?.name || ''}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteDialogClose}
      />

      {/* Item Sequence Dialog */}
      <ItemSequenceDialog
        open={sequenceDialogOpen && selectedCategoryForSequence !== null}
        category={selectedCategoryForSequence}
        onClose={handleSequenceDialogClose}
        onSave={handleSequenceSave}
      />

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
    </Box>
  );
}
