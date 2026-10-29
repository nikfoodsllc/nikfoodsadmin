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
  RadioGroup,
  Radio,
} from '@mui/material';
import { StickerFlag } from '@/utils/stickerFlag';
import ChefsPickField from './ChefsPickField';
import InstructionsField from './InstructionsField';
import StockField from './StockField';
import { PreparationType } from '@/utils/preparationType';
import { IconX } from '@tabler/icons-react';
import ItemPhotos from './ItemPhotos';
import { DraftPhoto, photosFromItem } from '@/utils/itemImages';
import ComboSectionManager from './ComboSectionManager';
import PriceConfirmationDialog from './PriceConfirmationDialog';
import SubCategorySelect from './SubCategorySelect';
import { mergeCategoryIdsForSave, resolveSubCategoryIds, SubCategoryOption } from '../utils/subCategoryUtils';
import {
  findZeroPricedComboItems,
  updateComboItemPrices,
  ZeroPricedItemInfo,
} from '../utils/priceUtils';

interface AllFoodItem {
  _id: string;
  name: string;
  itemType: 'simple' | 'portions' | 'combo';
  portions?: string[];
  portionPrices?: number[];
  price?: number;
}

interface ComboFoodItem {
  _id?: string;
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  category?: string[];
  veg: boolean;
  available: boolean;
  url?: string;
  public_id?: string;
  itemType: 'combo';
  sections: Array<{
    title: string;
    selectedItems: Array<{
      item: string;
      portion?: string;
      price: number;
      portionId: string;
      isDefault?: boolean;
      isAvailable?: boolean; // Individual item availability within combo
    }>;
    sequence?: number;
    minSelection?: number;
    maxSelection?: number;
    isRequired?: boolean;
    takesSpice?: boolean;
    ownSpice?: boolean;
  }>;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  /** How spice is asked: 'inherit' = for each item that has spice levels, using its own levels; 'combo' = for each such item, using the levels picked here. Missing on older combos. */
  spiceMode?: 'inherit' | 'combo' | null;
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  preparationType?: PreparationType | null; // how the kitchen prepares it; null/missing = not set yet
  splitSticker?: StickerFlag | null; // 'yes' = one sticker per box on the Stickers sheet; null/missing = not set yet
  sticker?: StickerFlag | null; // 'yes' = on the Stickers sheet; null/missing = not set yet
  chefsPick?: boolean; // true = shown in the mobile app's Chef's Pick row
  allowInstructions?: boolean; // true = customers get a Special instructions box for this item
  stockThreshold?: number | null; // order limit (inventory); null / missing = no limit
  stockUnit?: 'units' | 'lb' | 'oz';
  stockResetMode?: 'manual' | 'daily';
  stockResetTime?: string | null;
  stockAlertPercent?: number | null;
}

interface ComboFoodItemDialogProps {
  open: boolean;
  item: ComboFoodItem | null;
  subCategories: SubCategoryOption[];
  allFoodItems: AllFoodItem[];
  loading: boolean;
  onClose: () => void;
  onSave: (data: ComboFoodItem, imageFile: File | null, priceUpdateInfo?: { priceUpdated: boolean; updatedCount: number }) => void;
}

function safeNonNegativePrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const getDefaultFormData = (): ComboFoodItem => ({
  name: '',
  description: '',
  short_description: 'A perfect balance of taste, aroma, and warmth.',
  price: 0,
  veg: true,
  available: true,
  url: '',
  public_id: '',
  itemType: 'combo',
  sections: [],
  hasSpiceLevel: false,
  spiceLevel: [],
  isEcoFriendlyContainer: false,
  ecoContainerCharge: 0,
  sticker: 'yes', // a new item is on the Stickers sheet unless someone turns it off
});

const spiceLevels = ['Mild (Kid Friendly)', 'Normal', 'Medium Spice', 'Spicy'];

export default function ComboFoodItemDialog({
  open,
  item,
  subCategories,
  allFoodItems,
  loading,
  onClose,
  onSave,
}: ComboFoodItemDialogProps) {
  const subCategoryIds = new Set(subCategories.map((c) => c._id));

  const getInitialFormData = useCallback((): ComboFoodItem => {
    return item ? { ...item, price: safeNonNegativePrice(item.price) } : getDefaultFormData();
  }, [item]);

  const [formData, setFormData] = useState<ComboFoodItem>(getInitialFormData);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<string[]>([]);
  // the item's photos, main photo first; new ones upload when the item is saved
  const [photos, setPhotos] = useState<DraftPhoto[]>(() => photosFromItem(item));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Price confirmation dialog state
  const [priceConfirmDialogOpen, setPriceConfirmDialogOpen] = useState(false);
  const [zeroPricedItems, setZeroPricedItems] = useState<ZeroPricedItemInfo[]>([]);
  const [pendingFormData, setPendingFormData] = useState<ComboFoodItem | null>(null);

  // Reset form when dialog opens or item changes
  useEffect(() => {
    if (open) {
      let newFormData = item ? { ...item, price: safeNonNegativePrice(item.price) } : getDefaultFormData();
      // Sort sections by sequence if present when loading existing item
      if (item && item.sections && item.sections.length > 0) {
        const sortedSections = [...item.sections].sort(
          (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)
        );
        newFormData = { ...newFormData, sections: sortedSections };
      }
      setFormData(newFormData);
      setSelectedSubCategoryIds(resolveSubCategoryIds(item?.category, subCategoryIds));
      setPhotos(photosFromItem(item));
      setErrors({});
      // Reset price confirmation state
      setPriceConfirmDialogOpen(false);
      setZeroPricedItems([]);
      setPendingFormData(null);
    }
  }, [open, item, subCategories]);

  const handleChange = (field: keyof ComboFoodItem, value: string | number | boolean | string[] | unknown) => {
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

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.hasSpiceLevel && (formData.spiceMode ?? 'inherit') === 'combo' && (formData.spiceLevel?.length ?? 0) === 0) {
      newErrors.spiceLevel = 'Pick at least one spice level';
    }

    if (formData.price == null || formData.price < 0) {
      newErrors.price = 'Price must be non-negative';
    }

    if (!formData.sections || formData.sections.length === 0) {
      newErrors.sections = 'At least one section is required for combo items';
    } else if (formData.sections.some((s) => !s.title.trim())) {
      newErrors.sections = 'All sections must have a title';
    } else if (formData.sections.some((s) => s.selectedItems.length === 0)) {
      newErrors.sections = 'All sections must have at least one item';
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
    if (validate()) {
      // Assign sequence numbers to sections based on their current array index
      const spiceMode = formData.hasSpiceLevel ? (formData.spiceMode ?? 'inherit') : null;
      const dataWithSequence = {
        ...formData,
        spiceMode,
        // the levels list only matters when the combo asks for its own levels
        spiceLevel: spiceMode === 'combo' ? formData.spiceLevel ?? [] : [],
        sections: formData.sections.map((section, index) => ({
          ...section,
          sequence: index,
        })),
        isDraft: false,
        category: mergeCategoryIdsForSave(selectedSubCategoryIds, item?.category, subCategoryIds),
      };


      // Check for zero-priced items in combo sections
      const zeroPriced = findZeroPricedComboItems(dataWithSequence.sections, allFoodItems);

      if (zeroPriced.length > 0) {
        // Store the pending data and show confirmation dialog
        setZeroPricedItems(zeroPriced);
        setPendingFormData(dataWithSequence);
        setPriceConfirmDialogOpen(true);
      } else {
        // No zero-priced items, proceed with normal save
        onSave({ ...dataWithSequence, photos } as ComboFoodItem, null);
      }
    }
  };

  // Handle user choosing to apply suggested prices
  const handlePriceConfirmApply = () => {
    if (!pendingFormData) return;

    // Update sections with suggested prices
    const updatedSections = updateComboItemPrices(pendingFormData.sections, zeroPricedItems);

    const updatedFormData = {
      ...pendingFormData,
      sections: updatedSections,
    };

    // Close dialog and save with updated prices
    setPriceConfirmDialogOpen(false);
    onSave({ ...updatedFormData, photos } as ComboFoodItem, null, { priceUpdated: true, updatedCount: zeroPricedItems.length });
  };

  // Handle user choosing to keep prices at zero
  const handlePriceConfirmCancel = () => {
    if (!pendingFormData) return;

    // Close dialog and save with original (zero) prices
    setPriceConfirmDialogOpen(false);
    onSave({ ...pendingFormData, photos } as ComboFoodItem, null, { priceUpdated: false, updatedCount: 0 });
  };

  // Handle closing the price confirmation dialog without action
  const handlePriceConfirmClose = () => {
    setPriceConfirmDialogOpen(false);
    setPendingFormData(null);
    setZeroPricedItems([]);
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          width: '900px',
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
          {item?._id ? 'Edit Combo Food Item' : 'Add Combo Food Item'}
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

          {/* Base Price */}
          <TextField
            label="Base Price *"
            type="number"
            value={formData.price}
            onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
            error={!!errors.price}
            helperText={errors.price || 'Base price for the combo meal'}
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

          {/* Combo Section Manager */}
          <ComboSectionManager
            sections={formData.sections}
            allFoodItems={allFoodItems}
            onChange={(sections) => handleChange('sections', sections)}
            disabled={loading}
            error={errors.sections}
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

          <ChefsPickField value={formData.chefsPick} onChange={(value) => setFormData((prev) => ({ ...prev, chefsPick: value }))} disabled={loading} />

          <InstructionsField value={formData.allowInstructions} onChange={(value) => setFormData((prev) => ({ ...prev, allowInstructions: value }))} disabled={loading} />

          <StockField itemId={formData._id} hasSizes={false} value={formData} onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))} disabled={loading} />
          <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
            Prep Type and Sticker are set on each item inside the combo, not here.
          </Typography>

          <Divider />

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
              label={<Typography variant="body2">Has Spice Level</Typography>}
            />
          </Box>

          {/* How spice is asked */}
          {formData.hasSpiceLevel && (
            <Box>
              <RadioGroup
                value={formData.spiceMode ?? 'inherit'}
                onChange={(e) => handleChange('spiceMode', e.target.value as 'inherit' | 'combo')}
              >
                <FormControlLabel
                  value="inherit"
                  control={<Radio size="small" disabled={loading} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Inherit Item Spice Data (default)</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', color: '#6B7280', ml: 4, mt: -0.5, mb: 1 }}>
                  The customer picks a spice level for each item in the combo that has spice levels, using that item&apos;s own levels. Items without spice (rice, bread) never ask.
                </Typography>
                <FormControlLabel
                  value="combo"
                  control={<Radio size="small" disabled={loading} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Collect Spice at Combo Level</Typography>}
                />
                <Typography variant="caption" sx={{ display: 'block', color: '#6B7280', ml: 4, mt: -0.5 }}>
                  Pick the levels below. The customer picks one of them for each item in the combo that has spice levels.
                </Typography>
              </RadioGroup>
              {item?._id && item.spiceMode == null && formData.hasSpiceLevel && (
                <Typography variant="caption" sx={{ display: 'block', color: '#B45309', mt: 1 }}>
                  This combo still uses the older one-level setup. Saving switches it to the option chosen here.
                </Typography>
              )}
            </Box>
          )}

          {/* Spice Levels Multi-Select (only when the combo asks for its own levels) */}
          {formData.hasSpiceLevel && (formData.spiceMode ?? 'inherit') === 'combo' && (
            <FormControl fullWidth error={Boolean(errors.spiceLevel)}>
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
              {errors.spiceLevel && (
                <Typography variant="caption" sx={{ color: '#d32f2f', mt: 0.5 }}>
                  {errors.spiceLevel}
                </Typography>
              )}
            </FormControl>
          )}

          <Divider />

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

      {/* Price Confirmation Dialog */}
      <PriceConfirmationDialog
        open={priceConfirmDialogOpen}
        onClose={handlePriceConfirmClose}
        onConfirm={handlePriceConfirmApply}
        onCancel={handlePriceConfirmCancel}
        items={zeroPricedItems.map((item) => ({
          itemName: item.itemName,
          sectionTitle: item.sectionTitle,
          currentPrice: item.currentPrice,
          suggestedPrice: item.suggestedPrice,
        }))}
        loading={loading}
      />
    </Dialog>
  );
}
