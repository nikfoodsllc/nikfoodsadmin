'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Alert, Snackbar, Chip } from '@mui/material';
import { IconPlus } from '@tabler/icons-react';
import AdminUsersTable from './AdminUsersTable';
import AdminUserDialog from './AdminUserDialog';
import PasswordResetDialog from './PasswordResetDialog';
import ChangePasswordDialog from './ChangePasswordDialog';
import { UserDocument } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

type AdminUserWithoutPassword = Omit<UserDocument, 'password'>;

export default function AdminUsersPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminUserWithoutPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUserWithoutPassword | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [passwordResetDialogOpen, setPasswordResetDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [adminForPasswordReset, setAdminForPasswordReset] = useState<AdminUserWithoutPassword | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, _setIncludeInactive] = useState(true);

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Don't render until auth state is determined
  if (authLoading || !isAuthenticated) {
    return null;
  }

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Fetch admin users
  const fetchAdmins = useCallback(async () => {
    if (!isAuthenticated || !token) {
      showSnackbar('Authentication required. Please log in again.', 'error');
      return;
    }

    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (includeInactive) params.append('includeInactive', 'true');

      const response = await fetch(`/api/admin/admin-users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admin users');
      }

      const data = await response.json();
      setAdmins(data.data || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      showSnackbar('Failed to load admin users', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, includeInactive, isAuthenticated, token]);

  // Fetch admins when filters change
  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleCreateAdmin = () => {
    setSelectedAdmin(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleEditAdmin = (admin: AdminUserWithoutPassword) => {
    setSelectedAdmin(admin);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedAdmin(null);
  };

  const handleDialogSuccess = (message: string) => {
    handleDialogClose();
    showSnackbar(message, 'success');
    fetchAdmins(); // Refresh list
  };

  const handleDeactivateAdmin = async (adminId: string) => {
    if (!isAuthenticated || !token) {
      showSnackbar('Authentication required. Please log in again.', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/admin/admin-users/${adminId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate admin');
      }

      showSnackbar('Admin user deactivated successfully', 'success');
      fetchAdmins(); // Refresh list
    } catch (error) {
      console.error('Error deactivating admin:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to deactivate admin', 'error');
    }
  };

  const handleReactivateAdmin = async (adminId: string) => {
    if (!isAuthenticated || !token) {
      showSnackbar('Authentication required. Please log in again.', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/admin/admin-users/${adminId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reactivate admin');
      }

      showSnackbar('Admin user reactivated successfully', 'success');
      fetchAdmins(); // Refresh list
    } catch (error) {
      console.error('Error reactivating admin:', error);
      showSnackbar(error instanceof Error ? error.message : 'Failed to reactivate admin', 'error');
    }
  };

  const handleResetPassword = (admin: AdminUserWithoutPassword) => {
    setAdminForPasswordReset(admin);
    setPasswordResetDialogOpen(true);
  };

  const handlePasswordResetClose = () => {
    setPasswordResetDialogOpen(false);
    setAdminForPasswordReset(null);
  };

  const handlePasswordResetSuccess = (message: string) => {
    handlePasswordResetClose();
    showSnackbar(message, 'success');
  };

  const handleChangePassword = () => {
    setChangePasswordDialogOpen(true);
  };

  const handleChangePasswordClose = () => {
    setChangePasswordDialogOpen(false);
  };

  const handleChangePasswordSuccess = (message: string) => {
    handleChangePasswordClose();
    showSnackbar(message, 'success');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const activeAdmins = admins.filter(admin => admin.isActive !== false).length;
  const inactiveAdmins = admins.filter(admin => admin.isActive === false).length;

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
          Admin Users Management
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleChangePassword}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontSize: '13px',
            }}
          >
            Change My Password
          </Button>
          <Button
            variant="contained"
            startIcon={<IconPlus size={18} />}
            onClick={handleCreateAdmin}
            sx={{
              textTransform: 'none',
              backgroundColor: '#7C3AED',
              '&:hover': {
                backgroundColor: '#6D28D9',
              },
              borderRadius: 2,
              fontSize: '13px',
            }}
          >
            Add Admin
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, marginBottom: 3, flexWrap: 'wrap' }}>
        <Chip
          label={`Total: ${admins.length}`}
          sx={{
            backgroundColor: '#F3F4F6',
            color: '#374151',
            fontWeight: 500,
          }}
        />
        <Chip
          label={`Active: ${activeAdmins}`}
          sx={{
            backgroundColor: '#D1FAE5',
            color: '#065F46',
            fontWeight: 500,
          }}
        />
        {inactiveAdmins > 0 && (
          <Chip
            label={`Inactive: ${inactiveAdmins}`}
            sx={{
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              fontWeight: 500,
            }}
          />
        )}
      </Box>

      {/* Table */}
      <Box sx={{ marginBottom: 3 }}>
        <AdminUsersTable
          admins={admins}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onEditAdmin={handleEditAdmin}
          onDeactivateAdmin={handleDeactivateAdmin}
          onReactivateAdmin={handleReactivateAdmin}
          onResetPassword={handleResetPassword}
        />
      </Box>

      {/* Create/Edit Admin Dialog */}
      <AdminUserDialog
        open={dialogOpen}
        mode={dialogMode}
        admin={selectedAdmin}
        onClose={handleDialogClose}
        onSuccess={handleDialogSuccess}
      />

      {/* Password Reset Dialog */}
      <PasswordResetDialog
        open={passwordResetDialogOpen}
        admin={adminForPasswordReset}
        onClose={handlePasswordResetClose}
        onSuccess={handlePasswordResetSuccess}
      />

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordDialogOpen}
        onClose={handleChangePasswordClose}
        onSuccess={handleChangePasswordSuccess}
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
