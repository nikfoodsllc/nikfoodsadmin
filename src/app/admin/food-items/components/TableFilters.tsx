'use client';

import { Box, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment } from '@mui/material';
import { IconSearch } from '@tabler/icons-react';

interface Category {
  _id: string;
  name: string;
}

interface TableFiltersProps {
  searchValue: string;
  selectedCategory: string;
  vegOnly: string;
  categories: Category[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onVegChange: (value: string) => void;
}

export default function TableFilters({
  searchValue,
  selectedCategory,
  vegOnly,
  categories,
  onSearchChange,
  onCategoryChange,
  onVegChange,
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

      {/* Category Filter */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Category</InputLabel>
        <Select
          value={selectedCategory}
          label="Category"
          onChange={(e) => onCategoryChange(e.target.value)}
          sx={{ backgroundColor: '#fff' }}
        >
          <MenuItem value="all">All Categories</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category._id?.toString()} value={category._id?.toString()}>
              {category.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
    </Box>
  );
}
