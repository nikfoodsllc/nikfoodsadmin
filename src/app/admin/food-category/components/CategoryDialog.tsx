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
  FormControlLabel,
  Switch,
  RadioGroup,
  Radio,
  FormLabel,
  Typography,
} from '@mui/material';
import ImageUpload from './ImageUpload';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { FoodCategory, CategoryListingType } from '@/types/order';
import { useAuth } from '@/contexts/AuthContext';

interface CategoryDialogProps {
  open: boolean;
  category: FoodCategory | null;
  onClose: () => void;
  onSave: (data: Partial<Omit<FoodCategory, '_id'>> & { _id?: string; isImageUpdated?: boolean }) => Promise<void>;
}

export default function CategoryDialog({ open, category, onClose, onSave }: CategoryDialogProps) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sequence, setSequence] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [listingType, setListingType] = useState<CategoryListingType>('flat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setDescription(category.description || '');
        setSequence(category.sequence || 0);
        setImagePreview(category.url || null);
        setIsDraft(category.isDraft || false);
        setListingType(category.listingType || 'flat');
      } else {
        setName('');
        setDescription('');
        setSequence(0);
        setImagePreview(null);
        setIsDraft(false);
        setListingType('flat');
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

  const handleSubmit = async (saveAsDraft: boolean = false) => {
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
        isDraft: saveAsDraft,
        listingType: listingType,
        dayWiseItems: [],
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
        {isDraft && ' (Draft)'}
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

          <Box sx={{
            backgroundColor: '#F6FAFF',
            padding: 2,
            borderRadius: 1,
            border: '1px solid #E0E0E0'
          }}>
            <FormLabel sx={{
              fontWeight: 500,
              color: '#333',
              marginBottom: 1,
              display: 'block'
            }}>
              Listing Type
            </FormLabel>
            <RadioGroup
              value={listingType}
              onChange={(e) => setListingType(e.target.value as CategoryListingType)}
              row
            >
              <FormControlLabel
                value="flat"
                control={<Radio
                  sx={{
                    '&.Mui-checked': {
                      color: '#4F8CFF',
                    },
                  }}
                />}
                label="Flat"
                disabled={loading}
              />
              <FormControlLabel
                value="day-wise"
                control={<Radio
                  sx={{
                    '&.Mui-checked': {
                      color: '#4F8CFF',
                    },
                  }}
                />}
                label="Day-wise"
                disabled={loading}
              />
            </RadioGroup>
            <Typography variant="caption" sx={{ color: '#666', marginTop: 0.5, display: 'block' }}>
              {listingType === 'flat'
                ? 'All items in this category will be displayed together'
                : 'Items will be displayed based on the day of the week. Manage items through the dedicated items page.'
              }
            </Typography>
          </Box>

          <Box sx={{
            backgroundColor: '#F6FAFF',
            padding: 2,
            borderRadius: 1,
            border: '1px solid #E0E0E0'
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
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
              label={
                <Box>
                  <Box sx={{ fontWeight: 500, color: '#333' }}>
                    Save as Draft
                  </Box>
                  <Box sx={{ fontSize: '0.875rem', color: '#666' }}>
                    Draft categories won't be visible to customers
                  </Box>
                </Box>
              }
              sx={{
                alignItems: 'flex-start',
                marginLeft: 0,
                '& .MuiFormControlLabel-label': {
                  marginLeft: 1,
                }
              }}
            />
          </Box>

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
          onClick={() => handleSubmit(true)}
          disabled={loading}
          variant="outlined"
          sx={{
            textTransform: 'none',
            borderColor: '#4F8CFF',
            color: '#4F8CFF',
            minWidth: 120,
            '&:hover': {
              borderColor: '#3B7AE8',
              backgroundColor: 'rgba(79, 140, 255, 0.04)',
            },
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Save as Draft'}
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
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
