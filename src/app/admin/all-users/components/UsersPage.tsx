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
  TextField,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import UsersTable from './UsersTable';
import SearchBar from './SearchBar';
import UserDetailsDialog from './UserDetailsDialog';
import TablePagination from '../../food-items/components/TablePagination';
import { UserWithAddresses } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';

export default function UsersPage() {
  const router = useRouter();
  const { token, loading: authLoading, isAuthenticated } = useAuth();

  const [users, setUsers] = useState<UserWithAddresses[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithAddresses | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithAddresses | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithAddresses | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const itemsPerPage = 10;

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
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.data?.items || []);
      setTotalUsers(data.data?.total || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      showSnackbar('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, router, searchQuery, currentPage]);

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

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleViewDetails = (user: UserWithAddresses) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const getUserId = (user: UserWithAddresses): string => {
    if (!user._id) return '';
    return typeof user._id === 'string' ? user._id : user._id.toString();
  };

  const handleEditUser = (user: UserWithAddresses) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
    });
    setEditDialogOpen(true);
  };

  const handleDeleteUser = (user: UserWithAddresses) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    if (actionLoading) return;
    setEditDialogOpen(false);
    setEditingUser(null);
    setEditForm({ name: '', email: '', phone: '' });
  };

  const handleDeleteDialogClose = () => {
    if (actionLoading) return;
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const userId = getUserId(editingUser);
    if (!userId) {
      showSnackbar('Invalid user ID', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim() || null,
          email: editForm.email.trim(),
          phone: editForm.phone.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      showSnackbar('User updated successfully');
      handleEditDialogClose();
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to update user', 'error');
    } finally {
      setActionLoading(false);
    }
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
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(totalUsers / itemsPerPage);

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
        </Box>
      </Box>

      {/* Search Bar */}
      <Box sx={{ marginBottom: 3 }}>
        <SearchBar value={searchQuery} onChange={handleSearchChange} />
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
          />
        </Box>
      )}

      {/* User Details Dialog */}
      <UserDetailsDialog
        open={dialogOpen}
        user={selectedUser}
        onClose={handleDialogClose}
      />

      {/* Update User Dialog */}
      <Dialog open={editDialogOpen} onClose={handleEditDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          Update User
          <Button
            onClick={handleEditDialogClose}
            sx={{
              minWidth: 'auto',
              padding: 0.5,
              color: '#6B7280',
              '&:hover': {
                backgroundColor: '#F3F4F6',
              },
            }}
          >
            <IconX size={18} />
          </Button>
        </DialogTitle>
        <DialogContent sx={{ paddingTop: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
            <TextField
              label="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              fullWidth
              size="small"
              required
            />
            <TextField
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ padding: 2, borderTop: '1px solid #E5E7EB' }}>
          <Button onClick={handleEditDialogClose} disabled={actionLoading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateUser}
            disabled={actionLoading || !editForm.email.trim()}
            sx={{ textTransform: 'none', backgroundColor: '#4F8CFF' }}
          >
            {actionLoading ? 'Saving...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

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
