'use client';

import { TableRow as MuiTableRow, TableCell, Typography, Chip, Box, IconButton, Tooltip } from '@mui/material';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { UserWithAddresses } from '@/types/user';
import { formatPSTDate } from '@/utils/timezone';

interface UserTableRowProps {
  user: UserWithAddresses;
  index: number;
  onViewDetails: (user: UserWithAddresses) => void;
  onEditUser: (user: UserWithAddresses) => void;
  onDeleteUser: (user: UserWithAddresses) => void;
}

export default function UserTableRow({
  user,
  index,
  onViewDetails,
  onEditUser,
  onDeleteUser,
}: UserTableRowProps) {
  return (
    <MuiTableRow
      sx={{
        backgroundColor: index % 2 === 0 ? '#F6FAFF' : '#fff',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: '#F0F6FF',
        },
      }}
      onClick={() => onViewDetails(user)}
    >
      {/* Name */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {user.name || 'N/A'}
        </Typography>
        {user.role === 'ADMIN' && (
          <Chip
            label="Admin"
            size="small"
            sx={{
              marginTop: 0.5,
              height: 20,
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: '#FEF3C7',
              color: '#F59E0B',
            }}
          />
        )}
      </TableCell>

      {/* Email */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {user.email}
        </Typography>
      </TableCell>

      {/* Phone */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {user.phone || 'N/A'}
        </Typography>
      </TableCell>

      {/* Registered On */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Typography
          sx={{
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          {formatPSTDate(user.createdAt)}
        </Typography>
      </TableCell>

      {/* Action */}
      <TableCell sx={{ padding: '16px 12px', verticalAlign: 'middle' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Update user">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEditUser(user);
              }}
              sx={{
                color: '#4F8CFF',
                '&:hover': {
                  backgroundColor: '#E6F0FF',
                },
              }}
            >
              <IconEdit size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete user">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteUser(user);
              }}
              sx={{
                color: '#EF4444',
                '&:hover': {
                  backgroundColor: '#FEE2E2',
                },
              }}
            >
              <IconTrash size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </MuiTableRow>
  );
}
