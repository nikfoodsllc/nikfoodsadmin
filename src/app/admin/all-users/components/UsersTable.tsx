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
} from '@mui/material';
import UserTableRow from './UserTableRow';
import UserSkeleton from './UserSkeleton';
import { UserWithAddresses } from '@/types/user';

interface UsersTableProps {
  users: UserWithAddresses[];
  loading: boolean;
  onViewDetails: (user: UserWithAddresses) => void;
}

export default function UsersTable({ users, loading, onViewDetails }: UsersTableProps) {
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
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
                Registered On
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <UserSkeleton />
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'center', padding: '48px 16px' }}>
                  <Typography variant="body2" color="text.secondary">
                    No users found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => (
                <UserTableRow
                  key={user._id?.toString() || index}
                  user={user}
                  index={index}
                  onViewDetails={onViewDetails}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
