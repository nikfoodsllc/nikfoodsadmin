'use client';

import { useEffect, useState } from 'react';
import { Box, TextField, Select, MenuItem, FormControl, InputLabel, InputAdornment } from '@mui/material';
import { IconSearch } from '@tabler/icons-react';
import { FoodItemFilters } from './foodItemFilters';
import { ALLERGENS } from '@/utils/allergens';
import { useAuth } from '@/contexts/AuthContext';
import { mergeHeatingInstructions } from '@/utils/heatingInstructions';

interface TableFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: FoodItemFilters;
  onFilterChange: <K extends keyof FoodItemFilters>(key: K, value: FoodItemFilters[K]) => void;
  /** Top-level categories and sub-categories (with their parent), for the Category and Sub Category filters */
  categoryOptions?: { top: Array<{ _id: string; name: string }>; subs: Array<{ _id: string; name: string; parentId: string; parentName: string }> };
}

/** One dropdown per table column that can be filtered; the labels are the column names. */
export default function TableFilters({ searchValue, onSearchChange, filters, onFilterChange, categoryOptions }: TableFiltersProps) {
  const subsShown = (categoryOptions?.subs ?? []).filter((s) => filters.category === 'all' || s.parentId === filters.category);
  const selectSx = { backgroundColor: '#fff' };
  // the heating / storage instructions to filter by (the shared list)
  const { token } = useAuth();
  const [heatingList, setHeatingList] = useState<string[]>(mergeHeatingInstructions([]));
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/admin/heating-instructions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.data)) setHeatingList(mergeHeatingInstructions(json.data as string[]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);
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

      {/* Category, then Sub Category (only the sub-categories of the picked category) */}
      {categoryOptions && categoryOptions.top.length > 0 && (
        <>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filters.category}
              label="Category"
              onChange={(e) => {
                onFilterChange('category', e.target.value as string);
                onFilterChange('subCategory', 'all');
              }}
              sx={selectSx}
            >
              <MenuItem value="all">All</MenuItem>
              {categoryOptions.top.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Sub Category</InputLabel>
            <Select value={filters.subCategory} label="Sub Category" onChange={(e) => onFilterChange('subCategory', e.target.value as string)} sx={selectSx}>
              <MenuItem value="all">All</MenuItem>
              {subsShown.map((s) => (
                <MenuItem key={s._id} value={s._id}>
                  {filters.category === 'all' ? `${s.parentName} › ${s.name}` : s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

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

      {/* Allergens: items containing one allergen, or items with none */}
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Allergens</InputLabel>
        <Select
          value={filters.allergen}
          label="Allergens"
          onChange={(e) => onFilterChange('allergen', e.target.value as FoodItemFilters['allergen'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="none">No allergens</MenuItem>
          {ALLERGENS.map((a) => (
            <MenuItem key={a.key} value={a.key}>
              Contains {a.label.toLowerCase()}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Chef's Pick */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Chef&apos;s Pick</InputLabel>
        <Select
          value={filters.chefsPick}
          label="Chef's Pick"
          onChange={(e) => onFilterChange('chefsPick', e.target.value as FoodItemFilters['chefsPick'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="yes">Yes</MenuItem>
          <MenuItem value="no">No</MenuItem>
        </Select>
      </FormControl>

      {/* Stock (order limit) */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Stock</InputLabel>
        <Select
          value={filters.stock}
          label="Stock"
          onChange={(e) => onFilterChange('stock', e.target.value as FoodItemFilters['stock'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="none">No limit</MenuItem>
          <MenuItem value="has">Has a limit</MenuItem>
          <MenuItem value="ok">In stock</MenuItem>
          <MenuItem value="low">Low stock</MenuItem>
          <MenuItem value="out">Sold out</MenuItem>
        </Select>
      </FormControl>

      {/* Special Instructions */}
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel>Special Instructions</InputLabel>
        <Select
          value={filters.allowInstructions}
          label="Special Instructions"
          onChange={(e) => onFilterChange('allowInstructions', e.target.value as FoodItemFilters['allowInstructions'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="yes">Yes</MenuItem>
          <MenuItem value="no">No</MenuItem>
        </Select>
      </FormControl>

      {/* Sticker */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Sticker</InputLabel>
        <Select
          value={filters.sticker}
          label="Sticker"
          onChange={(e) => onFilterChange('sticker', e.target.value as FoodItemFilters['sticker'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="yes">Yes</MenuItem>
          <MenuItem value="no">No</MenuItem>
        </Select>
      </FormControl>

      {/* Heating/Storage */}
      <FormControl size="small" sx={{ minWidth: 190, maxWidth: 260 }}>
        <InputLabel>Heating/Storage</InputLabel>
        <Select
          value={filters.heating}
          label="Heating/Storage"
          onChange={(e) => onFilterChange('heating', e.target.value as FoodItemFilters['heating'])}
          sx={selectSx}
          MenuProps={{ PaperProps: { sx: { maxWidth: 360 } } }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="none">(none set)</MenuItem>
          <MenuItem value="has">Has one</MenuItem>
          {/* an instruction that is picked but not (yet) in the list still shows */}
          {(filters.heating.startsWith('is:') && !heatingList.includes(filters.heating.slice(3)) ? [filters.heating.slice(3), ...heatingList] : heatingList).map((text) => (
            <MenuItem key={text} value={`is:${text}`} sx={{ whiteSpace: 'normal' }}>
              {text}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Split Sticker */}
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Split Sticker</InputLabel>
        <Select
          value={filters.splitSticker}
          label="Split Sticker"
          onChange={(e) => onFilterChange('splitSticker', e.target.value as FoodItemFilters['splitSticker'])}
          sx={selectSx}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="yes">Yes</MenuItem>
          <MenuItem value="no">No</MenuItem>
          <MenuItem value="not_set">(not set yet)</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
