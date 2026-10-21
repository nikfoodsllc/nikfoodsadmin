'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Box,
  RadioGroup,
  Radio,
  FormLabel,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import ImageUpload from './ImageUpload';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { FoodCategory, CategoryListingType } from '@/types/order';

function parentIdFromCategory(category: FoodCategory | null): string {
  if (!category?.parentCategoryId) return '';
  const p = category.parentCategoryId;
  if (typeof p === 'string') return p;
  return p.toString();
}

interface CategoryDialogProps {
  open: boolean;
  category: FoodCategory | null;
  /** Top-level categories only; used as eligible parents for a one-level hierarchy. */
  parentCategoryOptions: FoodCategory[];
  onClose: () => void;
  onSave: (data: Partial<Omit<FoodCategory, '_id'>> & { _id?: string; isImageUpdated?: boolean }) => Promise<void>;
}

export default function CategoryDialog({ open, category, parentCategoryOptions, onClose, onSave }: CategoryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [sequence, setSequence] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [listingType, setListingType] = useState<CategoryListingType>('flat');
  // a new category starts hidden from customers until the admin switches it on
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setDescription(category.description || '');
        setParentCategoryId(parentIdFromCategory(category));
        setSequence(category.sequence || 0);
        setImagePreview(category.url || null);
        setListingType(category.listingType || 'flat');
        setAvailable(!category.isDraft);
      } else {
        setName('');
        setDescription('');
        setParentCategoryId('');
        setSequence(0);
        setImagePreview(null);
        setListingType('flat');
        setAvailable(false);
      }
      setImageFile(null);
      setError('');
    }
  }, [open, category]);

  const handleImageChange = (file: File | null, preview: string | null) => {
    setImageFile(file);
    setImagePreview(preview);
  };

  const validate = (): string | null => {
    if (!name.trim()) {
      return 'Category name is required';
    }
    if (name.trim().length < 2) {
      return 'Category name must be at least 2 characters';
    }
    if (name.trim().length > 50) {
      return 'Category name must be less than 50 characters';
    }
    if (sequence < 0) {
      return 'Sequence must be a positive number';
    }
    return null;
  };

  const handleSubmit = async () => {
    setError('');

    // Validate
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      let imageUrl = category?.url || '';
      let publicId = category?.public_id || '';
      let isImageUpdated = false;

      // Upload new image if selected
      if (imageFile) {
        const uploadResult = await uploadToCloudinary(imageFile);
        imageUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
        isImageUpdated = true;
      }

      // Prepare data
      const data: Partial<Omit<FoodCategory, '_id'>> & { _id?: string; isImageUpdated?: boolean } = {
        name: name.trim(),
        description: description.trim(),
        sequence: sequence,
        url: imageUrl,
        public_id: publicId,
        isDraft: !available,
        listingType: effectiveListingType,
        dayWiseItems: [],
        parentCategoryId: parentCategoryId.trim() || '',
      };

      if (category) {
        data._id = category._id?.toString();
        data.isImageUpdated = isImageUpdated;
      }

      await onSave(data);
      onClose();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  // a sub-category follows its parent; an existing category keeps the type it was created with
  const parentCategory = parentCategoryOptions.find((c) => c._id?.toString() === parentCategoryId);
  const effectiveListingType: CategoryListingType = category
    ? category.listingType || 'flat'
    : parentCategory
      ? parentCategory.listingType || 'flat'
      : listingType;
  const typeWord = effectiveListingType === 'day-wise' ? 'Day-wise' : 'Flat';

  const handleCancel = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
        {category ? 'Edit Category' : 'Add New Category'}
      </DialogTitle>
      <DialogContent sx={{ overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <TextField
            label="Category Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            fullWidth
            required
            autoFocus
            placeholder="e.g., Appetizers, Main Course, Desserts"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#F6FAFF',
                '&:hover fieldset': {
                  borderColor: '#4F8CFF',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
            }}
          />

          <FormControl fullWidth disabled={loading}>
            <InputLabel id="parent-category-label">Parent category</InputLabel>
            <Select
              labelId="parent-category-label"
              id="parent-category"
              label="Parent category"
              value={parentCategoryId}
              onChange={(e) => setParentCategoryId(typeof e.target.value === 'string' ? e.target.value : '')}
              sx={{
                backgroundColor: '#F6FAFF',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#4F8CFF',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#4F8CFF',
                },
              }}
            >
              <MenuItem value="">
                <em>None (top-level category)</em>
              </MenuItem>
              {parentCategoryOptions
                .filter((c) => !category || c._id?.toString() !== category._id?.toString())
                .map((c) => (
                  <MenuItem key={c._id?.toString()} value={c._id?.toString() || ''}>
                    {c.name}
                  </MenuItem>
                ))}
            </Select>
            <Typography variant="caption" sx={{ color: '#666', marginTop: 0.5, display: 'block' }}>
              Sub-categories can sit under a top-level category (one level only).
            </Typography>
          </FormControl>

          <FormControl disabled={loading}>
            <FormLabel id="listing-type-label" sx={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
              How it is sold
            </FormLabel>
            {category || parentCategory ? (
              <Typography sx={{ fontSize: 14, mt: 0.5 }}>
                {typeWord}
                <Typography component="span" sx={{ color: '#666', fontSize: 13 }}>
                  {category
                    ? ' (cannot be changed after the category is created)'
                    : ` (follows its parent, ${parentCategory?.name})`}
                </Typography>
              </Typography>
            ) : (
              <>
                <RadioGroup row aria-labelledby="listing-type-label" value={listingType} onChange={(e) => setListingType(e.target.value as CategoryListingType)}>
                  <FormControlLabel value="flat" control={<Radio />} label="Flat" />
                  <FormControlLabel value="day-wise" control={<Radio />} label="Day-wise" />
                </RadioGroup>
                <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                  {listingType === 'day-wise'
                    ? 'Day-wise: you choose which items are sold on which dates (pre-orders, daily menus).'
                    : 'Flat: the same items are sold on every open day.'}
                </Typography>
              </>
            )}
          </FormControl>

          <FormControl disabled={loading}>
            <FormControlLabel
              control={<Switch checked={available} onChange={(e) => setAvailable(e.target.checked)} color="success" />}
              label={available ? 'Available on the website' : 'Unavailable (hidden from customers)'}
            />
            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
              Turn it on when the items are ready. While it is off, customers do not see it on the website or the app.
            </Typography>
          </FormControl>

          <TextField
            label="Sequence"
            type="number"
            value={sequence}
            onChange={(e) => setSequence(Number(e.target.value))}
            disabled={loading}
            fullWidth
            required
            placeholder="Enter display order (0 for first)"
            inputProps={{ min: 0, step: 1 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#F6FAFF',
                '&:hover fieldset': {
                  borderColor: '#4F8CFF',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
            }}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            fullWidth
            multiline
            rows={3}
            placeholder="Brief description of this category (optional)"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#F6FAFF',
                '&:hover fieldset': {
                  borderColor: '#4F8CFF',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#4F8CFF',
                },
              },
            }}
          />


          <Box>
            <ImageUpload
              value={imagePreview}
              onChange={handleImageChange}
              disabled={loading}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: 3, gap: 1 }}>
        <Button
          onClick={handleCancel}
          disabled={loading}
          sx={{
            textTransform: 'none',
            color: '#666',
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
            minWidth: 100,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
