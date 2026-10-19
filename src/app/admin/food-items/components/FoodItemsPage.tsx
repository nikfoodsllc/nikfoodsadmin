'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSearchBox } from '@/hooks/useSearchBox';
import { useLatestRequest } from '@/hooks/useLatestRequest';
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
  ToggleButton,
  ToggleButtonGroup,
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
import { PreparationType } from '@/utils/preparationType';
import { StickerFlag } from '@/utils/stickerFlag';
import { DEFAULT_FOOD_ITEM_FILTERS, FoodItemFilters, buildCategoryTree, foodItemFilterParams, type CategoryTree } from './foodItemFilters';
import TablePagination from './TablePagination';
import { usePageSize } from '@/hooks/usePageSize';
import { PageSize, pageSizeToLimit, totalPagesFor } from '@/utils/pageSize';
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
  sticker?: StickerFlag;
  splitSticker?: StickerFlag;
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

type BulkField = 'available' | 'veg' | 'preparation' | 'sticker' | 'splitSticker';

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
  // the categories as the Category / Sub Category filters need them
  const [categoryTree, setCategoryTree] = useState<CategoryTree>({ children: new Map() });
  const [categoryFilterOptions, setCategoryFilterOptions] = useState<{ top: Array<{ _id: string; name: string }>; subs: Array<{ _id: string; name: string; parentId: string; parentName: string }> }>({ top: [], subs: [] });

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

  // Column filters (veg, available, type, preparation type) + the rows ticked for the bulk update
  const [filters, setFilters] = useState<FoodItemFilters>(DEFAULT_FOOD_ITEM_FILTERS);
  // which field the bulk bar is about to change: chosen first, then its options are shown
  const [bulkField, setBulkField] = useState<BulkField | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  // what is typed vs what the list is filtered by (it follows the box after a typing pause); only the newest load may update the list
  const searchBox = useSearchBox(() => setCurrentPage(1));
  const searchQuery = searchBox.query;
  const beginRequest = useLatestRequest();

  const [totalItems, setTotalItems] = useState(0);

  // rows per page: 10 / 50 / 100 / all (100 unless changed; remembered in this browser)
  const [pageSize, setPageSize] = usePageSize('food-items');
  const itemsPerPage = pageSizeToLimit(pageSize);
  const changePageSize = (size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  };

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
      setCategoryTree(buildCategoryTree(raw));
      const hasParent = (c: RawCategory) => c.parentCategoryId != null && String(c.parentCategoryId).trim() !== '';
      // the same order as the Food Category page: by sequence, then name; sub-categories grouped under their category
      const bySequence = (a: RawCategory & { sequence?: number }, b: RawCategory & { sequence?: number }) =>
        (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
      const topList = raw.filter((c) => !hasParent(c)).sort(bySequence).map((c) => ({ _id: String(c._id), name: c.name }));
      const nameOf = new Map(topList.map((c) => [c._id, c.name]));
      const topRank = new Map(topList.map((c, i) => [c._id, i]));
      setCategoryFilterOptions({
        top: topList,
        subs: raw
          .filter(hasParent)
          .sort((a, b) => (topRank.get(String(a.parentCategoryId)) ?? 1e9) - (topRank.get(String(b.parentCategoryId)) ?? 1e9) || bySequence(a, b))
          .map((c) => ({ _id: String(c._id), name: c.name, parentId: String(c.parentCategoryId), parentName: nameOf.get(String(c.parentCategoryId)) ?? '' })),
      });
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  const fetchItems = useCallback(async () => {
    const request = beginRequest();
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      for (const [key, value] of foodItemFilterParams(filters, categoryTree)) {
        params.append(key, value);
      }

      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(
        `/api/admin/food-items?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: request.signal,
        }
      );

      const data = await response.json();
      if (!request.isCurrent()) return; // a newer search replaced this one

      setItems(data.data?.items || []);
      setTotalItems(data.data?.total || 0);
    } catch (error) {
      if (request.signal.aborted || !request.isCurrent()) return; // cancelled by a newer search
      console.error(error);

      showSnackbar('Failed to fetch items', 'error');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [
    token,
    searchQuery,
    filters,
    categoryTree,
    currentPage,
    itemsPerPage,
    beginRequest,
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
      for (const [key, value] of foodItemFilterParams(filters, categoryTree)) params.append(key, value);
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

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkField(null);
  };

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
      setBulkField(null);
      await fetchItems();
    } catch (error) {
      console.error(error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to update items', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Available (on / off) and Veg / Non-Veg: both are shown to customers, so the server also refreshes the menu
  const applyFlag = async (field: 'available' | 'veg', value: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      setBulkLoading(true);
      const response = await fetch('/api/admin/food-items/bulk-flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [...selectedIds], field, value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update items');
      const label = field === 'available' ? (value ? 'Available' : 'Unavailable') : value ? 'Veg' : 'Non-Veg';
      showSnackbar(`${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'} set to ${label}`);
      setSelectedIds(new Set());
      setBulkField(null);
      await fetchItems();
    } catch (error) {
      console.error(error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to update items', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const applySticker = async (sticker: StickerFlag | null, field: 'sticker' | 'splitSticker' = 'sticker') => {
    if (selectedIds.size === 0) return;
    try {
      setBulkLoading(true);
      const response = await fetch('/api/admin/food-items/sticker', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [...selectedIds], sticker, field }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update items');
      const name = field === 'splitSticker' ? 'Split Sticker' : 'Sticker';
      const label = sticker === 'yes' ? `${name}: Yes` : sticker === 'no' ? `${name}: No` : `${name}: not set yet`;
      showSnackbar(`${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'} set to ${label}`);
      setSelectedIds(new Set());
      setBulkField(null);
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

  const totalPages = totalPagesFor(totalItems, pageSize);

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
        searchValue={searchBox.input}
        onSearchChange={(value) => searchBox.setInput(value)}
        filters={filters}
        categoryOptions={categoryFilterOptions}
        onFilterChange={(key, value) => {
          setFilters((prev) => ({ ...prev, [key]: value }));
          setCurrentPage(1);
        }}
      />

      {/* BULK UPDATE BAR: appears once rows are ticked */}
      {selectedIds.size > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid #C7D2FE',
            backgroundColor: '#EEF2FF',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#3730A3' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
            </Typography>
            {totalItems > selectedIds.size && (
              <Button size="small" onClick={selectAllMatching} disabled={bulkLoading} sx={{ textTransform: 'none' }}>
                Select all {totalItems} matching
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button size="small" disabled={bulkLoading} onClick={clearSelection} sx={{ textTransform: 'none' }}>
              Deselect all
            </Button>
          </Box>

          {/* Step 1: which field to update */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#3730A3' }}>Update which field?</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={bulkField}
              disabled={bulkLoading}
              onChange={(_, next: BulkField | null) => setBulkField(next)}
              sx={{ backgroundColor: '#fff', '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 1.5, py: 0.5 } }}
            >
              <ToggleButton value="available">Available</ToggleButton>
              <ToggleButton value="veg">Veg/Non-Veg</ToggleButton>
              <ToggleButton value="preparation">Preparation Type</ToggleButton>
              <ToggleButton value="sticker">Sticker</ToggleButton>
              <ToggleButton value="splitSticker">Split Sticker</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Step 2: the choices for that field */}
          {bulkField === 'available' && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#3730A3' }}>Set Available to:</Typography>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applyFlag('available', true)} sx={{ textTransform: 'none', backgroundColor: '#047857', '&:hover': { backgroundColor: '#065F46' } }}>
                Available
              </Button>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applyFlag('available', false)} sx={{ textTransform: 'none', backgroundColor: '#B91C1C', '&:hover': { backgroundColor: '#991B1B' } }}>
                Unavailable
              </Button>
            </Box>
          )}
          {bulkField === 'veg' && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#3730A3' }}>Set Veg/Non-Veg to:</Typography>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applyFlag('veg', true)} sx={{ textTransform: 'none', backgroundColor: '#047857', '&:hover': { backgroundColor: '#065F46' } }}>
                Veg
              </Button>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applyFlag('veg', false)} sx={{ textTransform: 'none', backgroundColor: '#B91C1C', '&:hover': { backgroundColor: '#991B1B' } }}>
                Non-Veg
              </Button>
            </Box>
          )}
          {bulkField === 'preparation' && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#3730A3' }}>Set Preparation Type to:</Typography>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applyPreparationType('cooked')} sx={{ textTransform: 'none', backgroundColor: '#C2410C', '&:hover': { backgroundColor: '#9A3412' } }}>
                Cooked
              </Button>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applyPreparationType('ready_to_eat')} sx={{ textTransform: 'none', backgroundColor: '#047857', '&:hover': { backgroundColor: '#065F46' } }}>
                Ready to eat
              </Button>
              <Button size="small" variant="outlined" disabled={bulkLoading} onClick={() => applyPreparationType(null)} sx={{ textTransform: 'none' }}>
                Clear (not set yet)
              </Button>
            </Box>
          )}
          {bulkField === 'sticker' && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#3730A3' }}>Set Sticker to:</Typography>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applySticker('yes')} sx={{ textTransform: 'none', backgroundColor: '#047857', '&:hover': { backgroundColor: '#065F46' } }}>
                Yes
              </Button>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applySticker('no')} sx={{ textTransform: 'none', backgroundColor: '#B91C1C', '&:hover': { backgroundColor: '#991B1B' } }}>
                No
              </Button>
            </Box>
          )}
          {bulkField === 'splitSticker' && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#3730A3' }}>Set Split Sticker to:</Typography>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applySticker('yes', 'splitSticker')} sx={{ textTransform: 'none', backgroundColor: '#047857', '&:hover': { backgroundColor: '#065F46' } }}>
                Yes
              </Button>
              <Button size="small" variant="contained" disabled={bulkLoading} onClick={() => applySticker('no', 'splitSticker')} sx={{ textTransform: 'none', backgroundColor: '#B91C1C', '&:hover': { backgroundColor: '#991B1B' } }}>
                No
              </Button>
              <Button size="small" variant="outlined" disabled={bulkLoading} onClick={() => applySticker(null, 'splitSticker')} sx={{ textTransform: 'none' }}>
                Clear (not set yet)
              </Button>
            </Box>
          )}
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
            pageSize={pageSize}
            onPageSizeChange={changePageSize}
            totalItems={totalItems}
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