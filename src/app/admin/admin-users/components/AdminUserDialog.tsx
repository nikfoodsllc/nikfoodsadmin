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

interface AdminUserDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  admin: AdminUserWithoutPassword | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function AdminUserDialog({
  open,
  mode,
  admin,
  onClose,
  onSuccess,
}: AdminUserDialogProps) {
  const { token, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && admin) {
      setFormData({
        name: admin.name || '',
        email: admin.email || '',
        phone: admin.phone || '',
        password: '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
      });
    }
    setError('');
  }, [mode, admin, open]);

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }

    if (mode === 'create' && !formData.password) {
      setError('Password is required');
      return false;
    }

    if (formData.password && formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!isAuthenticated || !token) {
      setError('Authentication required. Please log in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let url = '/api/admin/admin-users';
      let method = 'POST';
      const body: Record<string, string> = {
        email: formData.email.trim(),
      };

      if (formData.name.trim()) {
        body.name = formData.name.trim();
      }

      if (formData.phone.trim()) {
        body.phone = formData.phone.trim();
      }

      if (mode === 'create') {
        body.password = formData.password;
      } else if (mode === 'edit' && admin?._id) {
        url = `/api/admin/admin-users/${admin._id.toString()}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save admin user');
      }

      onSuccess(
        mode === 'create'
          ? 'Admin user created successfully'
          : 'Admin user updated successfully'
      );
    } catch (error) {
      console.error('Error saving admin:', error);
      setError(error instanceof Error ? error.message : 'Failed to save admin user');
    } finally {
      setLoading(false);
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
        {mode === 'create' ? 'Add New Admin' : 'Edit Admin User'}
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
              Name
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter admin name"
              value={formData.name}
              onChange={handleChange('name')}
              disabled={loading}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              Email <span style={{ color: '#DC2626' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="email"
              placeholder="Enter email address"
              value={formData.email}
              onChange={handleChange('email')}
              disabled={loading}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
              Phone
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={handleChange('phone')}
              disabled={loading}
            />
          </Box>

          {mode === 'create' && (
            <Box>
              <Typography variant="body2" sx={{ marginBottom: 0.5, fontWeight: 500 }}>
                Password <span style={{ color: '#DC2626' }}>*</span>
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={formData.password}
                onChange={handleChange('password')}
                disabled={loading}
              />
            </Box>
          )}

          {mode === 'edit' && (
            <Alert severity="info" sx={{ marginTop: 1 }}>
              To change the password, use the &quot;Reset Password&quot; action from the table.
            </Alert>
          )}
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
          {loading ? 'Saving...' : mode === 'create' ? 'Create Admin' : 'Update Admin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
