'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { IconMail, IconLock, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { validateLoginForm } from '@/lib/validation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated - moved to useEffect to avoid render phase navigation
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/admin');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError('');
    setErrors({});

    // Validate form
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      // Login function handles redirect to dashboard
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #FFF9F2 0%, #FFE8CC 100%)',
        padding: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 450,
          width: '100%',
          padding: { xs: 3, sm: 4 },
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', marginBottom: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f89c35 0%, #d47b1a 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 1,
            }}
          >
            Admin Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your credentials to access the admin panel
          </Typography>
        </Box>

        {/* Error Alert */}
        {apiError && (
          <Alert severity="error" sx={{ marginBottom: 3 }}>
            {apiError}
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Email Field */}
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!errors.email}
              helperText={errors.email}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconMail size={20} color="#666666" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#f89c35',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#f89c35',
                  },
                },
              }}
            />

            {/* Password Field */}
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!errors.password}
              helperText={errors.password}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconLock size={20} color="#666666" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                      size="small"
                    >
                      {showPassword ? (
                        <IconEyeOff size={20} color="#666666" />
                      ) : (
                        <IconEye size={20} color="#666666" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: '#f89c35',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#f89c35',
                  },
                },
              }}
            />

            {/* Login Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                marginTop: 1,
                padding: '12px',
                background: 'linear-gradient(135deg, #f89c35 0%, #d47b1a 100%)',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(248, 156, 53, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #fbb76a 0%, #f89c35 100%)',
                  boxShadow: '0 6px 16px rgba(248, 156, 53, 0.4)',
                },
                '&:disabled': {
                  background: '#e0e0e0',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                'Login'
              )}
            </Button>
          </Box>
        </form>

        {/* Footer */}
        <Box sx={{ marginTop: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Admin access only. Unauthorized access is prohibited.
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}
