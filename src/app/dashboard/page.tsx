'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  Button,
  Avatar,
} from '@mui/material';
import { IconLogout, IconDashboard } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading state
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #FFF9F2 0%, #FFE8CC 100%)',
        paddingY: 4,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 50,
                height: 50,
                background: 'linear-gradient(135deg, #f89c35 0%, #d47b1a 100%)',
              }}
            >
              {user.email?.[0]?.toUpperCase() || 'A'}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Welcome, {user.name || 'Admin'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Box>

          <Button
            variant="outlined"
            startIcon={<IconLogout size={20} />}
            onClick={logout}
            sx={{
              borderColor: '#f89c35',
              color: '#f89c35',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#d47b1a',
                backgroundColor: 'rgba(248, 156, 53, 0.04)',
              },
            }}
          >
            Logout
          </Button>
        </Box>

        {/* Main Content */}
        <Card
          sx={{
            padding: 4,
            borderRadius: 3,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              padding: 3,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f89c35 0%, #d47b1a 100%)',
              marginBottom: 3,
            }}
          >
            <IconDashboard size={48} color="white" />
          </Box>

          <Typography
            variant="h3"
            fontWeight={700}
            sx={{
              marginBottom: 2,
              background: 'linear-gradient(135deg, #f89c35 0%, #d47b1a 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Admin Dashboard
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ marginBottom: 3 }}>
            Welcome to the Nikfoods Admin Panel
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              maxWidth: 400,
              margin: '0 auto',
            }}
          >
            <Card
              variant="outlined"
              sx={{
                padding: 2,
                borderColor: '#e0e0e0',
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Role
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {user.role}
              </Typography>
            </Card>

            <Card
              variant="outlined"
              sx={{
                padding: 2,
                borderColor: '#e0e0e0',
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                User ID
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {user.id}
              </Typography>
            </Card>
          </Box>

          <Box
            sx={{
              marginTop: 4,
              padding: 3,
              backgroundColor: '#FFF9F2',
              borderRadius: 2,
              border: '1px dashed #f89c35',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              This is a placeholder dashboard. Admin features will be implemented here.
            </Typography>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
