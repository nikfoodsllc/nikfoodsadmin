'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  CircularProgress,
  TextField,
  FormControlLabel,
  Switch,
  Select,
  OutlinedInput,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  SelectChangeEvent,
  Divider,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import ImageUpload from '../../food-category/components/ImageUpload';

interface SimpleFoodItem {
  _id?: string;
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'simple';
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  isDraft?: boolean;
}

interface SimpleFoodItemDialogProps {
  open: boolean;
  item: SimpleFoodItem | null;
  loading: boolean;
  onClose: () => void;
  onSave: (data: SimpleFoodItem, imageFile: File | null) => void;
}

const spiceLevels = ['Mild', 'Normal', 'Medium', 'Semi-Spicy', 'Super-Spicy'];

const getDefaultFormData = (): SimpleFoodItem => ({
  name: '',
  description: '',
  short_description: 'A perfect balance of taste, aroma, and warmth.',
  price: 0,
  veg: true,
  available: true,
  url: '',
  public_id: '',
  itemType: 'simple',
  isEcoFriendlyContainer: false,
  ecoContainerCharge: 0,
  hasSpiceLevel: false,
  spiceLevel: [],
  isDraft: false,
});

export default function SimpleFoodItemDialog({
  open,
  item,
  loading,
  onClose,
  onSave,
}: SimpleFoodItemDialogProps) {
  const getInitialFormData = useCallback((): SimpleFoodItem => {
    return item ? { ...item } : getDefaultFormData();
  }, [item]);

  const [formData, setFormData] = useState<SimpleFoodItem>(getInitialFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens or item changes
  useEffect(() => {
    if (open) {
      const newFormData = item ? { ...item } : getDefaultFormData();
      // Defer state updates to avoid cascading renders warning
      queueMicrotask(() => {
        setFormData(newFormData);
        setImageFile(null);
        setErrors({});
      });
    }
  }, [open, item]);

  const handleChange = (field: keyof SimpleFoodItem, value: string | number | boolean | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImageChange = (file: File | null, previewUrl: string | null) => {
    setImageFile(file);
    if (previewUrl) {
      setFormData((prev) => ({
        ...prev,
        url: previewUrl,
      }));
    }
    // Clear error when image is selected
    if (errors.image) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.image;
        return newErrors;
      });
    }
  };

  const handleSpiceLevelChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    handleChange('spiceLevel', value);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.price === undefined || formData.price < 0) {
      newErrors.price = 'Price must be non-negative';
    }

    if (!formData.url && !imageFile) {
      newErrors.image = 'Image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (saveAsDraft: boolean = false) => {
    const submitData = { ...formData, isDraft: saveAsDraft };
    if (validate()) {
      onSave(submitData, imageFile);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          width: '700px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          borderRadius: 3,
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingX: 3,
          paddingY: 2,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <Box sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
          {item?._id ? 'Edit Simple Food Item' : 'Add Simple Food Item'}
        </Box>
        <IconButton
          onClick={onClose}
          disabled={loading}
          sx={{
            color: '#6B7280',
            '&:hover': {
              backgroundColor: '#F3F4F6',
            },
          }}
        >
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent
        sx={{
          paddingX: 3,
          paddingY: 3,
          overflowY: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Image Upload */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#374151' }}>
              Food Item Image *
            </Typography>
            <ImageUpload value={formData.url || null} onChange={handleImageChange} disabled={loading} />
            {errors.image && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {errors.image}
              </Typography>
            )}
          </Box>

          {/* Name */}
          <TextField
            label="Name *"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            disabled={loading}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#4F8CFF',
              },
            }}
          />

          {/* Description */}
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            disabled={loading}
            multiline
            rows={3}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#4F8CFF',
              },
            }}
          />

          {/* Short Description */}
          <TextField
            label="Short Description"
            value={formData.short_description}
            onChange={(e) => handleChange('short_description', e.target.value)}
            disabled={loading}
            multiline
            rows={2}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#4F8CFF',
              },
            }}
          />

          {/* Price */}
          <TextField
            label="Price *"
            type="number"
            value={formData.price}
            onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
            error={!!errors.price}
            helperText={errors.price}
            disabled={loading}
            fullWidth
            inputProps={{ min: 0, step: 0.01 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#4F8CFF',
              },
            }}
          />

          <Divider />

          {/* Veg/Non-Veg Toggle */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
              Food Type *
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.veg}
                  onChange={(e) => handleChange('veg', e.target.checked)}
                  disabled={loading}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#10B981',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#10B981',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">{formData.veg ? 'Vegetarian' : 'Non-Vegetarian'}</Typography>
                </Box>
              }
            />
          </Box>

          {/* Available Toggle */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
              Availability
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.available}
                  onChange={(e) => handleChange('available', e.target.checked)}
                  disabled={loading}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#4F8CFF',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#4F8CFF',
                    },
                  }}
                />
              }
              label={<Typography variant="body2">{formData.available ? 'Available' : 'Unavailable'}</Typography>}
            />
          </Box>

          {/* Draft Toggle */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#374151' }}>
              Status
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDraft || false}
                  onChange={(e) => handleChange('isDraft', e.target.checked)}
                  disabled={loading}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#FF9F0D',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#FF9F0D',
                    },
                  }}
                />
              }
              label={<Typography variant="body2">{formData.isDraft ? 'Draft Mode' : 'Published'}</Typography>}
            />
          </Box>

          <Divider />

          {/* Spice Level Toggle */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hasSpiceLevel}
                  onChange={(e) => handleChange('hasSpiceLevel', e.target.checked)}
                  disabled={loading}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#4F8CFF',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#4F8CFF',
                    },
                  }}
                />
              }
              label={<Typography variant="body2">Has Spice Level Options</Typography>}
            />
          </Box>

          {/* Spice Levels Multi-Select */}
          {formData.hasSpiceLevel && (
            <FormControl fullWidth>
              <InputLabel id="spice-level-label">Spice Levels</InputLabel>
              <Select
                labelId="spice-level-label"
                multiple
                value={formData.spiceLevel || []}
                onChange={handleSpiceLevelChange}
                input={<OutlinedInput label="Spice Levels" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((level) => (
                      <Chip
                        key={level}
                        label={level}
                        size="small"
                        sx={{
                          backgroundColor: '#FFF4E4',
                          color: '#FF9F0D',
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </Box>
                )}
                disabled={loading}
                sx={{
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4F8CFF',
                  },
                }}
              >
                {spiceLevels.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Eco-Friendly Container Toggle */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isEcoFriendlyContainer}
                  onChange={(e) => handleChange('isEcoFriendlyContainer', e.target.checked)}
                  disabled={loading}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#10B981',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#10B981',
                    },
                  }}
                />
              }
              label={<Typography variant="body2">Eco-Friendly Container Available</Typography>}
            />
          </Box>

          {/* Eco Container Charge */}
          {formData.isEcoFriendlyContainer && (
            <TextField
              label="Eco Container Charge"
              type="number"
              value={formData.ecoContainerCharge}
              onChange={(e) => handleChange('ecoContainerCharge', parseFloat(e.target.value) || 0)}
              disabled={loading}
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: '#4F8CFF',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#4F8CFF',
                },
              }}
            />
          )}
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          paddingX: 3,
          paddingY: 2,
          borderTop: '1px solid #E5E7EB',
          gap: 1,
        }}
      >
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            textTransform: 'none',
            color: '#6B7280',
            '&:hover': {
              backgroundColor: '#F3F4F6',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={loading}
          variant="outlined"
          sx={{
            textTransform: 'none',
            borderColor: '#FF9F0D',
            color: '#FF9F0D',
            paddingX: 3,
            '&:hover': {
              backgroundColor: '#FFF4E4',
              borderColor: '#FF9F0D',
            },
            '&.Mui-disabled': {
              borderColor: '#D1D5DB',
              color: '#9CA3AF',
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={16} sx={{ color: '#FF9F0D', marginRight: 1 }} />
              Saving Draft...
            </>
          ) : (
            'Save as Draft'
          )}
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          variant="contained"
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            paddingX: 3,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
            '&.Mui-disabled': {
              backgroundColor: '#D1D5DB',
              color: '#9CA3AF',
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={16} sx={{ color: '#fff', marginRight: 1 }} />
              Publishing...
            </>
          ) : (
            'Save'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
