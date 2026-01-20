'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Typography,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  InputAdornment,
  Pagination,
  Checkbox,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconX, IconDeviceFloppy, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { Zipcode } from '@/types/zipcode';
import { useAuth } from '@/contexts/AuthContext';
import { safeFormatCurrency } from '@/utils/currency';
import { formatPSTDate } from '@/utils/timezone';
import ZipcodeDialog from './ZipcodeDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import MinCartValueSkeleton from './MinCartValueSkeleton';
import EditableTableCell from './EditableTableCell';

// Type for tracking edited values
interface EditedZipcode {
  zipcode?: string;
  label?: string;
}

export default function MinCartValuePage() {
  const { token, loading: authLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [zipcodes, setZipcodes] = useState<Zipcode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedZipcode, setSelectedZipcode] = useState<Zipcode | null>(null);
  const [zipcodeToDelete, setZipcodeToDelete] = useState<Zipcode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);

  // Inline editing state
  const [editingCellId, setEditingCellId] = useState<string | null>(null); // Format: "rowId-field"
  const [editedValues, setEditedValues] = useState<Map<string, EditedZipcode>>(new Map());

  // Batch save state
  const [batchSaveLoading, setBatchSaveLoading] = useState(false);
  const [batchSaveErrors, setBatchSaveErrors] = useState<Map<string, string>>(new Map());

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

  // Fetch zipcodes
  const fetchZipcodes = useCallback(async () => {
    try {
      setLoading(true);
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      params.append('page', currentPage.toString());
      params.append('pageSize', itemsPerPage.toString());

      const response = await fetch(`/api/admin/min-cart-value?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch zipcodes');
      }

      const data = await response.json();
      setZipcodes(data.data?.items || []);
      setTotalItems(data.data?.total || 0);
    } catch (error) {
      console.error('Error fetching zipcodes:', error);
      showSnackbar('Failed to load delivery zones', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage, token, isAuthenticated]);

  // Fetch zipcodes on mount and when dependencies change
  useEffect(() => {
    fetchZipcodes();
  }, [fetchZipcodes]);

  const handleAddClick = () => {
    setSelectedZipcode(null);
    setDialogOpen(true);
  };

  const handleEditClick = (zipcode: Zipcode) => {
    setSelectedZipcode(zipcode);
    setDialogOpen(true);
  };

  const handleDeleteClick = (zipcode: Zipcode) => {
    setZipcodeToDelete(zipcode);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedZipcode(null);
  };

  const handleDeleteDialogClose = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setZipcodeToDelete(null);
    }
  };

  const handleSave = async (data: Partial<Zipcode>) => {
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const isEdit = !!data._id;
      const url = '/api/admin/min-cart-value';
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
        throw new Error(errorData.error || 'Failed to save delivery zone');
      }

      showSnackbar(isEdit ? 'Delivery zone updated successfully' : 'Delivery zone created successfully');
      await fetchZipcodes();
    } catch (error) {
      console.error('Error saving zipcode:', error);
      throw error; // Re-throw to let dialog handle it
    }
  };

  const handleDeleteConfirm = async () => {
    if (!zipcodeToDelete) return;

    setDeleteLoading(true);
    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/admin/min-cart-value?id=${zipcodeToDelete._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete delivery zone');
      }

      showSnackbar('Delivery zone deleted successfully');
      await fetchZipcodes();
      handleDeleteDialogClose();
    } catch (error) {
      console.error('Error deleting zipcode:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to delete delivery zone',
        'error'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    // Block search if there are unsaved changes in bulk edit mode
    if (bulkEditMode && editedValues.size > 0) {
      showSnackbar('Please save or discard changes before searching', 'error');
      return;
    }
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
    // Clear selection when searching
    setSelectedIds(new Set());
    setBulkEditMode(false);
    setEditedValues(new Map());
    setEditingCellId(null);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    // Block page change if there are unsaved changes in bulk edit mode
    if (bulkEditMode && editedValues.size > 0) {
      showSnackbar('Please save or discard changes before changing pages', 'error');
      return;
    }
    setCurrentPage(page);
    // Clear selection when changing pages
    setSelectedIds(new Set());
    setBulkEditMode(false);
    setEditedValues(new Map());
    setEditingCellId(null);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Bulk selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === zipcodes.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all visible zipcodes
      setSelectedIds(new Set(zipcodes.map((z) => z._id)));
    }
  }, [selectedIds.size, zipcodes]);

  const handleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkEditMode(false);
    setEditedValues(new Map());
    setEditingCellId(null);
  }, []);

  const handleEnterBulkEdit = useCallback(() => {
    setBulkEditMode(true);
  }, []);

  // Inline editing handlers
  const handleStartEdit = useCallback((rowId: string, field: string) => {
    if (!bulkEditMode) {
      setEditingCellId(`${rowId}-${field}`);
    }
  }, [bulkEditMode]);

  const handleCancelEdit = useCallback(() => {
    setEditingCellId(null);
  }, []);

  const handleCellSave = useCallback(async (rowId: string, field: 'zipcode' | 'label', value: string | number) => {
    // Update edited values map
    setEditedValues((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(rowId) || {};
      newMap.set(rowId, { ...existing, [field]: value as string });
      return newMap;
    });

    // In single edit mode (not bulk), save immediately
    if (!bulkEditMode) {
      const zipcode = zipcodes.find((z) => z._id === rowId);
      if (zipcode) {
        try {
          const data: Partial<Zipcode> = {
            _id: rowId,
            zipcode: field === 'zipcode' ? (value as string) : zipcode.zipcode,
            label: field === 'label' ? (value as string) : zipcode.label,
            minCartValue: zipcode.minCartValue,
            deliveryFee: zipcode.deliveryFee,
          };
          await handleSave(data);
          setEditedValues((prev) => {
            const newMap = new Map(prev);
            newMap.delete(rowId);
            return newMap;
          });
        } catch (error) {
          // Error is handled by handleSave
          throw error;
        }
      }
    }

    setEditingCellId(null);
  }, [bulkEditMode, zipcodes, handleSave]);

  const handleDiscardChanges = useCallback(() => {
    setEditedValues(new Map());
    setBulkEditMode(false);
    setSelectedIds(new Set());
    setEditingCellId(null);
    setBatchSaveErrors(new Map());
  }, []);

  // Batch save handler
  const handleBatchSave = useCallback(async () => {
    // Validate all edits first
    const zipcodeRegex = /^\d{5}(-\d{4})?$/;
    const validationErrors: { rowId: string; field: string; message: string }[] = [];

    editedValues.forEach((edited, rowId) => {
      if (edited.zipcode !== undefined) {
        if (!edited.zipcode.trim()) {
          validationErrors.push({ rowId, field: 'zipcode', message: 'Zipcode is required' });
        } else if (!zipcodeRegex.test(edited.zipcode.trim())) {
          validationErrors.push({ rowId, field: 'zipcode', message: 'Invalid zipcode format' });
        }
      }
      if (edited.label !== undefined && edited.label.trim().length > 50) {
        validationErrors.push({ rowId, field: 'label', message: 'Label must be 50 characters or less' });
      }
    });

    if (validationErrors.length > 0) {
      showSnackbar(`Please fix ${validationErrors.length} validation error(s) before saving`, 'error');
      return;
    }

    if (editedValues.size === 0) {
      showSnackbar('No changes to save', 'error');
      return;
    }

    setBatchSaveLoading(true);
    setBatchSaveErrors(new Map());

    // Store original values for rollback
    const originalZipcodes = [...zipcodes];

    // Convert editedValues Map to array format for API
    const updates = Array.from(editedValues.entries()).map(([_id, edited]) => ({
      _id,
      ...(edited.zipcode !== undefined && { zipcode: edited.zipcode.trim() }),
      ...(edited.label !== undefined && { label: edited.label.trim() }),
    }));

    // Apply optimistic update
    setZipcodes((prev) =>
      prev.map((z) => {
        const edited = editedValues.get(z._id);
        if (edited) {
          return {
            ...z,
            ...(edited.zipcode !== undefined && { zipcode: edited.zipcode.trim() }),
            ...(edited.label !== undefined && { label: edited.label.trim() }),
          };
        }
        return z;
      })
    );

    try {
      if (!token || !isAuthenticated) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/admin/min-cart-value/batch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Complete failure - rollback all
        setZipcodes(originalZipcodes);
        throw new Error(data.error || 'Failed to save changes');
      }

      // Handle response
      if (data.success) {
        // All updates succeeded
        showSnackbar(`Successfully updated ${data.successCount} delivery zone(s)`);
        setEditedValues(new Map());
        setBulkEditMode(false);
        setSelectedIds(new Set());
        setEditingCellId(null);
        setBatchSaveErrors(new Map());
        // Refresh data from server to ensure consistency
        await fetchZipcodes();
      } else if (data.failureCount > 0 && data.successCount > 0) {
        // Partial failure
        const newErrors = new Map<string, string>();
        const failedIds = new Set<string>();

        data.results.forEach((result: { _id: string; success: boolean; error?: string }) => {
          if (!result.success) {
            newErrors.set(result._id, result.error || 'Unknown error');
            failedIds.add(result._id);
          }
        });

        // Rollback failed items only
        setZipcodes((prev) =>
          prev.map((z) => {
            if (failedIds.has(z._id)) {
              // Restore original value for failed items
              const original = originalZipcodes.find((o) => o._id === z._id);
              return original || z;
            }
            return z;
          })
        );

        // Remove successfully saved items from editedValues
        setEditedValues((prev) => {
          const newMap = new Map(prev);
          data.results.forEach((result: { _id: string; success: boolean }) => {
            if (result.success) {
              newMap.delete(result._id);
            }
          });
          return newMap;
        });

        setBatchSaveErrors(newErrors);
        showSnackbar(
          `${data.successCount} saved, ${data.failureCount} failed. Fix errors and retry.`,
          'error'
        );
      } else {
        // All updates failed
        setZipcodes(originalZipcodes);
        const newErrors = new Map<string, string>();
        data.results.forEach((result: { _id: string; success: boolean; error?: string }) => {
          if (!result.success) {
            newErrors.set(result._id, result.error || 'Unknown error');
          }
        });
        setBatchSaveErrors(newErrors);
        showSnackbar(`All ${data.failureCount} update(s) failed. Please check errors.`, 'error');
      }
    } catch (error) {
      console.error('Error in batch save:', error);
      // Rollback on error
      setZipcodes(originalZipcodes);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to save changes',
        'error'
      );
    } finally {
      setBatchSaveLoading(false);
    }
  }, [editedValues, zipcodes, fetchZipcodes, showSnackbar]);

  // Retry failed items
  const handleRetryFailed = useCallback(() => {
    // Only keep failed items in editedValues, clear errors
    setEditedValues((prev) => {
      const newMap = new Map<string, EditedZipcode>();
      batchSaveErrors.forEach((_, id) => {
        const edited = prev.get(id);
        if (edited) {
          newMap.set(id, edited);
        }
      });
      return newMap;
    });
    setBatchSaveErrors(new Map());
  }, [batchSaveErrors]);

  // Check if a row has a save error
  const hasRowError = useCallback((rowId: string) => {
    return batchSaveErrors.has(rowId);
  }, [batchSaveErrors]);

  // Get error message for a row
  const getRowError = useCallback((rowId: string) => {
    return batchSaveErrors.get(rowId);
  }, [batchSaveErrors]);

  // Computed values for selection state
  const isAllSelected = zipcodes.length > 0 && selectedIds.size === zipcodes.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < zipcodes.length;
  const hasSelection = selectedIds.size > 0;

  // Computed values for editing state
  const hasUnsavedChanges = editedValues.size > 0;

  // Get the display value for a cell (edited or original)
  const getCellValue = useCallback((rowId: string, field: 'zipcode' | 'label', originalValue: string | undefined) => {
    const edited = editedValues.get(rowId);
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    return originalValue || '';
  }, [editedValues]);

  // Check if a cell has been modified
  const isCellModified = useCallback((rowId: string, field: 'zipcode' | 'label') => {
    const edited = editedValues.get(rowId);
    return edited && edited[field] !== undefined;
  }, [editedValues]);

  // Validation for all edited values
  const validateAllEdits = useMemo(() => {
    const errors: { rowId: string; field: string; message: string }[] = [];
    const zipcodeRegex = /^\d{5}(-\d{4})?$/;

    editedValues.forEach((edited, rowId) => {
      if (edited.zipcode !== undefined) {
        if (!edited.zipcode.trim()) {
          errors.push({ rowId, field: 'zipcode', message: 'Zipcode is required' });
        } else if (!zipcodeRegex.test(edited.zipcode.trim())) {
          errors.push({ rowId, field: 'zipcode', message: 'Invalid zipcode format' });
        }
      }
      if (edited.label !== undefined && edited.label.trim().length > 50) {
        errors.push({ rowId, field: 'label', message: 'Label must be 50 characters or less' });
      }
    });

    return errors;
  }, [editedValues]);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
            Delivery Zones
          </Typography>
          {hasSelection && (
            <Chip
              label={`${selectedIds.size} selected`}
              size="small"
              sx={{
                backgroundColor: '#E6F0FF',
                color: '#4F8CFF',
                fontWeight: 500,
              }}
            />
          )}
          {bulkEditMode && (
            <Chip
              label="Bulk Edit Mode"
              size="small"
              sx={{
                backgroundColor: '#D1FAE5',
                color: '#059669',
                fontWeight: 500,
              }}
            />
          )}
          {hasUnsavedChanges && (
            <Chip
              label={`${editedValues.size} modified`}
              size="small"
              sx={{
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                fontWeight: 500,
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {bulkEditMode ? (
            <>
              <Button
                variant="outlined"
                startIcon={<IconRefresh size={18} />}
                onClick={handleDiscardChanges}
                disabled={batchSaveLoading}
                sx={{
                  textTransform: 'none',
                  borderColor: '#D1D5DB',
                  color: '#6B7280',
                  '&:hover': {
                    borderColor: '#9CA3AF',
                    backgroundColor: '#F9FAFB',
                  },
                }}
              >
                Discard Changes
              </Button>
              {batchSaveErrors.size > 0 && (
                <Button
                  variant="outlined"
                  onClick={handleRetryFailed}
                  disabled={batchSaveLoading}
                  sx={{
                    textTransform: 'none',
                    borderColor: '#F59E0B',
                    color: '#D97706',
                    '&:hover': {
                      borderColor: '#D97706',
                      backgroundColor: '#FFFBEB',
                    },
                  }}
                >
                  Retry Failed ({batchSaveErrors.size})
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={
                  batchSaveLoading ? (
                    <CircularProgress size={18} sx={{ color: 'white' }} />
                  ) : (
                    <IconDeviceFloppy size={18} />
                  )
                }
                onClick={handleBatchSave}
                disabled={batchSaveLoading || editedValues.size === 0 || validateAllEdits.length > 0}
                sx={{
                  textTransform: 'none',
                  backgroundColor: '#10B981',
                  paddingX: 3,
                  paddingY: 1.5,
                  '&:hover': {
                    backgroundColor: '#059669',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: '#D1D5DB',
                    color: '#9CA3AF',
                  },
                }}
              >
                {batchSaveLoading ? 'Saving...' : `Save All (${editedValues.size})`}
              </Button>
            </>
          ) : hasSelection && (
            <>
              <Button
                variant="outlined"
                startIcon={<IconX size={18} />}
                onClick={handleCancelSelection}
                sx={{
                  textTransform: 'none',
                  borderColor: '#D1D5DB',
                  color: '#6B7280',
                  '&:hover': {
                    borderColor: '#9CA3AF',
                    backgroundColor: '#F9FAFB',
                  },
                }}
              >
                Cancel Selection
              </Button>
              <Button
                variant="contained"
                onClick={handleEnterBulkEdit}
                sx={{
                  textTransform: 'none',
                  backgroundColor: '#10B981',
                  paddingX: 3,
                  paddingY: 1.5,
                  '&:hover': {
                    backgroundColor: '#059669',
                  },
                }}
              >
                Bulk Edit ({selectedIds.size})
              </Button>
            </>
          )}
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
            Add Delivery Zone
          </Button>
        </Box>
      </Box>

      {/* Batch Save Errors Alert */}
      {batchSaveErrors.size > 0 && (
        <Alert severity="error" sx={{ marginBottom: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1 }}>
            Failed Updates ({batchSaveErrors.size})
          </Typography>
          <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
            {Array.from(batchSaveErrors.entries()).slice(0, 5).map(([id, errorMsg]) => {
              const zipcode = zipcodes.find((z) => z._id === id);
              return (
                <li key={id} style={{ fontSize: '13px' }}>
                  {zipcode?.zipcode || id}: {errorMsg}
                </li>
              );
            })}
            {batchSaveErrors.size > 5 && (
              <li style={{ fontSize: '13px' }}>
                ...and {batchSaveErrors.size - 5} more errors
              </li>
            )}
          </Box>
          <Typography variant="body2" sx={{ marginTop: 1, fontSize: '12px', color: '#6B7280' }}>
            Fix the issues and click &quot;Retry Failed&quot; to try again.
          </Typography>
        </Alert>
      )}

      {/* Validation Errors Alert */}
      {bulkEditMode && validateAllEdits.length > 0 && (
        <Alert severity="warning" sx={{ marginBottom: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, marginBottom: 1 }}>
            Validation Errors ({validateAllEdits.length})
          </Typography>
          <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
            {validateAllEdits.slice(0, 5).map((error, idx) => (
              <li key={idx} style={{ fontSize: '13px' }}>
                Row {error.field}: {error.message}
              </li>
            ))}
            {validateAllEdits.length > 5 && (
              <li style={{ fontSize: '13px' }}>
                ...and {validateAllEdits.length - 5} more errors
              </li>
            )}
          </Box>
        </Alert>
      )}

      {/* Search */}
      <Box sx={{ marginBottom: 3 }}>
        <TextField
          placeholder="Search by zipcode or label..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          size="small"
          disabled={bulkEditMode && hasUnsavedChanges}
          sx={{
            width: { xs: '100%', sm: 400 },
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#F6FAFF',
              '&:hover fieldset': {
                borderColor: '#4F8CFF',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#4F8CFF',
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={20} style={{ color: '#9CA3AF' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: 3,
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#E6F0FF' }}>
              <TableCell sx={{ width: 50, padding: '8px 16px' }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={loading || zipcodes.length === 0}
                  sx={{
                    color: '#9CA3AF',
                    '&.Mui-checked': {
                      color: '#4F8CFF',
                    },
                    '&.MuiCheckbox-indeterminate': {
                      color: '#4F8CFF',
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Zipcode
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Label
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Min Order Value
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Delivery Fee
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Created Date
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: '13px', width: 120 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <MinCartValueSkeleton />
            ) : zipcodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8, color: '#9CA3AF' }}>
                  <Typography variant="body1">No delivery zones found</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {searchQuery
                      ? 'Try adjusting your search'
                      : 'Click "Add Delivery Zone" to get started'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              zipcodes.map((zipcode) => {
                const isSelected = selectedIds.has(zipcode._id);
                const isEditableInBulkMode = bulkEditMode && isSelected;
                const zipcodeModified = isCellModified(zipcode._id, 'zipcode');
                const labelModified = isCellModified(zipcode._id, 'label');
                const rowHasError = hasRowError(zipcode._id);
                const rowErrorMessage = getRowError(zipcode._id);

                return (
                  <TableRow
                    key={zipcode._id}
                    sx={{
                      backgroundColor: rowHasError
                        ? '#FEF2F2'
                        : isSelected
                        ? '#E6F0FF'
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: rowHasError
                          ? '#FEE2E2'
                          : isSelected
                          ? '#D6E6FF'
                          : '#F9FAFB',
                      },
                      transition: 'background-color 0.15s ease',
                      ...(rowHasError && {
                        borderLeft: '3px solid #EF4444',
                      }),
                    }}
                  >
                    <TableCell sx={{ padding: '8px 16px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleSelectRow(zipcode._id)}
                          disabled={bulkEditMode || batchSaveLoading}
                          sx={{
                            color: '#9CA3AF',
                            '&.Mui-checked': {
                              color: '#4F8CFF',
                            },
                          }}
                        />
                        {rowHasError && (
                          <Tooltip title={rowErrorMessage || 'Save failed'} arrow>
                            <IconAlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '14px',
                        color: '#374151',
                        fontWeight: 500,
                        ...(zipcodeModified && !rowHasError && {
                          borderLeft: '3px solid #F59E0B',
                          backgroundColor: '#FFFBEB',
                        }),
                        ...(rowHasError && {
                          backgroundColor: '#FEF2F2',
                        }),
                      }}
                    >
                      <EditableTableCell
                        value={getCellValue(zipcode._id, 'zipcode', zipcode.zipcode)}
                        fieldType="zipcode"
                        isEditing={isEditableInBulkMode || editingCellId === `${zipcode._id}-zipcode`}
                        disabled={(bulkEditMode && !isSelected) || batchSaveLoading}
                        onStartEdit={() => handleStartEdit(zipcode._id, 'zipcode')}
                        onCancelEdit={handleCancelEdit}
                        onSave={(value) => handleCellSave(zipcode._id, 'zipcode', value)}
                        placeholder="Enter zipcode"
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '14px',
                        color: '#6B7280',
                        ...(labelModified && !rowHasError && {
                          borderLeft: '3px solid #F59E0B',
                          backgroundColor: '#FFFBEB',
                        }),
                        ...(rowHasError && {
                          backgroundColor: '#FEF2F2',
                        }),
                      }}
                    >
                      <EditableTableCell
                        value={getCellValue(zipcode._id, 'label', zipcode.label)}
                        fieldType="label"
                        isEditing={isEditableInBulkMode || editingCellId === `${zipcode._id}-label`}
                        disabled={(bulkEditMode && !isSelected) || batchSaveLoading}
                        onStartEdit={() => handleStartEdit(zipcode._id, 'label')}
                        onCancelEdit={handleCancelEdit}
                        onSave={(value) => handleCellSave(zipcode._id, 'label', value)}
                        placeholder="Enter label (optional)"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '14px', color: '#374151' }}>
                      {safeFormatCurrency(zipcode.minCartValue)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '14px', color: '#374151' }}>
                      {safeFormatCurrency(zipcode.deliveryFee)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '14px', color: '#6B7280' }}>
                      {formatPSTDate(zipcode.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(zipcode)}
                          disabled={bulkEditMode || batchSaveLoading}
                          sx={{
                            color: '#4F8CFF',
                            '&:hover': {
                              backgroundColor: isSelected ? '#C6D6EF' : '#E6F0FF',
                            },
                          }}
                        >
                          <IconEdit size={18} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(zipcode)}
                          disabled={bulkEditMode || batchSaveLoading}
                          sx={{
                            color: '#EF4444',
                            '&:hover': {
                              backgroundColor: '#FEE2E2',
                            },
                          }}
                        >
                          <IconTrash size={18} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {!loading && totalItems > 0 && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            disabled={bulkEditMode && hasUnsavedChanges}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                '&.Mui-selected': {
                  backgroundColor: '#4F8CFF',
                  '&:hover': {
                    backgroundColor: '#3B7AE8',
                  },
                },
              },
            }}
          />
        </Box>
      )}

      {/* Zipcode Dialog */}
      <ZipcodeDialog
        open={dialogOpen}
        zipcode={selectedZipcode}
        onClose={handleDialogClose}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        zipcode={zipcodeToDelete?.zipcode || ''}
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
