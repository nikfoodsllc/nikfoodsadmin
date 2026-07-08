'use client';

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  OutlinedInput,
  Box,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import { SubCategoryOption } from '../utils/subCategoryUtils';

interface SubCategorySelectProps {
  value: string[];
  options: SubCategoryOption[];
  onChange: (value: string[]) => void;
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
  const label = `Sub Category${required ? ' *' : ''}`;
  const optionLabelById = new Map(options.map((option) => [option._id, option.label]));

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const selected = event.target.value;
    onChange(typeof selected === 'string' ? selected.split(',') : selected);
  };

  return (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      <InputLabel id="sub-category-label">{label}</InputLabel>
      <Select
        labelId="sub-category-label"
        multiple
        value={value}
        label={label}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((id) => (
              <Chip
                key={id}
                label={optionLabelById.get(id) ?? id}
                size="small"
                sx={{
                  backgroundColor: '#E8F1FF',
                  color: '#4F8CFF',
                  fontWeight: 500,
                }}
              />
            ))}
          </Box>
        )}
        sx={{
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4F8CFF',
          },
        }}
      >
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
