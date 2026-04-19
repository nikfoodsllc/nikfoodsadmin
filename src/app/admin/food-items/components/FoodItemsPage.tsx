'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Box, Button, Typography, Alert, Snackbar, Menu, MenuItem, CircularProgress } from '@mui/material';
import { IconPlus, IconChevronDown } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import FoodItemsTable from './FoodItemsTable';
import SimpleFoodItemDialog from './SimpleFoodItemDialog';
import PortionsFoodItemDialog from './PortionsFoodItemDialog';
import ComboFoodItemDialog from './ComboFoodItemDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import TableFilters from './TableFilters';
import TablePagination from './TablePagination';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Category type
interface Category {
  _id: string;
  name: string;
}

// FoodItem type matching FoodItemsTable expectations
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
      portionId?: string;
      isDefault?: boolean;
    }>;
  }>;
}

// AllFoodItem type matching ComboFoodItemDialog expectations
interface AllFoodItem {
  _id: string;
  name: string;
  itemType: 'simple' | 'portions' | 'combo';
  portions?: string[];
  portionPrices?: number[];
  price?: number;
}

interface SimpleFoodItem {
  _id?: string;
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'simple';
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
}

interface PortionsFoodItem {
  _id?: string;
  name: string;
  description?: string;
  short_description?: string;
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'portions';
  portions: string[];
  portionPrices: number[];
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
}

interface ComboFoodItem {
  _id?: string;
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'combo';
  sections: Array<{
    title: string;
    selectedItems: Array<{
      item: string;
      portion?: string;
      price: number;
      portionId: string;
      isDefault?: boolean;
      isAvailable?: boolean;
    }>;
    sequence?: number;
  }>;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  isDraft?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FoodItemFormData = any;

/** Build JSON body so we never send `price: null` (Zod rejects null; portions items use portionPrices only). */
function buildFoodItemSavePayload(
  data: FoodItemFormData,
  imageUrl: string,
  publicId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...data,
    url: imageUrl,
    public_id: publicId,
  };

  if (data.itemType === 'portions') {
    delete payload.price;
    const pp = data.portionPrices;
    if (Array.isArray(pp)) {
      payload.portionPrices = pp.map((p: unknown) => {
        const n = Number(p);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      });
    }
  } else {
    const n = Number(data.price);
    payload.price = Number.isFinite(n) && n >= 0 ? n : 0;
  }

  return payload;
}

export default function FoodItemsPage() {
  const { token, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<FoodItem[]>([]);
  const [allFoodItems, setAllFoodItems] = useState<AllFoodItem[]>([]); // For combo selection
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
  const [portionsDialogOpen, setPortionsDialogOpen] = useState(false);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FoodItem | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [vegOnly, setVegOnly] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 7;

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Handle authentication loading and redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      logout();
    }
  }, [authLoading, isAuthenticated, logout]);

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !token) {
    return null; // Will redirect due to the useEffect above
  }

  // Fetch all food items (for combo selection)
  const fetchAllFoodItems = useCallback(async () => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Fetch all items without pagination
      const response = await fetch('/api/admin/food-items?limit=1000', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch all food items');
      }

      const data = await response.json();
      setAllFoodItems(data.data?.items || []);
    } catch (error) {
      console.error('Error fetching all food items:', error);
      // Don't show error snackbar as this is not critical
    }
  }, [token, isAuthenticated]);

  // Fetch categories
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
      setCategories(data.data?.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Don't show error snackbar as this is not critical
    }
  }, [token, isAuthenticated]);

  // Fetch food items with filters
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (vegOnly === 'true' || vegOnly === 'false') params.append('vegOnly', vegOnly);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/admin/food-items?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch food items');
      }

      const data = await response.json();
      setItems(data.data?.items || []);
      setTotalItems(data.data?.total || 0);
    } catch (error) {
      console.error('Error fetching food items:', error);
      showSnackbar('Failed to load food items', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, vegOnly, currentPage, token, isAuthenticated]);

  // Initialize from URL query params
  useEffect(() => {
    const categoryIdParam = searchParams.get('categoryId');

    if (categoryIdParam) {
      setSelectedCategory(categoryIdParam);
    }

    fetchAllFoodItems();
    fetchCategories();
  }, [searchParams, fetchAllFoodItems, fetchCategories]);

  // Fetch items when filters change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAddMenuAnchor(event.currentTarget);
  };

  const handleAddMenuClose = () => {
    setAddMenuAnchor(null);
  };

  const handleAddSimpleClick = () => {
    setSelectedItem(null);
    setSimpleDialogOpen(true);
    handleAddMenuClose();
  };

  const handleAddPortionsClick = () => {
    setSelectedItem(null);
    setPortionsDialogOpen(true);
    handleAddMenuClose();
  };

  const handleAddComboClick = () => {
    setSelectedItem(null);
    setComboDialogOpen(true);
    handleAddMenuClose();
  };

  const handleEditClick = (item: FoodItem) => {
    setSelectedItem(item);
    // Open the appropriate dialog based on item type
    if (item.itemType === 'simple') {
      setSimpleDialogOpen(true);
    } else if (item.itemType === 'portions') {
      setPortionsDialogOpen(true);
    } else if (item.itemType === 'combo') {
      setComboDialogOpen(true);
    }
  };

  const handleDeleteClick = (item: FoodItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleSimpleDialogClose = () => {
    if (!dialogLoading) {
      setSimpleDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const handlePortionsDialogClose = () => {
    if (!dialogLoading) {
      setPortionsDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const handleComboDialogClose = () => {
    if (!dialogLoading) {
      setComboDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const handleDeleteDialogClose = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleSave = async (
    data: FoodItemFormData,
    imageFile: File | null,
    priceUpdateInfo?: { priceUpdated: boolean; updatedCount: number }
  ) => {
    setDialogLoading(true);

    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      let imageUrl = data.url || '';
      let publicId = data.public_id || '';
      let isImageUpdated = false;

      // Upload new image if selected
      if (imageFile) {
        const uploadResult = await uploadToCloudinary(imageFile);
        imageUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
        isImageUpdated = true;
      }

      const requestData = buildFoodItemSavePayload(data, imageUrl, publicId);

      const isEdit = !!data._id;
      const url = '/api/admin/food-items';
      const method = isEdit ? 'PUT' : 'POST';

      if (isEdit) {
        (requestData as Record<string, unknown>).isImageUpdated = isImageUpdated;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save food item');
      }

      // Determine success message based on price update info for combo items
      let successMessage: string;
      if (data.itemType === 'combo' && priceUpdateInfo) {
        if (priceUpdateInfo.priceUpdated && priceUpdateInfo.updatedCount > 0) {
          successMessage = `Combo item saved. ${priceUpdateInfo.updatedCount} item price${priceUpdateInfo.updatedCount > 1 ? 's' : ''} updated from source.`;
        } else if (priceUpdateInfo.priceUpdated === false) {
          successMessage = 'Combo item saved with original prices.';
        } else {
          successMessage = isEdit ? 'Combo item updated successfully' : 'Combo item created successfully';
        }
      } else {
        successMessage = isEdit ? 'Food item updated successfully' : 'Food item created successfully';
      }

      showSnackbar(successMessage);
      await fetchItems();
      // Close the appropriate dialog based on item type
      if (data.itemType === 'simple') {
        handleSimpleDialogClose();
      } else if (data.itemType === 'portions') {
        handlePortionsDialogClose();
      } else if (data.itemType === 'combo') {
        handleComboDialogClose();
      }
    } catch (error) {
      console.error('Error saving food item:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to save food item',
        'error'
      );
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    setDeleteLoading(true);
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/food-items?id=${itemToDelete._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete food item');
      }

      showSnackbar('Food item deleted successfully');
      await fetchItems();
      handleDeleteDialogClose();
    } catch (error) {
      console.error('Error deleting food item:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to delete food item',
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1); // Reset to first page on filter
  };

  const handleVegFilter = (value: string) => {
    setVegOnly(value);
    setCurrentPage(1); // Reset to first page on filter
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
          Food Items
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<IconPlus size={20} />}
            endIcon={<IconChevronDown size={16} />}
            onClick={handleAddMenuClick}
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
            Add Food Item
          </Button>
          <Menu
            anchorEl={addMenuAnchor}
            open={Boolean(addMenuAnchor)}
            onClose={handleAddMenuClose}
            PaperProps={{
              sx: {
                marginTop: 1,
                minWidth: 200,
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <MenuItem
              onClick={handleAddSimpleClick}
              sx={{
                paddingY: 1.5,
                paddingX: 2,
                '&:hover': {
                  backgroundColor: '#F6FAFF',
                },
              }}
            >
              <Typography variant="body2">Simple Item</Typography>
            </MenuItem>
            <MenuItem
              onClick={handleAddPortionsClick}
              sx={{
                paddingY: 1.5,
                paddingX: 2,
                '&:hover': {
                  backgroundColor: '#F6FAFF',
                },
              }}
            >
              <Typography variant="body2">Portions Item</Typography>
            </MenuItem>
            <MenuItem
              onClick={handleAddComboClick}
              sx={{
                paddingY: 1.5,
                paddingX: 2,
                '&:hover': {
                  backgroundColor: '#F6FAFF',
                },
              }}
            >
              <Typography variant="body2">Combo Item</Typography>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ marginBottom: 3 }}>
        <TableFilters
          categories={categories}
          searchValue={searchQuery}
          selectedCategory={selectedCategory}
          vegOnly={vegOnly}
          onSearchChange={handleSearch}
          onCategoryChange={handleCategoryFilter}
          onVegChange={handleVegFilter}
        />
      </Box>

      {/* Table */}
      <Box sx={{ marginBottom: 3 }}>
        <FoodItemsTable
          items={items}
          categories={categories}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      </Box>

      {/* Pagination */}
      {!loading && totalItems > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </Box>
      )}

      {/* Simple Food Item Dialog */}
      <SimpleFoodItemDialog
        open={simpleDialogOpen}
        item={selectedItem as SimpleFoodItem | null}
        loading={dialogLoading}
        onClose={handleSimpleDialogClose}
        onSave={handleSave}
      />

      {/* Portions Food Item Dialog */}
      <PortionsFoodItemDialog
        open={portionsDialogOpen}
        item={selectedItem as PortionsFoodItem | null}
        loading={dialogLoading}
        onClose={handlePortionsDialogClose}
        onSave={handleSave}
      />

      {/* Combo Food Item Dialog */}
      <ComboFoodItemDialog
        open={comboDialogOpen}
        item={selectedItem as ComboFoodItem | null}
        allFoodItems={allFoodItems}
        loading={dialogLoading}
        onClose={handleComboDialogClose}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        itemName={itemToDelete?.name || ''}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteDialogClose}
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
