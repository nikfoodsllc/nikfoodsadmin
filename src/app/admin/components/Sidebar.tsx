'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  useMediaQuery,
  useTheme,
  IconButton,
  Divider,
} from '@mui/material';
import {
  IconLayoutDashboard,
  IconToolsKitchen2,
  IconCategory,
  IconCalendarEvent,
  IconMapPin,
  IconShoppingCart,
  IconChartBar,
  IconUsers,
  IconUserShield,
  IconChevronDown,
  IconChevronRight,
  IconX,
  IconTemplate,
  IconChefHat,
  IconShoppingCartPlus,
  IconShoppingCartOff,
} from '@tabler/icons-react';
import Image from 'next/image';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<any>;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: IconLayoutDashboard,
  },
  {
    title: 'Kitchen Dashboard (Beta)',
    href: '/admin/kitchen-dashboard',
    icon: IconChefHat,
  },
  {
    title: 'Create Order (BETA)',
    href: '/admin/create-order',
    icon: IconShoppingCartPlus,
  },
  {
    title: 'Abandoned Checkouts',
    href: '/admin/abandoned-checkouts',
    icon: IconShoppingCartOff,
  },
  {
    title: 'Food Items',
    href: '/admin/food-items',
    icon: IconToolsKitchen2,
  },
  {
    title: 'Food Category',
    href: '/admin/food-category',
    icon: IconCategory,
  },
  {
    title: 'Modifiers',
    href: '/admin/modifiers',
    icon: IconTemplate,
  },
  {
    title: 'Manage Days',
    href: '/admin/manage-days',
    icon: IconCalendarEvent,
  },
  {
    title: 'Delivery Zones',
    href: '/admin/min-cart-value',
    icon: IconMapPin,
  },
  {
    title: 'Orders',
    href: '/admin/orders',
    icon: IconShoppingCart,
  },
  {
    title: 'Reports',
    href: '/admin/reports',
    icon: IconChartBar,
    children: [
      {
        title: 'Reports Dashboard',
        href: '/admin/reports',
        icon: IconChartBar,
      },
      {
        title: 'Kitchen Report',
        href: '/admin/reports/kitchen',
        icon: IconToolsKitchen2,
      },
      {
        title: 'Delivery Report',
        href: '/admin/reports/delivery',
        icon: IconMapPin,
      },
      {
        title: 'Ordered Items',
        href: '/admin/reports/ordered-items',
        icon: IconShoppingCart,
      },
    ],
  },
  {
    title: 'All Users',
    href: '/admin/all-users',
    icon: IconUsers,
  },
  {
    title: 'Admin Users',
    href: '/admin/admin-users',
    icon: IconUserShield,
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [reportsOpen, setReportsOpen] = useState(
    pathname?.startsWith('/admin/reports') || false
  );

  const handleNavigation = (href: string) => {
    router.push(href);
    if (isMobile) {
      onMobileClose();
    }
  };

  const handleReportsToggle = () => {
    setReportsOpen(!reportsOpen);
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
      }}
    >
      {/* Logo Header */}
      <Box
        sx={{
          padding: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: 160,
            height: 60,
            cursor: 'pointer',
          }}
          onClick={() => handleNavigation('/admin')}
        >
          <Image
            src="/images/logo.png"
            alt="Nikfoods Logo"
            fill
            style={{ objectFit: 'contain' }}
            priority
          />
        </Box>
        {isMobile && (
          <IconButton onClick={onMobileClose} size="small">
            <IconX size={20} />
          </IconButton>
        )}
      </Box>

      {/* Navigation */}
      <List sx={{ flex: 1, paddingY: 2, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          if (item.children) {
            return (
              <Box key={item.title}>
                <ListItem disablePadding sx={{ paddingX: 2, marginBottom: 0.5 }}>
                  <ListItemButton
                    onClick={handleReportsToggle}
                    sx={{
                      borderRadius: 2,
                      paddingY: 1.5,
                      backgroundColor: active ? '#E6F0FF' : 'transparent',
                      color: active ? '#4F8CFF' : '#333',
                      '&:hover': {
                        backgroundColor: active ? '#E6F0FF' : '#F5F5F5',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                      <Icon size={20} />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontSize: '14px',
                        fontWeight: active ? 600 : 500,
                      }}
                    />
                    {reportsOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={reportsOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isActive(child.href);
                      return (
                        <ListItem
                          key={child.title}
                          disablePadding
                          sx={{ paddingX: 2, marginBottom: 0.5 }}
                        >
                          <ListItemButton
                            onClick={() => handleNavigation(child.href)}
                            sx={{
                              borderRadius: 2,
                              paddingY: 1.5,
                              paddingLeft: 6,
                              backgroundColor: childActive ? '#E6F0FF' : 'transparent',
                              color: childActive ? '#4F8CFF' : '#666',
                              '&:hover': {
                                backgroundColor: childActive ? '#E6F0FF' : '#F5F5F5',
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                              <ChildIcon size={18} />
                            </ListItemIcon>
                            <ListItemText
                              primary={child.title}
                              primaryTypographyProps={{
                                fontSize: '13px',
                                fontWeight: childActive ? 600 : 500,
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          }

          return (
            <ListItem key={item.title} disablePadding sx={{ paddingX: 2, marginBottom: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.href)}
                sx={{
                  borderRadius: 2,
                  paddingY: 1.5,
                  backgroundColor: active ? '#E6F0FF' : 'transparent',
                  color: active ? '#4F8CFF' : '#333',
                  '&:hover': {
                    backgroundColor: active ? '#E6F0FF' : '#F5F5F5',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                  <Icon size={20} />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontSize: '14px',
                    fontWeight: active ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer */}
      <Divider />
      <Box sx={{ padding: 2 }}>
        <Box
          sx={{
            padding: 2,
            backgroundColor: '#FFF9F2',
            borderRadius: 2,
            border: '1px solid #FFE8CC',
          }}
        >
          <Box sx={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
            Nikfoods Admin
          </Box>
          <Box sx={{ fontSize: '11px', color: '#999', textAlign: 'center', marginTop: 0.5 }}>
            v1.0.0
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: 270,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 270,
              boxSizing: 'border-box',
              borderRight: '1px solid #e0e0e0',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: 270,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
