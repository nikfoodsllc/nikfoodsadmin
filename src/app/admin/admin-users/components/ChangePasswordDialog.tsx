'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function ChangePasswordDialog({
  open,
  onClose,
  onSuccess,
}: ChangePasswordDialogProps) {
  const { token, isAuthenticated } = useAuth();

  const [formState, setFormState] = useState({
    formData: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    loading: false,
    error: '',
  });

  const { formData, loading, error } = formState;

  useEffect(() => {
    if (open) {
      setFormState({
        formData: {
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        },
        loading: false,
        error: '',
      });
    }
  }, [open]);

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: e.target.value },
      error: '',
    }));
  };

  const validateForm = () => {
    if (!formData.currentPassword) {
      setFormState(prev => ({ ...prev, error: 'Current password is required' }));
      return false;
    }

    if (!formData.newPassword) {
      setFormState(prev => ({ ...prev, error: 'New password is required' }));
      return false;
    }

    if (formData.newPassword.length < 6) {
      setFormState(prev => ({ ...prev, error: 'New password must be at least 6 characters long' }));
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setFormState(prev => ({ ...prev, error: 'New passwords do not match' }));
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      setFormState(prev => ({ ...prev, error: 'New password must be different from current password' }));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!isAuthenticated || !token) {
      setFormState(prev => ({
        ...prev,
        error: 'Authentication required. Please log in again.',
      }));
      return;
    }

    setFormState(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch('/api/admin/admin-users/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      onSuccess('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      setFormState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to change password',
      }));
    } finally {
      setFormState(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '18px' }}>
        Change My Password
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 1 }}>
          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              Current Password <span style={{ color: '#DC2626' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="password"
              placeholder="Enter current password"
              value={formData.currentPassword}
              onChange={handleChange('currentPassword')}
              disabled={loading}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              New Password <span style={{ color: '#DC2626' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              value={formData.newPassword}
              onChange={handleChange('newPassword')}
              disabled={loading}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              Confirm New Password <span style={{ color: '#DC2626' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="password"
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              disabled={loading}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ padding: 2, paddingTop: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{
            textTransform: 'none',
            backgroundColor: '#7C3AED',
            '&:hover': {
              backgroundColor: '#6D28D9',
            },
          }}
        >
          {loading ? 'Changing...' : 'Change Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
