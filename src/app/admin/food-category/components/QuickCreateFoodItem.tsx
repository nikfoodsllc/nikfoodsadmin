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
  Box,
  Typography,
  FormControlLabel,
  Switch,
  IconButton,
  Alert,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import { uploadToCloudinary } from '@/lib/cloudinary';

interface QuickCreateFoodItemProps {
  open: boolean;
  categoryId: string;
  categoryName: string;
  token: string;
  onClose: () => void;
  onSuccess: (newItemId: string) => void;
}

interface FormData {
  name: string;
  description: string;
  price: string;
  veg: boolean;
  available: boolean;
  isDraft: boolean;
  imagePreview: string;
}

const getDefaultFormData = (): FormData => ({
  name: '',
  description: '',
  price: '',
  veg: true,
  available: true,
  isDraft: false,
  imagePreview: '',
});

export default function QuickCreateFoodItem({
  open,
  categoryId,
  categoryName,
  token,
  onClose,
  onSuccess,
}: QuickCreateFoodItemProps) {
  const [formData, setFormData] = useState<FormData>(getDefaultFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData(getDefaultFormData());
      setImageFile(null);
      setErrors({});
    }
  }, [open]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
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

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          imagePreview: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormData((prev) => ({
        ...prev,
        imagePreview: '',
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

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      newErrors.price = 'Please enter a valid price';
    }

    if (!imageFile && !formData.imagePreview) {
      newErrors.image = 'Image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (saveAsDraft: boolean = false) => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Upload image first if provided
      let imageUrl = '';
      let publicId = '';

      if (imageFile) {
        setUploadingImage(true);
        try {
          const uploadResult = await uploadToCloudinary(imageFile);
          imageUrl = uploadResult.secure_url;
          publicId = uploadResult.public_id;
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          setErrors({ image: 'Failed to upload image. Please try again.' });
          setLoading(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      // Create food item via API
      const response = await fetch('/api/admin/food-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          short_description: 'A perfect balance of taste, aroma, and warmth.',
          price: parseFloat(formData.price),
          category: [categoryId], // Automatically assign to current category
          veg: formData.veg,
          available: formData.available,
          isDraft: saveAsDraft,
          itemType: 'simple',
          url: imageUrl,
          public_id: publicId,
          isEcoFriendlyContainer: false,
          ecoContainerCharge: 0,
          hasSpiceLevel: false,
          spiceLevel: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create food item');
      }

      const result = await response.json();
      const newItemId = result._id || result.data?._id;

      if (newItemId) {
        onSuccess(newItemId);
        handleClose();
      } else {
        throw new Error('Failed to get new item ID');
      }
    } catch (err) {
      console.error('Error creating food item:', err);
      setErrors({
        submit: err instanceof Error ? err.message : 'Failed to create food item',
      });
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  const handleClose = () => {
    if (!loading && !uploadingImage) {
      setFormData(getDefaultFormData());
      setImageFile(null);
      setErrors({});
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            Create New Food Item
          </Typography>
          <Typography variant="caption" sx={{ color: '#666' }}>
            Will be automatically added to: <strong>{categoryName}</strong>
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={loading || uploadingImage}
          size="small"
        >
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {errors.submit && (
            <Alert severity="error" onClose={() => setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.submit;
              return newErrors;
            })}>
              {errors.submit}
            </Alert>
          )}

          {/* Image Upload */}
          <Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, mb: 1, color: '#333' }}
            >
              Food Image *
            </Typography>
            <Box
              sx={{
                border: '2px dashed #E0E0E0',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: loading || uploadingImage ? 'not-allowed' : 'pointer',
                backgroundColor: formData.imagePreview ? 'transparent' : '#FAFAFA',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: loading || uploadingImage ? '#E0E0E0' : '#4F8CFF',
                  backgroundColor: loading || uploadingImage ? 'transparent' : 'rgba(79, 140, 255, 0.02)',
                },
              }}
              onClick={() => {
                if (!(loading || uploadingImage)) {
                  document.getElementById('image-upload-input')?.click();
                }
              }}
            >
              {formData.imagePreview ? (
                <Box
                  component="img"
                  src={formData.imagePreview}
                  alt="Preview"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Box>
                  <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                    {uploadingImage ? 'Uploading...' : 'Click to upload food image'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#999' }}>
                    Recommended: Square image (500x500px)
                  </Typography>
                </Box>
              )}
              <input
                id="image-upload-input"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                disabled={loading || uploadingImage}
                style={{ display: 'none' }}
              />
            </Box>
            {errors.image && (
              <Typography variant="caption" sx={{ color: '#F44336', mt: 1, display: 'block' }}>
                {errors.image}
              </Typography>
            )}
          </Box>

          {/* Name */}
          <TextField
            label="Food Item Name *"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={loading || uploadingImage}
            fullWidth
            error={!!errors.name}
            helperText={errors.name}
            placeholder="e.g., Butter Chicken"
          />

          {/* Description */}
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            disabled={loading || uploadingImage}
            fullWidth
            multiline
            rows={3}
            placeholder="Brief description of the food item"
            error={!!errors.description}
            helperText={errors.description}
          />

          {/* Price */}
          <TextField
            label="Price ($) *"
            type="number"
            value={formData.price}
            onChange={(e) => handleChange('price', e.target.value)}
            disabled={loading || uploadingImage}
            fullWidth
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
            error={!!errors.price}
            helperText={errors.price}
            placeholder="0.00"
          />

          {/* Veg/Non-Veg Toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              backgroundColor: '#F6FAFF',
              borderRadius: 1,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>
                Food Type
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                {formData.veg ? 'Vegetarian' : 'Non-Vegetarian'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: formData.veg ? '#4CAF50' : '#F44336' }}>
                {formData.veg ? '🟢 Veg' : '🔴 Non-Veg'}
              </Typography>
              <Switch
                checked={formData.veg}
                onChange={(e) => handleChange('veg', e.target.checked)}
                disabled={loading || uploadingImage}
                color="success"
              />
            </Box>
          </Box>

          {/* Available Toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              backgroundColor: '#F6FAFF',
              borderRadius: 1,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>
                Available for Ordering
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                {formData.available ? 'Yes' : 'No'}
              </Typography>
            </Box>
            <Switch
              checked={formData.available}
              onChange={(e) => handleChange('available', e.target.checked)}
              disabled={loading || uploadingImage}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button
          onClick={handleClose}
          disabled={loading || uploadingImage}
          sx={{
            textTransform: 'none',
            color: '#666',
            flex: { xs: 1, sm: 'none' },
          }}
        >
          Cancel
        </Button>
        <Box sx={{ display: 'flex', gap: 1, flex: { xs: 1, sm: 'none' } }}>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={loading || uploadingImage}
            variant="outlined"
            sx={{
              textTransform: 'none',
              borderColor: '#FFA726',
              color: '#FFA726',
              flex: 1,
              '&:hover': {
                borderColor: '#FB8C00',
                backgroundColor: 'rgba(255, 167, 38, 0.04)',
              },
            }}
          >
            {loading ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={loading || uploadingImage}
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              backgroundColor: '#4F8CFF',
              flex: 1,
              '&:hover': {
                backgroundColor: '#3B7AE8',
              },
            }}
          >
            {loading ? 'Creating...' : 'Create Item'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
