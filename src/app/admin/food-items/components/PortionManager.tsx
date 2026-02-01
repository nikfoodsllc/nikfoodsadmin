'use client';

import { Box, TextField, Button, IconButton, Typography, Paper, Switch, FormControlLabel, Chip } from '@mui/material';
import { IconPlus, IconTrash } from '@tabler/icons-react';

interface Portion {
  name: string;
  price: number;
  isAvailable?: boolean;
}

interface PortionManagerProps {
  portions: Portion[];
  onChange: (portions: Portion[]) => void;
  disabled?: boolean;
  error?: string;
}

export default function PortionManager({
  portions,
  onChange,
  disabled,
  error,
}: PortionManagerProps) {
  const handleAddPortion = () => {
    onChange([...portions, { name: '', price: 0, isAvailable: true }]);
  };

  const handleAvailabilityToggle = (index: number) => {
    const newPortions = [...portions];
    const currentValue = newPortions[index].isAvailable ?? true;
    newPortions[index] = {
      ...newPortions[index],
      isAvailable: !currentValue,
    };
    onChange(newPortions);
  };

  const handleRemovePortion = (index: number) => {
    const newPortions = portions.filter((_, i) => i !== index);
    onChange(newPortions);
  };

  const handlePortionChange = (index: number, field: 'name' | 'price', value: string | number) => {
    const newPortions = [...portions];
    newPortions[index] = {
      ...newPortions[index],
      [field]: value,
    };
    onChange(newPortions);
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600, color: '#374151' }}>
        Portion Options *
      </Typography>
      <Typography variant="caption" sx={{ mb: 1.5, display: 'block', color: '#6B7280' }}>
        Portions marked as &apos;Out of Stock&apos; will not be selectable by customers when ordering this item.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {portions.map((portion, index) => {
          const isAvailable = portion.isAvailable ?? true;
          return (
            <Paper
              key={index}
              elevation={0}
              sx={{
                padding: 2,
                border: isAvailable ? '1px solid #E5E7EB' : '1px solid #FCA5A5',
                borderRadius: 2,
                backgroundColor: isAvailable ? '#F9FAFB' : '#FEF2F2',
                opacity: isAvailable ? 1 : 0.7,
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Portion Name"
                  value={portion.name}
                  onChange={(e) => handlePortionChange(index, 'name', e.target.value)}
                  disabled={disabled}
                  placeholder="e.g., Small, Regular, Large"
                  fullWidth
                  sx={{
                    flex: 2,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#fff',
                      '&.Mui-focused fieldset': {
                        borderColor: '#4F8CFF',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#4F8CFF',
                    },
                  }}
                />

                <TextField
                  label="Price ($)"
                  type="number"
                  value={portion.price}
                  onChange={(e) => handlePortionChange(index, 'price', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  inputProps={{ min: 0, step: 0.01 }}
                  fullWidth
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#fff',
                      '&.Mui-focused fieldset': {
                        borderColor: '#4F8CFF',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#4F8CFF',
                    },
                  }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isAvailable}
                        onChange={() => handleAvailabilityToggle(index)}
                        disabled={disabled}
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#10B981',
                            '&:hover': {
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            },
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#10B981',
                          },
                          '& .MuiSwitch-switchBase:not(.Mui-checked)': {
                            color: '#EF4444',
                          },
                          '& .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': {
                            backgroundColor: '#EF4444',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ color: isAvailable ? '#10B981' : '#EF4444', fontWeight: 500 }}>
                        {isAvailable ? 'In Stock' : 'Out of Stock'}
                      </Typography>
                    }
                    sx={{ margin: 0, minWidth: 110 }}
                  />
                  {!isAvailable && (
                    <Chip
                      label="Unavailable"
                      size="small"
                      sx={{
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        fontSize: '0.7rem',
                        height: 20,
                      }}
                    />
                  )}
                </Box>

                <IconButton
                  onClick={() => handleRemovePortion(index)}
                  disabled={disabled || portions.length === 1}
                  sx={{
                    color: '#EF4444',
                    '&:hover': {
                      backgroundColor: '#FEE2E2',
                    },
                    '&.Mui-disabled': {
                      color: '#D1D5DB',
                    },
                  }}
                >
                  <IconTrash size={20} />
                </IconButton>
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Button
        startIcon={<IconPlus size={18} />}
        onClick={handleAddPortion}
        disabled={disabled}
        sx={{
          mt: 2,
          textTransform: 'none',
          color: '#4F8CFF',
          borderColor: '#4F8CFF',
          '&:hover': {
            borderColor: '#3B7AE8',
            backgroundColor: 'rgba(79, 140, 255, 0.04)',
          },
        }}
        variant="outlined"
      >
        Add Portion Option
      </Button>

      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
