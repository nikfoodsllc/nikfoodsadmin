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
import { UserDocument } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';

type AdminUserWithoutPassword = Omit<UserDocument, 'password'>;

interface PasswordResetDialogProps {
  open: boolean;
  admin: AdminUserWithoutPassword | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function PasswordResetDialog({
  open,
  admin,
  onClose,
  onSuccess,
}: PasswordResetDialogProps) {
  const { token, isAuthenticated } = useAuth();

  const [formState, setFormState] = useState({
    newPassword: '',
    confirmPassword: '',
    loading: false,
    error: '',
  });

  const { newPassword, confirmPassword, loading, error } = formState;

  useEffect(() => {
    if (open) {
      setFormState({
        newPassword: '',
        confirmPassword: '',
        loading: false,
        error: '',
      });
    }
  }, [open]);

  const validateForm = () => {
    if (!newPassword) {
      setFormState(prev => ({ ...prev, error: 'New password is required' }));
      return false;
    }

    if (newPassword.length < 6) {
      setFormState(prev => ({ ...prev, error: 'Password must be at least 6 characters long' }));
      return false;
    }

    if (newPassword !== confirmPassword) {
      setFormState(prev => ({ ...prev, error: 'Passwords do not match' }));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !admin?._id) {
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
      const response = await fetch(`/api/admin/admin-users/${admin._id.toString()}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      onSuccess('Password reset successfully');
    } catch (error) {
      console.error('Error resetting password:', error);
      setFormState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to reset password',
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
        Reset Password
      </DialogTitle>

      <DialogContent>
        {admin && (
          <Alert severity="info" sx={{ marginBottom: 2 }}>
            Resetting password for: <strong>{admin.name || admin.email}</strong>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 1 }}>
          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              New Password <span style={{ color: '#DC2626' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              value={newPassword}
              onChange={(e) => {
                setFormState(prev => ({
                  ...prev,
                  newPassword: e.target.value,
                  error: '',
                }));
              }}
              disabled={loading}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              Confirm Password <span style={{ color: '#DC2626' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setFormState(prev => ({
                  ...prev,
                  confirmPassword: e.target.value,
                  error: '',
                }));
              }}
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
            backgroundColor: '#EA580C',
            '&:hover': {
              backgroundColor: '#C2410C',
            },
          }}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
