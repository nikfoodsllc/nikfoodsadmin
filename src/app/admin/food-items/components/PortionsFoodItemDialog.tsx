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
import PortionManager from './PortionManager';
import SubCategorySelect from './SubCategorySelect';
import { mergeCategoryIdsForSave, resolveSubCategoryIds, SubCategoryOption } from '../utils/subCategoryUtils';
import PriceField from './PriceField';

interface PortionsFoodItem {
  _id?: string;
  name: string;
  description?: string;
  category?: string[];
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'portions';
  portions: string[];
  portionPrices: number[];
  portionAvailability?: boolean[];
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  preparationType?: PreparationType | null; // how the kitchen prepares it; null/missing = not set yet
  splitSticker?: StickerFlag | null; // 'yes' = one sticker per box on the Stickers sheet; null/missing = not set yet
  heatingInstructions?: string | null; // printed on the sticker; missing = none
  unitQuantity?: number | null; // flat items: pieces one order makes ("2 Makki Roti" = 2); missing = 1
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

interface PortionsFoodItemDialogProps {
  open: boolean;
  item: PortionsFoodItem | null;
  subCategories: SubCategoryOption[];
  loading: boolean;
  onClose: () => void;
  onSave: (data: PortionsFoodItem, imageFile: File | null) => void;
}

const spiceLevels = ['Mild (Kid Friendly)', 'Normal', 'Medium Spice', 'Spicy'];

const getDefaultFormData = (): PortionsFoodItem => ({
  name: '',
  description: '',
  veg: true,
  available: true,
  url: '',
  public_id: '',
  itemType: 'portions',
  portions: [''],
  portionPrices: [0],
  portionAvailability: [true],
  isEcoFriendlyContainer: false,
  ecoContainerCharge: 0,
  hasSpiceLevel: false,
  spiceLevel: [],
  sticker: 'yes', // a new item is on the Stickers sheet unless someone turns it off
});

/** API rows may include unused top-level `price: null`; portions use `portionPrices` only — drop it so saves never send null. */
function itemToPortionsFormData(item: PortionsFoodItem): PortionsFoodItem {
  const { price: _omit, ...rest } = item as PortionsFoodItem & { price?: unknown };
  return rest as PortionsFoodItem;
}

export default function PortionsFoodItemDialog({
  open,
  item,
  subCategories,
  loading,
  onClose,
  onSave,
}: PortionsFoodItemDialogProps) {
  const subCategoryIds = new Set(subCategories.map((c) => c._id));

  const getInitialFormData = useCallback((): PortionsFoodItem => {
    return item ? itemToPortionsFormData(item) : getDefaultFormData();
  }, [item]);

  const [formData, setFormData] = useState<PortionsFoodItem>(getInitialFormData);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<string[]>([]);
  // the item's photos, main photo first; new ones upload when the item is saved
  const [photos, setPhotos] = useState<DraftPhoto[]>(() => photosFromItem(item));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens or item changes
  useEffect(() => {
    if (open) {
      const newFormData = item ? itemToPortionsFormData(item) : getDefaultFormData();
      setFormData(newFormData);
      setSelectedSubCategoryIds(resolveSubCategoryIds(item?.category, subCategoryIds));
      setPhotos(photosFromItem(item));
      setErrors({});
    }
  }, [open, item, subCategories]);

  const handleChange = (field: keyof PortionsFoodItem, value: string | number | boolean | string[]) => {
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

  const handlePortionsChange = (portions: Array<{ name: string; price: number; isAvailable?: boolean }>) => {
    const portionNames = portions.map((p) => p.name);
    const portionPrices = portions.map((p) => {
      const n = Number(p.price);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
    const portionAvailability = portions.map((p) => p.isAvailable ?? true);
    setFormData((prev) => ({
      ...prev,
      portions: portionNames,
      portionPrices,
      portionAvailability,
    }));
    // Clear portions error
    if (errors.portions) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.portions;
        return newErrors;
      });
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

    if (!formData.portions || formData.portions.length === 0) {
      newErrors.portions = 'At least one portion is required';
    } else if (formData.portions.some((p) => !p.trim())) {
      newErrors.portions = 'All portions must have a name';
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
      onSave({ ...submitData, photos } as PortionsFoodItem, null);
    }
  };

  // Convert portions array to required format for PortionManager
  const portionsForManager = formData.portions.map((name, index) => {
    const raw = formData.portionPrices[index];
    const n = Number(raw);
    const price = Number.isFinite(n) && n >= 0 ? n : 0;
    return {
      name,
      price,
      isAvailable: formData.portionAvailability?.[index] ?? true,
    };
  });

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx:{
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
          {item?._id ? 'Edit Portions Food Item' : 'Add Portions Food Item'}
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


          {/* Portion Manager */}
          <PortionManager
            portions={portionsForManager}
            onChange={handlePortionsChange}
            disabled={loading}
            error={errors.portions}
          />

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
          <StockField itemId={formData._id} hasSizes={true} value={formData} onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))} disabled={loading} />
          {subCategories.some((c) => c.flat && selectedSubCategoryIds.includes(c._id)) && (
            <UnitQuantityField value={formData.unitQuantity} onChange={(value) => setFormData((prev) => ({ ...prev, unitQuantity: value }))} disabled={loading} />
          )}
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
