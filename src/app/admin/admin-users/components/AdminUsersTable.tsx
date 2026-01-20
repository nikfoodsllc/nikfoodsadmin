'use client';

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { IconSearch, IconEdit, IconKey, IconUserOff, IconUserCheck } from '@tabler/icons-react';
import { UserDocument } from '@/types/user';
import { formatPSTDate } from '@/utils/timezone';

type AdminUserWithoutPassword = Omit<UserDocument, 'password'>;

interface AdminUsersTableProps {
  admins: AdminUserWithoutPassword[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onEditAdmin: (admin: AdminUserWithoutPassword) => void;
  onDeactivateAdmin: (adminId: string) => void;
  onReactivateAdmin: (adminId: string) => void;
  onResetPassword: (admin: AdminUserWithoutPassword) => void;
}

export default function AdminUsersTable({
  admins,
  loading,
  searchQuery,
  onSearchChange,
  onEditAdmin,
  onDeactivateAdmin,
  onReactivateAdmin,
  onResetPassword,
}: AdminUsersTableProps) {
  const currentUserId = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('admin_user') || '{}')._id
    : null;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      {/* Search Bar */}
      <Box sx={{ marginBottom: 2 }}>
        <TextField
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          fullWidth
          sx={{
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={20} color="#666" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          minWidth: 800,
          borderRadius: 3,
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: '#F9FAFB',
              }}
            >
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Name
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Email
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Phone
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Status
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px' }}>
                Created On
              </TableCell>
              <TableCell sx={{ padding: '12px', fontWeight: 600, color: '#374151', fontSize: '13px', textAlign: 'right' }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                </TableRow>
              ))
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                  <Typography variant="body2" color="text.secondary">
                    No admin users found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin, index) => {
                const isActive = admin.isActive !== false; // Default to true if undefined
                const isCurrentUser = admin._id?.toString() === currentUserId;

                return (
                  <TableRow
                    key={admin._id?.toString() || index}
                    sx={{
                      '&:hover': {
                        backgroundColor: '#F9FAFB',
                      },
                      opacity: isActive ? 1 : 0.6,
                    }}
                  >
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                        {admin.name || 'N/A'}
                        {isCurrentUser && (
                          <Chip
                            label="You"
                            size="small"
                            sx={{
                              marginLeft: 1,
                              height: 20,
                              fontSize: '11px',
                              backgroundColor: '#DBEAFE',
                              color: '#1E40AF',
                            }}
                          />
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ color: '#374151' }}>
                        {admin.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
                        {admin.phone || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Chip
                        label={isActive ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          backgroundColor: isActive ? '#D1FAE5' : '#FEE2E2',
                          color: isActive ? '#065F46' : '#991B1B',
                          fontWeight: 500,
                          fontSize: '12px',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ padding: '12px' }}>
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
                        {formatPSTDate(admin.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ padding: '12px', textAlign: 'right' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => onEditAdmin(admin)}
                            sx={{ color: '#6B7280', '&:hover': { color: '#7C3AED' } }}
                          >
                            <IconEdit size={18} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Reset Password">
                          <IconButton
                            size="small"
                            onClick={() => onResetPassword(admin)}
                            sx={{ color: '#6B7280', '&:hover': { color: '#EA580C' } }}
                          >
                            <IconKey size={18} />
                          </IconButton>
                        </Tooltip>

                        {isActive ? (
                          <Tooltip title={isCurrentUser ? 'Cannot deactivate yourself' : 'Deactivate'}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => !isCurrentUser && onDeactivateAdmin(admin._id?.toString() || '')}
                                disabled={isCurrentUser}
                                sx={{
                                  color: '#6B7280',
                                  '&:hover': { color: '#DC2626' },
                                  '&.Mui-disabled': { color: '#D1D5DB' },
                                }}
                              >
                                <IconUserOff size={18} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Reactivate">
                            <IconButton
                              size="small"
                              onClick={() => onReactivateAdmin(admin._id?.toString() || '')}
                              sx={{ color: '#6B7280', '&:hover': { color: '#059669' } }}
                            >
                              <IconUserCheck size={18} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
