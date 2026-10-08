'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchBox } from '@/hooks/useSearchBox';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { Box, Button, Typography, Alert, Snackbar, CircularProgress } from '@mui/material';
import { IconPlus } from '@tabler/icons-react';
import { FoodModifier, ModifierItemType } from '@/types/modifier';
import { useAuth } from '@/contexts/AuthContext';
import ModifiersTable from './ModifiersTable';
import ModifierDialog from './ModifierDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';

export default function ModifiersPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [modifiers, setModifiers] = useState<FoodModifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState<FoodModifier | null>(null);
  const [modifierToDelete, setModifierToDelete] = useState<FoodModifier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Filters
  const [itemTypeFilter, setItemTypeFilter] = useState<ModifierItemType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  // what is typed vs what the list is filtered by (it follows the box after a typing pause); only the newest load may update the list
  const searchBox = useSearchBox(() => setCurrentPage(1));
  const searchQuery = searchBox.query;
  const beginRequest = useLatestRequest();
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const fetchModifiers = useCallback(async () => {
    const request = beginRequest();
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (itemTypeFilter !== 'all') params.append('itemType', itemTypeFilter);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/admin/modifiers?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: request.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch modifiers');
      }

      const data = await response.json();
      if (!request.isCurrent()) return; // a newer search replaced this one
      setModifiers(data.data?.modifiers || []);
      setTotalItems(data.data?.total || 0);
    } catch (error) {
      if (request.signal.aborted || !request.isCurrent()) return; // cancelled by a newer search
      console.error('Error fetching modifiers:', error);
      showSnackbar('Failed to load modifiers', 'error');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [token, isAuthenticated, searchQuery, itemTypeFilter, currentPage, beginRequest]);

  useEffect(() => {
    fetchModifiers();
  }, [fetchModifiers]);

  const handleAddClick = () => {
    setSelectedModifier(null);
    setDialogOpen(true);
  };

  const handleEditClick = (modifier: FoodModifier) => {
    setSelectedModifier(modifier);
    setDialogOpen(true);
  };

  const handleDeleteClick = (modifier: FoodModifier) => {
    setModifierToDelete(modifier);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedModifier(null);
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setModifierToDelete(null);
  };

  const handleSave = async (data: Partial<Omit<FoodModifier, '_id'>> & { _id?: string }) => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const isEdit = !!data._id;
      const url = '/api/admin/modifiers';
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
        throw new Error(errorData.error || 'Failed to save modifier');
      }

      showSnackbar(isEdit ? 'Modifier updated successfully' : 'Modifier created successfully');
      await fetchModifiers();
      handleDialogClose();
    } catch (error) {
      console.error('Error saving modifier:', error);
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!modifierToDelete) return;

    setDeleteLoading(true);
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/modifiers?id=${modifierToDelete._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete modifier');
      }

      showSnackbar('Modifier deleted successfully');
      await fetchModifiers();
      handleDeleteDialogClose();
    } catch (error) {
      console.error('Error deleting modifier:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to delete modifier', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    searchBox.setInput(query);
  };

  const handleItemTypeFilter = (itemType: ModifierItemType | 'all') => {
    setItemTypeFilter(itemType);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} />
      </Box>
    );
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
          Food Modifiers
        </Typography>
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
          Add Modifier
        </Button>
      </Box>

      {/* Table */}
      <Box sx={{ marginBottom: 3 }}>
        <ModifiersTable
          modifiers={modifiers}
          loading={loading}
          searchQuery={searchBox.input}
          itemTypeFilter={itemTypeFilter}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onSearch={handleSearch}
          onItemTypeFilter={handleItemTypeFilter}
          onPageChange={handlePageChange}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      </Box>

      {/* Add/Edit Dialog */}
      <ModifierDialog
        open={dialogOpen}
        modifier={selectedModifier}
        onClose={handleDialogClose}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        modifierName={modifierToDelete?.name || ''}
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
