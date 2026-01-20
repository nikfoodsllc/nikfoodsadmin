'use client';

import { TableRow as MuiTableRow, TableCell, Typography, Chip } from '@mui/material';
import { UserWithAddresses } from '@/types/user';
import { formatPSTDate } from '@/utils/timezone';

interface UserTableRowProps {
  user: UserWithAddresses;
  index: number;
  onViewDetails: (user: UserWithAddresses) => void;
}

export default function UserTableRow({ user, index, onViewDetails }: UserTableRowProps) {
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
    </MuiTableRow>
  );
}
