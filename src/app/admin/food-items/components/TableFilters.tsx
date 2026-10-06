'use client';

import { Box, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment } from '@mui/material';
import { PreparationFilter } from '@/utils/preparationType';
import { IconSearch } from '@tabler/icons-react';

interface TableFiltersProps {
  searchValue: string;
  vegOnly: string;
  onSearchChange: (value: string) => void;
  onVegChange: (value: string) => void;
  preparation: PreparationFilter;
  onPreparationChange: (value: PreparationFilter) => void;
}

export default function TableFilters({
  searchValue,
  vegOnly,
  onSearchChange,
  onVegChange,
  preparation,
  onPreparationChange,
}: TableFiltersProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        marginBottom: 3,
        flexWrap: 'wrap',
      }}
    >
      {/* Search */}
      <TextField
        placeholder="Search by name..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        size="small"
        sx={{
          flex: 1,
          minWidth: 250,
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

      {/* Veg Filter */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Diet Type</InputLabel>
        <Select
          value={vegOnly}
          label="Diet Type"
          onChange={(e) => onVegChange(e.target.value)}
          sx={{ backgroundColor: '#fff' }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Vegetarian</MenuItem>
          <MenuItem value="false">Non-Vegetarian</MenuItem>
        </Select>
      </FormControl>

      {/* Preparation Filter */}
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel>Preparation</InputLabel>
        <Select
          value={preparation}
          label="Preparation"
          onChange={(e) => onPreparationChange(e.target.value as PreparationFilter)}
          sx={{ backgroundColor: '#fff' }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="cooked">Cooked</MenuItem>
          <MenuItem value="ready_to_eat">Ready to eat</MenuItem>
          <MenuItem value="not_set">(not set yet)</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
