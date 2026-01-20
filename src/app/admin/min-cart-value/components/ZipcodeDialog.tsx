'use client';

import { useState, useEffect } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { startTransition } from 'react';
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
} from '@mui/material';

interface Zipcode {
  _id: string;
  zipcode: string;
  minCartValue: number;
  deliveryFee?: number;
  label?: string;
}

interface ZipcodeDialogProps {
  open: boolean;
  zipcode: Zipcode | null;
  onClose: () => void;
  onSave: (data: Partial<Zipcode>) => Promise<void>;
}

export default function ZipcodeDialog({ open, zipcode, onClose, onSave }: ZipcodeDialogProps) {
  const [zipcodeValue, setZipcodeValue] = useState('');
  const [label, setLabel] = useState('');
  const [minCartValue, setMinCartValue] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (zipcode) {
        setZipcodeValue(zipcode.zipcode);
        setLabel(zipcode.label || '');
        setMinCartValue(zipcode.minCartValue.toString());
        setDeliveryFee(zipcode.deliveryFee?.toString() || '0');
      } else {
        setZipcodeValue('');
        setLabel('');
        setMinCartValue('');
        setDeliveryFee('0');
      }
      setError('');
    }
  }, [open, zipcode]);

  const validate = (): string | null => {
    if (!zipcodeValue.trim()) {
      return 'Zipcode is required for delivery zone';
    }

    // Validate US zipcode format (5 digits or 5+4 digits)
    const zipcodeRegex = /^\d{5}(-\d{4})?$/;
    if (!zipcodeRegex.test(zipcodeValue.trim())) {
      return 'Invalid zipcode format. Use 5 digits (12345) or 5+4 digits (12345-6789)';
    }

    // Validate label length (optional, max 50 characters)
    if (label.trim().length > 50) {
      return 'Zone label must be 50 characters or less';
    }

    if (!minCartValue.trim()) {
      return 'Minimum order value is required for delivery zone';
    }

    const cartValue = parseFloat(minCartValue);
    if (isNaN(cartValue)) {
      return 'Minimum order value must be a valid number';
    }

    if (cartValue < 0) {
      return 'Minimum order value cannot be negative';
    }

    if (!deliveryFee.trim()) {
      return 'Delivery fee is required for delivery zone';
    }

    const feeValue = parseFloat(deliveryFee);
    if (isNaN(feeValue)) {
      return 'Delivery fee must be a valid number';
    }

    if (feeValue < 0) {
      return 'Delivery fee cannot be negative';
    }

    return null;
  };

  const handleSubmit = async () => {
    // Clear error and set loading state asynchronously
    startTransition(() => {
      unstable_batchedUpdates(() => {
        setError('');
        setLoading(true);
      });
    });

    // Validate
    const validationError = validate();
    if (validationError) {
      startTransition(() => {
        unstable_batchedUpdates(() => {
          setError(validationError);
          setLoading(false);
        });
      });
      return;
    }

    try {
      // Prepare data
      const data: Partial<Zipcode> = {
        zipcode: zipcodeValue.trim(),
        label: label.trim() || undefined,
        minCartValue: parseFloat(minCartValue),
        deliveryFee: parseFloat(deliveryFee),
      };

      if (zipcode) {
        data._id = zipcode._id;
      }

      await onSave(data);
      onClose();
    } catch (err) {
      console.error('Error saving delivery zone:', err);
      startTransition(() => {
        unstable_batchedUpdates(() => {
          setError(err instanceof Error ? err.message : 'Failed to save delivery zone');
          setLoading(false);
        });
      });
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
          maxWidth: 540,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
        {zipcode ? 'Edit Delivery Zone' : 'Add New Delivery Zone'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <TextField
            label="Zipcode"
            value={zipcodeValue}
            onChange={(e) => setZipcodeValue(e.target.value)}
            disabled={loading}
            fullWidth
            required
            autoFocus
            placeholder="e.g., 12345 or 12345-6789"
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
            label="Zone Label (Optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={loading}
            fullWidth
            placeholder="e.g., Downtown Area, North Suburbs"
            inputProps={{
              maxLength: 50,
            }}
            helperText={`${label.length}/50 characters`}
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
            label="Minimum Cart Value ($)"
            value={minCartValue}
            onChange={(e) => setMinCartValue(e.target.value)}
            disabled={loading}
            fullWidth
            required
            type="number"
            placeholder="e.g., 25.00"
            inputProps={{
              min: 0,
              step: 0.01,
            }}
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
            label="Delivery Fee ($)"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            disabled={loading}
            fullWidth
            required
            type="number"
            placeholder="e.g., 0.00"
            inputProps={{
              min: 0,
              step: 0.01,
            }}
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
          onClick={handleSubmit}
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
