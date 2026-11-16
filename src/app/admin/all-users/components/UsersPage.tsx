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
  Paper,
  TextField,
} from '@mui/material';
import { IconDownload } from '@tabler/icons-react';
import UsersTable from './UsersTable';
import SearchBar from './SearchBar';
import { useSearchBox } from '@/hooks/useSearchBox';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import UserDetailsDialog from './UserDetailsDialog';
import ExportCustomersDialog, { UNSUBSCRIBED_TEXT } from './ExportCustomersDialog';
import BulkUpdateDialog from './BulkUpdateDialog';
import { BULK_MAX_CUSTOMERS } from '@/utils/bulkUsers';
import TablePagination from '../../food-items/components/TablePagination';
import { usePageSize } from '@/hooks/usePageSize';
import { PageSize, pageSizeToLimit, totalPagesFor } from '@/utils/pageSize';
import { UserWithAddresses } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { type EmailFilter, type TextFilter, type UserSort, parseEmailFilter, parseTextFilter, parseUserSort } from '@/utils/userFilters';

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
  // customers ticked for a bulk update (kept across pages; cleared when the search or a filter changes)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  // what is typed vs what the list is filtered by (it follows the box after a typing pause); only the newest load may update the list
  const searchBox = useSearchBox(() => { setCurrentPage(1); setSelected(new Set()); });
  const searchQuery = searchBox.query;
  const beginRequest = useLatestRequest();
  const [textFilter, setTextFilter] = useState<TextFilter>('all');
  const [emailFilter, setEmailFilter] = useState<EmailFilter>('all');
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
      if (emailFilter !== 'all') params.append('emails', emailFilter);
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
  }, [token, isAuthenticated, router, searchQuery, textFilter, emailFilter, sort, currentPage, itemsPerPage, beginRequest]);

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

  const idOf = (u: UserWithAddresses) => (u._id ? String(u._id) : '');
  const toggleOne = (u: UserWithAddresses) =>
    setSelected((cur) => {
      const next = new Set(cur);
      const id = idOf(u);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = (checked: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const u of users) {
        if (u.role === 'ADMIN' || !idOf(u)) continue;
        if (checked) next.add(idOf(u));
        else next.delete(idOf(u));
      }
      return next;
    });
  // everyone who matches the current search and filters, across all pages
  const selectAllMatching = async () => {
    if (!token) return;
    setSelectingAll(true);
    try {
      const params = new URLSearchParams({ idsOnly: '1' });
      if (searchQuery) params.append('search', searchQuery);
      if (textFilter !== 'all') params.append('texts', textFilter);
      if (emailFilter !== 'all') params.append('emails', emailFilter);
      const response = await fetch(`/api/admin/users?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = (await response.json().catch(() => ({}))) as { data?: { ids: string[]; total: number } };
      if (!response.ok || !json.data) throw new Error('failed');
      if (json.data.ids.length > BULK_MAX_CUSTOMERS) {
        showSnackbar(`That is ${json.data.ids.length} customers. Narrow the search or filters to ${BULK_MAX_CUSTOMERS} or fewer.`, 'error');
        return;
      }
      setSelected(new Set(json.data.ids));
    } catch {
      showSnackbar('Could not select everyone. Try again.', 'error');
    } finally {
      setSelectingAll(false);
    }
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
          onChange={(e) => { setTextFilter(parseTextFilter(e.target.value)); setCurrentPage(1); setSelected(new Set()); }}
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
          label="Emails"
          value={emailFilter}
          onChange={(e) => { setEmailFilter(parseEmailFilter(e.target.value)); setCurrentPage(1); setSelected(new Set()); }}
          sx={{ minWidth: 190, backgroundColor: '#fff' }}
        >
          <MenuItem value="all">All customers</MenuItem>
          <MenuItem value="agreed">Subscribed to emails</MenuItem>
          <MenuItem value="stopped">Stopped emails</MenuItem>
          <MenuItem value="never">Not subscribed</MenuItem>
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
          selected={selected}
          onToggle={toggleOne}
          onTogglePage={togglePage}
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

      {/* Bulk update bar: appears once someone is ticked */}
      {selected.size > 0 && (
        <>
        {/* room under the table so the bar never hides the last rows */}
        <Box sx={{ height: 84 }} />
        <Paper elevation={6} sx={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', width: 'min(720px, calc(100vw - 24px))', zIndex: 1200, p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', border: '1px solid #E5E7EB' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14, mr: 'auto' }}>{selected.size} selected</Typography>
          {selected.size < totalUsers && (
            <Button size="small" disabled={selectingAll} onClick={selectAllMatching} sx={{ textTransform: 'none', fontWeight: 700 }}>
              {selectingAll ? 'Selecting…' : `Select all ${totalUsers} matching`}
            </Button>
          )}
          <Button size="small" onClick={() => setSelected(new Set())} sx={{ textTransform: 'none' }}>Clear</Button>
          <Button size="small" variant="contained" onClick={() => setBulkOpen(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>Update selected</Button>
        </Paper>
        </>
      )}
      <BulkUpdateDialog open={bulkOpen} token={token} ids={[...selected]} onClose={() => setBulkOpen(false)} onChanged={() => { setSelected(new Set()); fetchUsers(); }} />

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
