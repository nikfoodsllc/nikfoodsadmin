'use client';

import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
} from '@mui/material';
import {
  IconMenu2,
  IconLogout,
  IconUser,
  IconSettings,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

interface AdminNavbarProps {
  onMobileMenuToggle: () => void;
}

export default function AdminNavbar({ onMobileMenuToggle }: AdminNavbarProps) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        color: '#333',
      }}
    >
      <Toolbar>
        {/* Mobile Menu Button */}
        <IconButton
          edge="start"
          onClick={onMobileMenuToggle}
          sx={{
            marginRight: 2,
            display: { xs: 'block', md: 'none' },
            color: '#333',
          }}
        >
          <IconMenu2 size={24} />
        </IconButton>

        {/* Page Title */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
            Admin Dashboard
          </Typography>
        </Box>

        {/* User Menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: { xs: 'none', sm: 'block' },
              textAlign: 'right',
              marginRight: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '14px' }}>
              {user?.name || 'Admin'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#666', fontSize: '12px' }}>
              {user?.email}
            </Typography>
          </Box>
          <IconButton
            onClick={handleMenuOpen}
            sx={{
              padding: 0,
            }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                backgroundColor: '#4F8CFF',
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
            </Avatar>
          </IconButton>
        </Box>

        {/* User Menu Dropdown */}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          sx={{
            '& .MuiPaper-root': {
              marginTop: 1.5,
              minWidth: 200,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              borderRadius: 2,
            },
          }}
        >
          {/* User Info */}
          <Box sx={{ paddingX: 2, paddingY: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {user?.name || 'Admin'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#666' }}>
              {user?.email}
            </Typography>
            <Box
              sx={{
                display: 'inline-block',
                marginTop: 0.5,
                paddingX: 1,
                paddingY: 0.25,
                backgroundColor: '#E6F0FF',
                borderRadius: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#4F8CFF',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {user?.role || 'ADMIN'}
              </Typography>
            </Box>
          </Box>

          <Divider />

          <MenuItem
            sx={{
              paddingY: 1.5,
              marginX: 1,
              marginY: 0.5,
              borderRadius: 1,
            }}
          >
            <ListItemIcon>
              <IconUser size={20} />
            </ListItemIcon>
            Profile
          </MenuItem>

          <MenuItem
            sx={{
              paddingY: 1.5,
              marginX: 1,
              marginY: 0.5,
              borderRadius: 1,
            }}
          >
            <ListItemIcon>
              <IconSettings size={20} />
            </ListItemIcon>
            Settings
          </MenuItem>

          <Divider />

          <MenuItem
            onClick={handleLogout}
            sx={{
              paddingY: 1.5,
              marginX: 1,
              marginY: 0.5,
              borderRadius: 1,
              color: '#FF7675',
              '&:hover': {
                backgroundColor: '#FFF0F0',
              },
            }}
          >
            <ListItemIcon>
              <IconLogout size={20} color="#FF7675" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
