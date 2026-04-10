'use client';

import { TextField, InputAdornment } from '@mui/material';
import { IconSearch } from '@tabler/icons-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <TextField
      placeholder="Search by name, email, or phone..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  );
}
