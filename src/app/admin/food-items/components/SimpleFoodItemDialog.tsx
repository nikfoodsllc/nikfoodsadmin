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
  Alert,
  Autocomplete,
} from '@mui/material';
import PreparationTypeField from './PreparationTypeField';
import StickerField from './StickerField';
import UnitQuantityField from './UnitQuantityField';
import HeatingInstructionsField from './HeatingInstructionsField';
import { StickerFlag } from '@/utils/stickerFlag';
import ChefsPickField from './ChefsPickField';
import AllergensField from './AllergensField';
import ToggleRow from './ToggleRow';
import InstructionsField from './InstructionsField';
import StockField from './StockField';
import { PreparationType, preparationTypeError } from '@/utils/preparationType';
import { IconX } from '@tabler/icons-react';
import ItemPhotos from './ItemPhotos';
import { DraftPhoto, photosFromItem } from '@/utils/itemImages';
import { FoodModifier } from '@/types/modifier';
import { useAuth } from '@/contexts/AuthContext';
import SubCategorySelect from './SubCategorySelect';
import { mergeCategoryIdsForSave, resolveSubCategoryIds, SubCategoryOption } from '../utils/subCategoryUtils';
import PriceField from './PriceField';

interface SimpleFoodItem {
  _id?: string;
  name: string;
  description?: string;
  price: number;
  category?: string[];
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'simple';
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  preparationType?: PreparationType | null; // how the kitchen prepares it; null/missing = not set yet
  splitSticker?: StickerFlag | null; // 'yes' = one sticker per box on the Stickers sheet; null/missing = not set yet
  heatingInstructions?: string | null; // printed on the sticker; missing = none
  unitQuantity?: number | null; // pieces one order makes ("2 Makki Roti" = 2); missing = 1
  sticker?: StickerFlag | null; // 'yes' = on the Stickers sheet; null/missing = not set yet
  chefsPick?: boolean; // true = shown in the mobile app's Chef's Pick row
  allergens?: string[]; // keys from utils/allergens.ts; none ticked = no allergens
  allowInstructions?: boolean; // true = customers get a Special instructions box for this item
  stockThreshold?: number | null; // order limit (inventory); null / missing = no limit
  stockUnit?: 'units' | 'lb' | 'oz';
  stockResetMode?: 'manual' | 'daily';
  stockResetTime?: string | null;
  stockAlertPercent?: number | null;
}

interface SimpleFoodItemDialogProps {
  open: boolean;
  item: SimpleFoodItem | null;
  subCategories: SubCategoryOption[];
  loading: boolean;
  onClose: () => void;
  onSave: (data: SimpleFoodItem, imageFile: File | null) => void;
}

const spiceLevels = ['Mild (Kid Friendly)', 'Normal', 'Medium Spice', 'Spicy'];

const getDefaultFormData = (): SimpleFoodItem => ({
  name: '',
  description: '',
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
  sticker: 'yes', // a new item is on the Stickers sheet unless someone turns it off
});

const defaultTemplateProperties = {
  veg: true,
  hasSpiceLevel: false,
  spiceLevel: [],
  isEcoFriendlyContainer: false,
  ecoContainerCharge: 0,
};

function safeNonNegativePrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function SimpleFoodItemDialog({
  open,
  item,
  subCategories,
  loading,
  onClose,
  onSave,
}: SimpleFoodItemDialogProps) {
  const { token } = useAuth();

  const subCategoryIds = new Set(subCategories.map((c) => c._id));

  const getInitialFormData = useCallback((): SimpleFoodItem => {
    return item ? { ...item, price: safeNonNegativePrice(item.price) } : getDefaultFormData();
  }, [item]);

  const [formData, setFormData] = useState<SimpleFoodItem>(getInitialFormData);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<string[]>([]);
  // the item's photos, main photo first; new ones upload when the item is saved
  const [photos, setPhotos] = useState<DraftPhoto[]>(() => photosFromItem(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modifiers, setModifiers] = useState<FoodModifier[]>([]);
  const [selectedModifier, setSelectedModifier] = useState<FoodModifier | null>(null);
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const [modifierError, setModifierError] = useState<string | null>(null);

  // Fetch modifiers when dialog opens
  useEffect(() => {
    if (open) {
      fetchModifiers();
    }
  }, [open]);

  // Fetch modifiers from API
  const fetchModifiers = async () => {
    setLoadingModifiers(true);
    setModifierError(null);
    try {
      const response = await fetch('/api/admin/modifiers?itemType=simple&limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch modifiers');
      }

      const result = await response.json();
      const modifiersWithTemplates = (result.data?.modifiers || []).filter(
        (m: FoodModifier) => m.templateProperties && Object.keys(m.templateProperties).length > 0
      );
      setModifiers(modifiersWithTemplates);
    } catch (error) {
      console.error('Error fetching modifiers:', error);
      setModifierError(error instanceof Error ? error.message : 'Failed to load modifiers');
    } finally {
      setLoadingModifiers(false);
    }
  };

  // Reset form when dialog opens or item changes
  useEffect(() => {
    if (open) {
      const newFormData = item ? { ...item, price: safeNonNegativePrice(item.price) } : getDefaultFormData();
      setFormData(newFormData);
      setSelectedSubCategoryIds(resolveSubCategoryIds(item?.category, subCategoryIds));
      setPhotos(photosFromItem(item));
      setErrors({});
      setSelectedModifier(null);
    }
  }, [open, item, subCategories]);

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

  const handlePhotos = (next: DraftPhoto[]) => {
    setPhotos(next);
    // Clear error when a photo is added
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

  // Handle modifier selection
  const handleModifierChange = (modifier: FoodModifier | null) => {
    setSelectedModifier(modifier);

    if (modifier && modifier.templateProperties) {
      // Apply template properties to form
      const props = modifier.templateProperties;
      const updates: Partial<SimpleFoodItem> = {};

      if (props.veg !== undefined) updates.veg = props.veg;
      if (props.hasSpiceLevel !== undefined) updates.hasSpiceLevel = props.hasSpiceLevel;
      if (props.spiceLevel !== undefined) updates.spiceLevel = props.spiceLevel;
      if (props.isEcoFriendlyContainer !== undefined) updates.isEcoFriendlyContainer = props.isEcoFriendlyContainer;
      if (props.ecoContainerCharge !== undefined) updates.ecoContainerCharge = props.ecoContainerCharge;

      setFormData((prev) => ({ ...prev, ...updates }));
    } else if (modifier === null) {
      // Reset to default values when "No modifier" is selected
      setFormData((prev) => ({
        ...prev,
        ...defaultTemplateProperties,
      }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // a NEW item must say how it is prepared (existing items may stay not set)
    const preparationError = preparationTypeError(!item?._id, formData.preparationType);
    if (preparationError) newErrors.preparationType = preparationError;

    if (formData.price == null || formData.price < 0) {
      newErrors.price = 'Price must be non-negative';
    }

    if (photos.length === 0) {
      newErrors.image = 'At least one photo is required';
    }

    if (selectedSubCategoryIds.length === 0) {
      newErrors.subCategory = 'At least one sub category is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      isDraft: false,
      category: mergeCategoryIdsForSave(selectedSubCategoryIds, item?.category, subCategoryIds),
    };
    if (validate()) {
      onSave({ ...submitData, photos } as SimpleFoodItem, null);
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
              Food Item Photos *
            </Typography>
            <ItemPhotos photos={photos} onChange={handlePhotos} disabled={loading} />
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

          <SubCategorySelect
            value={selectedSubCategoryIds}
            options={subCategories}
            onChange={(value) => {
              setSelectedSubCategoryIds(value);
              if (errors.subCategory) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.subCategory;
                  return next;
                });
              }
            }}
            error={errors.subCategory}
            disabled={loading}
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


          {/* Price */}
          <PriceField
            label="Price *"
            value={formData.price}
            onValueChange={(v) => handleChange('price', v)}
            error={!!errors.price}
            helperText={errors.price}
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

          <Divider />

          {/* Modifier Template Selection */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#374151' }}>
              Apply Modifier Template
            </Typography>
            <Autocomplete
              options={modifiers}
              getOptionLabel={(option) => option.name}
              value={selectedModifier}
              onChange={(_, newValue) => handleModifierChange(newValue)}
              loading={loadingModifiers}
              disabled={loading}
              fullWidth
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select a modifier template"
                  placeholder="Choose a template to apply preset values"
                  helperText={modifierError || "Templates quickly populate property values below"}
                  error={!!modifierError}
                  disabled={loading}
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
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingModifiers ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              clearIcon={<IconX size={16} />}
              noOptionsText="No modifier templates available"
              isOptionEqualToValue={(option, value) => option._id?.toString() === value._id?.toString()}
            />
            {selectedModifier && (
              <Alert
                severity="success"
                sx={{
                  mt: 2,
                  backgroundColor: '#F0FDF4',
                  color: '#166534',
                  '& .MuiAlert-icon': {
                    color: '#166534',
                  },
                }}
              >
                Template "{selectedModifier.name}" applied. You can modify the values below before saving.
              </Alert>
            )}
          </Box>

          <Divider />

          <ToggleRow label="Vegetarian" caption="Off means non-vegetarian." checked={formData.veg} onChange={(on) => handleChange('veg', on)} disabled={loading} />

          {/* Preparation Type: Cooked / Ready to eat (required for a new item; existing items may stay not set) */}
          <PreparationTypeField
            value={formData.preparationType}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, preparationType: value }));
              if (errors.preparationType) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.preparationType;
                  return next;
                });
              }
            }}
            disabled={loading}
            required={!item?._id}
            error={errors.preparationType}
          />

          {/* Sticker: Yes / No / not set yet (only Yes items appear on the Stickers sheet) */}
          <AllergensField value={formData.allergens} onChange={(value) => setFormData((prev) => ({ ...prev, allergens: value }))} disabled={loading} />
          <ChefsPickField value={formData.chefsPick} onChange={(value) => setFormData((prev) => ({ ...prev, chefsPick: value }))} disabled={loading} />
          <InstructionsField value={formData.allowInstructions} onChange={(value) => setFormData((prev) => ({ ...prev, allowInstructions: value }))} disabled={loading} />
          <StockField itemId={formData._id} hasSizes={false} value={formData} onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))} disabled={loading} />
          <UnitQuantityField value={formData.unitQuantity} onChange={(value) => setFormData((prev) => ({ ...prev, unitQuantity: value }))} disabled={loading} />
          <HeatingInstructionsField value={formData.heatingInstructions} onChange={(value) => setFormData((prev) => ({ ...prev, heatingInstructions: value }))} disabled={loading} />
          <StickerField allowNotSet={false} value={formData.sticker} onChange={(value) => setFormData((prev) => ({ ...prev, sticker: value, ...(value === 'no' ? { splitSticker: 'no' as const } : {}) }))} disabled={loading} />
          <StickerField label="Split Sticker" caption={formData.sticker === 'no' ? 'Needs a sticker first.' : 'One sticker for every box (off: one line per order).'} value={formData.sticker === 'no' ? 'no' : formData.splitSticker} onChange={(value) => setFormData((prev) => ({ ...prev, splitSticker: value }))} disabled={loading || formData.sticker === 'no'} />

          <Divider />

          <ToggleRow label="Available" caption="Off hides it from customers." checked={formData.available} onChange={(on) => handleChange('available', on)} disabled={loading} />


          <Divider />

          {/* Spice Level Toggle */}
          <ToggleRow label="Spice levels" caption="Customers pick a spice level." checked={Boolean(formData.hasSpiceLevel)} onChange={(on) => handleChange('hasSpiceLevel', on)} disabled={loading} />

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
          <ToggleRow label="Eco container" caption="Customers can add one for a fee." checked={Boolean(formData.isEcoFriendlyContainer)} onChange={(on) => handleChange('isEcoFriendlyContainer', on)} disabled={loading} />

          {/* Eco Container Charge */}
          {formData.isEcoFriendlyContainer && (
            <PriceField
              label="Eco Container Charge"
              value={formData.ecoContainerCharge}
              onValueChange={(v) => handleChange('ecoContainerCharge', v)}
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
          onClick={() => handleSubmit()}
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
