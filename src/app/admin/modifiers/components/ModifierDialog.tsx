'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Typography,
  Divider,
  OutlinedInput,
  Chip,
} from '@mui/material';
import { FoodModifier } from '@/types/modifier';

interface ModifierDialogProps {
  open: boolean;
  modifier: FoodModifier | null;
  onClose: () => void;
  onSave: (data: Partial<Omit<FoodModifier, '_id'>> & { _id?: string }) => Promise<void>;
}

export default function ModifierDialog({ open, modifier, onClose, onSave }: ModifierDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    templateProperties: {
      veg: undefined as boolean | undefined,
      hasSpiceLevel: undefined as boolean | undefined,
      spiceLevel: [] as string[],
      isEcoFriendlyContainer: undefined as boolean | undefined,
      ecoContainerCharge: undefined as number | undefined,
    },
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (open) {
      if (modifier) {
        setFormData({
          name: modifier.name || '',
          templateProperties: {
            veg: modifier.templateProperties?.veg ?? undefined,
            hasSpiceLevel: modifier.templateProperties?.hasSpiceLevel ?? undefined,
            spiceLevel: modifier.templateProperties?.spiceLevel ?? [],
            isEcoFriendlyContainer: modifier.templateProperties?.isEcoFriendlyContainer ?? undefined,
            ecoContainerCharge: modifier.templateProperties?.ecoContainerCharge ?? undefined,
          },
        });
      } else {
        setFormData({
          name: '',
          templateProperties: {
            veg: undefined,
            hasSpiceLevel: undefined,
            spiceLevel: [],
            isEcoFriendlyContainer: undefined,
            ecoContainerCharge: undefined,
          },
        });
      }
      setErrors({});
      setApiError('');
    }
  }, [open, modifier]);

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement | { value: unknown }>) => {
    const target = event.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    setApiError('');
  };

  const handleTemplatePropertyChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      templateProperties: {
        ...prev.templateProperties,
        [field]: value,
      },
    }));
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Modifier name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Modifier name must not exceed 100 characters';
    }

    // Validate that at least one template property is configured
    const hasTemplateProperty =
      formData.templateProperties.veg !== undefined ||
      formData.templateProperties.hasSpiceLevel !== undefined ||
      formData.templateProperties.isEcoFriendlyContainer !== undefined;

    if (!hasTemplateProperty) {
      newErrors.templateProperties = 'At least one template property must be configured';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setApiError('');

    try {
      const dataToSave = {
        ...formData,
        _id: modifier?._id?.toString(),
      };
      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving modifier:', error);
      setApiError(error instanceof Error ? error.message : 'Failed to save modifier');
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!modifier;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ fontSize: '18px', fontWeight: 600, paddingBottom: 2 }}>
        {isEdit ? 'Edit Simple Food Item Modifier' : 'Add Simple Food Item Modifier'}
      </DialogTitle>

      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ marginBottom: 3 }}>
            {apiError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 1 }}>
          {/* Name */}
          <TextField
            label="Modifier Name"
            value={formData.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            disabled={loading}
            placeholder="e.g., Extra Cheese, Spicy Sauce"
          />

          <Divider />

          {/* Template Properties Section */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#374151' }}>
              Template Properties
            </Typography>
            {errors.templateProperties && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.templateProperties}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Veg */}
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.templateProperties.veg ?? false}
                    onChange={(e) => handleTemplatePropertyChange('veg', e.target.checked)}
                    disabled={loading}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Vegetarian</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Sets the food item as vegetarian when applied
                    </Typography>
                  </Box>
                }
                sx={{ marginLeft: 0 }}
              />

              {/* Has Spice Level */}
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.templateProperties.hasSpiceLevel ?? false}
                    onChange={(e) => handleTemplatePropertyChange('hasSpiceLevel', e.target.checked)}
                    disabled={loading}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Has Spice Level Options</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Enables spice level selection for the food item
                    </Typography>
                  </Box>
                }
                sx={{ marginLeft: 0 }}
              />

              {/* Spice Levels */}
              {formData.templateProperties.hasSpiceLevel && (
                <FormControl fullWidth disabled={loading}>
                  <InputLabel>Spice Levels</InputLabel>
                  <Select
                    multiple
                    value={formData.templateProperties.spiceLevel || []}
                    onChange={(e) => handleTemplatePropertyChange('spiceLevel', e.target.value as string[])}
                    input={<OutlinedInput label="Spice Levels" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="Mild (Kid Friendly)">Mild (Kid Friendly)</MenuItem>
                    <MenuItem value="Normal">Normal</MenuItem>
                    <MenuItem value="Medium Spice">Medium Spice</MenuItem>
                    <MenuItem value="Spicy">Spicy</MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Eco-Friendly Container */}
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.templateProperties.isEcoFriendlyContainer ?? false}
                    onChange={(e) => handleTemplatePropertyChange('isEcoFriendlyContainer', e.target.checked)}
                    disabled={loading}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Eco-Friendly Container Available</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Enables eco-friendly container option for the food item
                    </Typography>
                  </Box>
                }
                sx={{ marginLeft: 0 }}
              />

              {/* Eco Container Charge */}
              {formData.templateProperties.isEcoFriendlyContainer && (
                <TextField
                  label="Eco Container Charge"
                  type="number"
                  value={formData.templateProperties.ecoContainerCharge ?? 0}
                  onChange={(e) => handleTemplatePropertyChange('ecoContainerCharge', parseFloat(e.target.value) || 0)}
                  disabled={loading}
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{
                    startAdornment: <Box sx={{ mr: 1, color: '#666' }}>$</Box>,
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ paddingX: 3, paddingBottom: 3 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            textTransform: 'none',
            color: '#666',
            '&:hover': {
              backgroundColor: 'transparent',
              color: '#333',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
            '&:disabled': {
              backgroundColor: '#ccc',
              color: '#666',
            },
          }}
        >
          {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
