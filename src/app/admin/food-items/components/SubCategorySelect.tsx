'use client';

import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';
import { SubCategoryOption } from '../utils/subCategoryUtils';

interface SubCategorySelectProps {
  value: string;
  options: SubCategoryOption[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function SubCategorySelect({
  value,
  options,
  onChange,
  error,
  disabled = false,
  required = true,
}: SubCategorySelectProps) {
  return (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      <InputLabel id="sub-category-label">
        Sub Category{required ? ' *' : ''}
      </InputLabel>
      <Select
        labelId="sub-category-label"
        value={value}
        label={`Sub Category${required ? ' *' : ''}`}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4F8CFF',
          },
        }}
      >
        {!required && (
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
        )}
        {options.length === 0 ? (
          <MenuItem value="" disabled>
            No sub categories available
          </MenuItem>
        ) : (
          options.map((option) => (
            <MenuItem key={option._id} value={option._id}>
              {option.label}
            </MenuItem>
          ))
        )}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
