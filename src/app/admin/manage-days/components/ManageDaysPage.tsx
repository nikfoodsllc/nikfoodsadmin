'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  IconCalendarEvent,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableDays } from '@/hooks/useAvailableDays';
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export function ManageDaysPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const { loading: daysLoading, error: daysError } = useAvailableDays({ enabledOnly: false });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  if (authLoading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Authentication required. Please log in again.
        </Typography>
      </Box>
    );
  }

  if (daysLoading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (daysError) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          {daysError || 'Failed to load days configuration'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Card */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          p: 3,
          borderRadius: 3,
          mb: 3,
          boxShadow: '0 8px 16px rgba(79, 70, 229, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconCalendarEvent size={28} color="#fff" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
              Manage Availability
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9, mt: 0.5 }}>
              Control category availability by date
            </Typography>
          </Box>
        </Box>
      </Card>

      {/* Calendar */}
      <AvailabilityCalendar />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}