'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import AdminNavbar from './AdminNavbar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  // Show loading state
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ color: '#4F8CFF', marginBottom: 2 }} />
          <Typography variant="body1" sx={{ color: '#666' }}>
            Loading...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check if user is admin
  if (user.role !== 'ADMIN') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            padding: 4,
            backgroundColor: '#fff',
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            maxWidth: 400,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600, marginBottom: 2, color: '#FF7675' }}>
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ color: '#666', marginBottom: 3 }}>
            You do not have permission to access the admin panel.
          </Typography>
          <Typography variant="body2" sx={{ color: '#999' }}>
            Please contact an administrator if you believe this is an error.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleMobileClose} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: { xs: '100%', md: 'calc(100% - 270px)' },
        }}
      >
        {/* Navbar */}
        <AdminNavbar onMobileMenuToggle={handleMobileToggle} />

        {/* Content Area */}
        <Box
          sx={{
            flex: 1,
            padding: { xs: 2, sm: 3, md: 4 },
            backgroundColor: '#f5f5f5',
            overflowY: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
