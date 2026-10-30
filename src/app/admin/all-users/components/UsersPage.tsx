'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  TextField,
} from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import UsersTable from './UsersTable';
import SearchBar from './SearchBar';
import { useSearchBox } from '@/hooks/useSearchBox';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import UserDetailsDialog from './UserDetailsDialog';
import ExportCustomersDialog, { UNSUBSCRIBED_TEXT } from './ExportCustomersDialog';
import TablePagination from '../../food-items/components/TablePagination';
import { usePageSize } from '@/hooks/usePageSize';
import { PageSize, pageSizeToLimit, totalPagesFor } from '@/utils/pageSize';
import { UserWithAddresses } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { type TextFilter, type UserSort, parseTextFilter, parseUserSort } from '@/utils/userFilters';

export default function UsersPage() {
  const router = useRouter();
  const { token, loading: authLoading, isAuthenticated } = useAuth();

  const [users, setUsers] = useState<UserWithAddresses[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithAddresses | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // the details dialog can open straight in edit mode (the pencil in the table)
  const [startEditing, setStartEditing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [unsubOpen, setUnsubOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithAddresses | null>(null);

  // Filters and pagination
  const [currentPage, setCurrentPage] = useState(1);
  // what is typed vs what the list is filtered by (it follows the box after a typing pause); only the newest load may update the list
  const searchBox = useSearchBox(() => setCurrentPage(1));
  const searchQuery = searchBox.query;
  const beginRequest = useLatestRequest();
  const [textFilter, setTextFilter] = useState<TextFilter>('all');
  const [sort, setSort] = useState<UserSort>('newest');
  const [totalUsers, setTotalUsers] = useState(0);
  // rows per page: 10 / 50 / 100 / all (100 unless changed; remembered in this browser)
  const [pageSize, setPageSize] = usePageSize('all-users');
  const itemsPerPage = pageSizeToLimit(pageSize);

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

  // Fetch users with search
  const fetchUsers = useCallback(async () => {
    const request = beginRequest();
    try {
      setLoading(true);

      // Check authentication
      if (!token || !isAuthenticated) {
        router.push('/login');
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (textFilter !== 'all') params.append('texts', textFilter);
      if (sort !== 'newest') params.append('sort', sort);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: request.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      if (!request.isCurrent()) return; // a newer search replaced this one
      setUsers(data.data?.items || []);
      setTotalUsers(data.data?.total || 0);
    } catch (error) {
      if (request.signal.aborted || !request.isCurrent()) return; // cancelled by a newer search
      console.error('Error fetching users:', error);
      showSnackbar('Failed to load users', 'error');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [token, isAuthenticated, router, searchQuery, textFilter, sort, currentPage, itemsPerPage, beginRequest]);

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // after a save the list is reloaded: show the saved values in the open dialog
  useEffect(() => {
    setSelectedUser((cur) => {
      if (!cur?._id) return cur;
      const id = String(cur._id);
      return users.find((u) => String(u._id) === id) ?? cur;
    });
  }, [users]);

  // Show loading spinner while auth is initializing
  if (authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!token || !isAuthenticated) {
    router.push('/login');
    return null;
  }

  const handleViewDetails = (user: UserWithAddresses) => {
    setStartEditing(false);
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setStartEditing(false);
  };

  const getUserId = (user: UserWithAddresses): string => {
    if (!user._id) return '';
    return typeof user._id === 'string' ? user._id : user._id.toString();
  };

  const handleEditUser = (user: UserWithAddresses) => {
    setStartEditing(true);
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDeleteUser = (user: UserWithAddresses) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    if (actionLoading) return;
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;

    const userId = getUserId(userToDelete);
    if (!userId) {
      showSnackbar('Invalid user ID', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      showSnackbar('User deleted successfully');
      handleDeleteDialogClose();
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to delete user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    searchBox.setInput(value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const totalPages = totalPagesFor(totalUsers, pageSize);
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
          All Users
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
            Total: {totalUsers} users
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<IconDownload size={16} />}
            onClick={() => setExportOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<IconDownload size={16} />}
            onClick={() => setUnsubOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Unsubscribed CSV
          </Button>
        </Box>
      </Box>

      {/* Search, filter and sort */}
      <Box sx={{ marginBottom: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <SearchBar value={searchBox.input} onChange={handleSearchChange} />
        <TextField
          select
          size="small"
          label="Text messages"
          value={textFilter}
          onChange={(e) => { setTextFilter(parseTextFilter(e.target.value)); setCurrentPage(1); }}
          sx={{ minWidth: 190, backgroundColor: '#fff' }}
        >
          <MenuItem value="all">All customers</MenuItem>
          <MenuItem value="agreed">Agreed to texts</MenuItem>
          <MenuItem value="stopped">Stopped texts</MenuItem>
          <MenuItem value="never">Never agreed</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Sort by"
          value={sort}
          onChange={(e) => { setSort(parseUserSort(e.target.value)); setCurrentPage(1); }}
          sx={{ minWidth: 170, backgroundColor: '#fff' }}
        >
          <MenuItem value="newest">Newest first</MenuItem>
          <MenuItem value="oldest">Oldest first</MenuItem>
          <MenuItem value="name_asc">Name A to Z</MenuItem>
          <MenuItem value="name_desc">Name Z to A</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <Box sx={{ marginBottom: 3 }}>
        <UsersTable
          users={users}
          loading={loading}
          onViewDetails={handleViewDetails}
          onEditUser={handleEditUser}
          onDeleteUser={handleDeleteUser}
        />
      </Box>

      {/* Pagination */}
      {!loading && totalUsers > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            totalItems={totalUsers}
          />
        </Box>
      )}

      {/* User Details Dialog */}
      <UserDetailsDialog
        open={dialogOpen}
        user={selectedUser}
        startEditing={startEditing}
        onChanged={fetchUsers}
        onClose={handleDialogClose}
      />

      <ExportCustomersDialog open={exportOpen} token={token} onClose={() => setExportOpen(false)} />
      <ExportCustomersDialog open={unsubOpen} token={token} onClose={() => setUnsubOpen(false)} text={UNSUBSCRIBED_TEXT} />

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB' }}>Delete User</DialogTitle>
        <DialogContent sx={{ paddingTop: 3 }}>
          <Typography variant="body2" sx={{ color: '#374151', marginTop: 1 }}>
            Are you sure you want to delete{' '}
            <Typography component="span" sx={{ fontWeight: 600 }}>
              {userToDelete?.name || userToDelete?.email}
            </Typography>
            ? This action will deactivate the user account.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button onClick={handleDeleteDialogClose} disabled={actionLoading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteUser}
            disabled={actionLoading}
            sx={{ textTransform: 'none' }}
          >
            {actionLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

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
