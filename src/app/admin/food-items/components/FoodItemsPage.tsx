'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Typography,
  Alert,
  Snackbar,
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  IconPlus,
  IconChevronDown,
  IconCopy,
} from '@tabler/icons-react';

import { useAuth } from '@/contexts/AuthContext';
import FoodItemsTable from './FoodItemsTable';
import ColumnVisibilityMenu from '@/components/table/ColumnVisibilityMenu';
import { FOOD_ITEMS_COLUMNS, FOOD_ITEMS_COLUMNS_STORAGE_KEY } from './foodItemsColumns';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import SimpleFoodItemDialog from './SimpleFoodItemDialog';
import PortionsFoodItemDialog from './PortionsFoodItemDialog';
import ComboFoodItemDialog from './ComboFoodItemDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import TableFilters from './TableFilters';
import { PreparationFilter, PreparationType } from '@/utils/preparationType';
import TablePagination from './TablePagination';
import { uploadToCloudinary } from '@/lib/cloudinary';
import {
  buildSubCategoryOptions,
  CategoryLookup,
  normalizeCategories,
  RawCategory,
  SubCategoryOption,
} from '../utils/subCategoryUtils';

interface Category extends CategoryLookup {
  label?: string;
}

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
  preparationType?: PreparationType;
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  isDraft?: boolean;

  portions?: string[];
  portionPrices?: number[];

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

type EditableFoodItem = Omit<FoodItem, '_id'> & { _id?: string };

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
  const [allFoodItems, setAllFoodItems] = useState<AllFoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryOption[]>([]);

  const [loading, setLoading] = useState(true);

  const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
  const [portionsDialogOpen, setPortionsDialogOpen] = useState(false);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);

  const [dialogLoading, setDialogLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState<EditableFoodItem | null>(null);

  const [itemToDelete, setItemToDelete] = useState<FoodItem | null>(null);

  const [addMenuAnchor, setAddMenuAnchor] =
    useState<null | HTMLElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [vegOnly, setVegOnly] = useState('all');

  // Preparation filter + the rows ticked for the bulk update
  const [prepFilter, setPrepFilter] = useState<PreparationFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const [totalItems, setTotalItems] = useState(0);

  const itemsPerPage = 7;

  // Column order, widths and hidden columns, saved to this admin's account
  const columnPrefs = useColumnPreferences(FOOD_ITEMS_COLUMNS_STORAGE_KEY, FOOD_ITEMS_COLUMNS, 'food-items');

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' = 'success'
  ) => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({
      ...prev,
      open: false,
    }));
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      logout();
    }
  }, [authLoading, isAuthenticated, logout]);

  if (authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!isAuthenticated || !token) {
    return null;
  }

  const fetchAllFoodItems = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/admin/food-items?limit=1000',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      setAllFoodItems(data.data?.items || []);
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/admin/food-category',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      const raw: RawCategory[] = data.data?.items || [];
      const allCategories = normalizeCategories(raw);
      const subs = buildSubCategoryOptions(raw);

      setCategories(allCategories);
      setSubCategories(subs);
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (vegOnly === 'true' || vegOnly === 'false') {
        params.append('vegOnly', vegOnly);
      }

      if (prepFilter !== 'all') {
        params.append('preparationType', prepFilter);
      }

      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(
        `/api/admin/food-items?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      setItems(data.data?.items || []);
      setTotalItems(data.data?.total || 0);
    } catch (error) {
      console.error(error);

      showSnackbar('Failed to fetch items', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    token,
    searchQuery,
    vegOnly,
    prepFilter,
    currentPage,
  ]);

  useEffect(() => {
    fetchAllFoodItems();
    fetchCategories();
  }, [fetchAllFoodItems, fetchCategories]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // =========================
  // BULK PREPARATION TYPE
  // =========================

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allOnPage = items.length > 0 && items.every((i) => next.has(i._id));
      for (const i of items) {
        if (allOnPage) next.delete(i._id);
        else next.add(i._id);
      }
      return next;
    });
  };

  // Ticks every item that matches the current search and filters, on all pages
  const selectAllMatching = async () => {
    try {
      setBulkLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (vegOnly === 'true' || vegOnly === 'false') params.append('vegOnly', vegOnly);
      if (prepFilter !== 'all') params.append('preparationType', prepFilter);
      params.append('page', '1');
      params.append('limit', '1000');
      const response = await fetch(`/api/admin/food-items?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load items');
      const ids: string[] = (data.data?.items || []).map((i: { _id: string }) => i._id);
      setSelectedIds(new Set(ids));
    } catch (error) {
      console.error(error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to select items', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyPreparationType = async (preparationType: PreparationType | null) => {
    if (selectedIds.size === 0) return;
    try {
      setBulkLoading(true);
      const response = await fetch('/api/admin/food-items/preparation-type', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [...selectedIds], preparationType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update items');
      const label = preparationType === 'cooked' ? 'Cooked' : preparationType === 'ready_to_eat' ? 'Ready to eat' : 'not set yet';
      showSnackbar(`${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'} set to ${label}`);
      setSelectedIds(new Set());
      await fetchItems();
    } catch (error) {
      console.error(error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to update items', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAddMenuClick = (
    event: React.MouseEvent<HTMLElement>
  ) => {
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

    if (item.itemType === 'simple') {
      setSimpleDialogOpen(true);
    }

    if (item.itemType === 'portions') {
      setPortionsDialogOpen(true);
    }

    if (item.itemType === 'combo') {
      setComboDialogOpen(true);
    }
  };

  // =========================
  // DUPLICATE ITEM FEATURE
  // =========================

  const handleDuplicateClick = (item: FoodItem) => {
    const { _id, ...rest } = item;
    setSelectedItem({
      ...rest,
      name: `${item.name} (Copy)`,
      available: false,
    });

    if (item.itemType === 'simple') {
      setSimpleDialogOpen(true);
    }

    if (item.itemType === 'portions') {
      setPortionsDialogOpen(true);
    }

    if (item.itemType === 'combo') {
      setComboDialogOpen(true);
    }

    showSnackbar('Product duplicated successfully');
  };

  const handleDeleteClick = (item: FoodItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (
    data: FoodItemFormData,
    imageFile: File | null
  ) => {
    try {
      setDialogLoading(true);

      let imageUrl = data.url || '';
      let publicId = data.public_id || '';

      let isImageUpdated = false;

      if (imageFile) {
        const uploadResult = await uploadToCloudinary(imageFile);

        imageUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;

        isImageUpdated = true;
      }

      const requestData = buildFoodItemSavePayload(
        data,
        imageUrl,
        publicId
      );

      const isEdit = !!data._id;

      if (isEdit) {
        requestData.isImageUpdated = isImageUpdated;
      }

      const response = await fetch('/api/admin/food-items', {
        method: isEdit ? 'PUT' : 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(requestData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.error || 'Failed to save item'
        );
      }

      showSnackbar(
        isEdit
          ? 'Food item updated successfully'
          : 'Food item created successfully'
      );

      await fetchItems();

      setSimpleDialogOpen(false);
      setPortionsDialogOpen(false);
      setComboDialogOpen(false);

      setSelectedItem(null);
    } catch (error) {
      console.error(error);

      showSnackbar(
        error instanceof Error
          ? error.message
          : 'Failed to save item',
        'error'
      );
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setDeleteLoading(true);

      const response = await fetch(
        `/api/admin/food-items?id=${itemToDelete._id}`,
        {
          method: 'DELETE',

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      showSnackbar('Item deleted successfully');

      await fetchItems();

      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error(error);

      showSnackbar(
        error instanceof Error
          ? error.message
          : 'Delete failed',
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <Box>
      {/* HEADER */}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
          }}
        >
          Food Items
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <ColumnVisibilityMenu
            columns={columnPrefs.allColumns}
            hiddenKeys={columnPrefs.hiddenKeys}
            onToggle={columnPrefs.toggleColumn}
            onMove={columnPrefs.moveColumn}
            syncStatus={columnPrefs.syncStatus}
            onShowAll={columnPrefs.showAll}
            onReset={columnPrefs.reset}
          />
          <Button
            variant="contained"
            startIcon={<IconPlus size={18} />}
            endIcon={<IconChevronDown size={16} />}
            onClick={handleAddMenuClick}
          >
            Add Food Item
          </Button>
        </Box>

        <Menu
          anchorEl={addMenuAnchor}
          open={Boolean(addMenuAnchor)}
          onClose={handleAddMenuClose}
        >
          <MenuItem onClick={handleAddSimpleClick}>
            Simple Item
          </MenuItem>

          <MenuItem onClick={handleAddPortionsClick}>
            Portions Item
          </MenuItem>

          <MenuItem onClick={handleAddComboClick}>
            Combo Item
          </MenuItem>
        </Menu>
      </Box>

      {/* FILTERS */}

      <TableFilters
        searchValue={searchQuery}
        vegOnly={vegOnly}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
        onVegChange={(value) => {
          setVegOnly(value);
          setCurrentPage(1);
        }}
        preparation={prepFilter}
        onPreparationChange={(value) => {
          setPrepFilter(value);
          setCurrentPage(1);
        }}
      />

      {/* BULK UPDATE BAR: appears once rows are ticked */}
      {selectedIds.size > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid #C7D2FE',
            backgroundColor: '#EEF2FF',
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#3730A3' }}>
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </Typography>
          {totalItems > selectedIds.size && (
            <Button size="small" onClick={selectAllMatching} disabled={bulkLoading} sx={{ textTransform: 'none' }}>
              Select all {totalItems} matching
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="contained"
            disabled={bulkLoading}
            onClick={() => applyPreparationType('cooked')}
            sx={{ textTransform: 'none', backgroundColor: '#C2410C', '&:hover': { backgroundColor: '#9A3412' } }}
          >
            Mark as Cooked
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={bulkLoading}
            onClick={() => applyPreparationType('ready_to_eat')}
            sx={{ textTransform: 'none', backgroundColor: '#047857', '&:hover': { backgroundColor: '#065F46' } }}
          >
            Mark as Ready to eat
          </Button>
          <Button size="small" variant="outlined" disabled={bulkLoading} onClick={() => applyPreparationType(null)} sx={{ textTransform: 'none' }}>
            Clear (not set yet)
          </Button>
          <Button size="small" disabled={bulkLoading} onClick={clearSelection} sx={{ textTransform: 'none' }}>
            Deselect all
          </Button>
        </Box>
      )}

      {/* TABLE */}

      <FoodItemsTable
        items={items}
        loading={loading}
        columns={columnPrefs.columns}
        widths={columnPrefs.widths}
        totalWidth={columnPrefs.totalWidth}
        onColumnResize={columnPrefs.setWidth}
        onColumnReset={columnPrefs.resetWidth}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}

        // NEW PROP
        onDuplicate={handleDuplicateClick}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectPage={toggleSelectPage}
      />

      {/* PAGINATION */}

      {!loading && totalItems > 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 3,
          }}
        >
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </Box>
      )}

      {/* DIALOGS */}

      <SimpleFoodItemDialog
        open={simpleDialogOpen}
        item={selectedItem as SimpleFoodItem | null}
        subCategories={subCategories}
        loading={dialogLoading}
        onClose={() => setSimpleDialogOpen(false)}
        onSave={handleSave}
      />

      <PortionsFoodItemDialog
        open={portionsDialogOpen}
        item={selectedItem as PortionsFoodItem | null}
        subCategories={subCategories}
        loading={dialogLoading}
        onClose={() => setPortionsDialogOpen(false)}
        onSave={handleSave}
      />

      <ComboFoodItemDialog
        open={comboDialogOpen}
        item={selectedItem as ComboFoodItem | null}
        subCategories={subCategories}
        allFoodItems={allFoodItems}
        loading={dialogLoading}
        onClose={() => setComboDialogOpen(false)}
        onSave={handleSave}
      />

      {/* DELETE DIALOG */}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        itemName={itemToDelete?.name || ''}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
      />

      {/* SNACKBAR */}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={hideSnackbar}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}