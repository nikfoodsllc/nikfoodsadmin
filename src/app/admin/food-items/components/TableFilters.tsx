'use client';

import { Box, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment } from '@mui/material';
import { IconSearch } from '@tabler/icons-react';
import { FoodItemFilters } from './foodItemFilters';

interface TableFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: FoodItemFilters;
  onFilterChange: <K extends keyof FoodItemFilters>(key: K, value: FoodItemFilters[K]) => void;
}

/** One dropdown per table column that can be filtered; the labels are the column names. */
export default function TableFilters({ searchValue, onSearchChange, filters, onFilterChange }: TableFiltersProps) {
  const selectSx = { backgroundColor: '#fff' };
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

      {/* Available */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Available</InputLabel>
        <Select
          value={filters.available}
          label="Available"
          onChange={(e) => onFilterChange('available', e.target.value as FoodItemFilters['available'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Available</MenuItem>
          <MenuItem value="false">Unavailable</MenuItem>
        </Select>
      </FormControl>

      {/* Veg/Non-Veg */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Veg/Non-Veg</InputLabel>
        <Select
          value={filters.veg}
          label="Veg/Non-Veg"
          onChange={(e) => onFilterChange('veg', e.target.value as FoodItemFilters['veg'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Veg</MenuItem>
          <MenuItem value="false">Non-Veg</MenuItem>
        </Select>
      </FormControl>

      {/* Type */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={filters.itemType}
          label="Type"
          onChange={(e) => onFilterChange('itemType', e.target.value as FoodItemFilters['itemType'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="simple">Simple</MenuItem>
          <MenuItem value="portions">Portions</MenuItem>
          <MenuItem value="combo">Combo</MenuItem>
        </Select>
      </FormControl>

      {/* Preparation Type */}
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Preparation Type</InputLabel>
        <Select
          value={filters.preparation}
          label="Preparation Type"
          onChange={(e) => onFilterChange('preparation', e.target.value as FoodItemFilters['preparation'])}
          sx={selectSx}
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
