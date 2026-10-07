'use client';

import { useEffect, useState } from 'react';
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
  IconChefHat,
  IconShoppingCartPlus,
  IconShoppingCartOff,
} from '@tabler/icons-react';
import Image from 'next/image';

interface NavItem {
  title: string;
  /** Missing on a group header: it only opens and closes its list */
  href?: string;
  icon: React.ComponentType<any>;
  children?: NavItem[];
}

/**
 * The admin menu: Order, Reporting (Kitchen Dashboard first: the page admins land on), Manage Days, Delivery Zones,
 * Food Catalog and User Administration. Pages that are no longer in the menu (the old stats Dashboard at
 * /admin/dashboard, Modifiers) still work when opened by their address.
 */
const navItems: NavItem[] = [
  {
    title: 'Order',
    icon: IconShoppingCart,
    children: [
      { title: 'Order', href: '/admin/orders', icon: IconShoppingCart },
      { title: 'Create Order', href: '/admin/create-order', icon: IconShoppingCartPlus },
    ],
  },
  {
    title: 'Reporting',
    icon: IconChartBar,
    children: [
      { title: 'Kitchen Dashboard (BETA)', href: '/admin/kitchen-dashboard', icon: IconChefHat },
      { title: 'Ordered Items', href: '/admin/reports/ordered-items', icon: IconShoppingCart },
      { title: 'Kitchen Report (BETA)', href: '/admin/reports/kitchen', icon: IconToolsKitchen2 },
      { title: 'Delivery Report', href: '/admin/reports/delivery', icon: IconMapPin },
      { title: 'Abandoned Checkout (BETA)', href: '/admin/abandoned-checkouts', icon: IconShoppingCartOff },
    ],
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
    title: 'Food Catalog',
    icon: IconToolsKitchen2,
    children: [
      { title: 'Food Items', href: '/admin/food-items', icon: IconToolsKitchen2 },
      { title: 'Food Category', href: '/admin/food-category', icon: IconCategory },
    ],
  },
  {
    title: 'User Administration',
    icon: IconUsers,
    children: [
      { title: 'All Users', href: '/admin/all-users', icon: IconUsers },
      { title: 'Admin Users', href: '/admin/admin-users', icon: IconUserShield },
    ],
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
  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href) || false;
  };
  const groupHasActive = (item: NavItem) => (item.children ?? []).some((child) => isActive(child.href));

  // which groups are open: the one holding the page you are on opens by itself, any can be opened or closed by hand
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navItems.filter((item) => item.children && item.children.some((c) => c.href && pathname?.startsWith(c.href))).map((item) => [item.title, true]))
  );
  useEffect(() => {
    const holding = navItems.find((item) => item.children && item.children.some((c) => c.href && pathname?.startsWith(c.href)));
    if (holding) setOpenGroups((current) => (current[holding.title] ? current : { ...current, [holding.title]: true }));
  }, [pathname]);

  const handleNavigation = (href: string) => {
    router.push(href);
    if (isMobile) {
      onMobileClose();
    }
  };

  const handleGroupToggle = (title: string) => {
    setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
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
          const active = item.children ? groupHasActive(item) : isActive(item.href);

          if (item.children) {
            const open = Boolean(openGroups[item.title]);
            return (
              <Box key={item.title}>
                <ListItem disablePadding sx={{ paddingX: 2, marginBottom: 0.5 }}>
                  <ListItemButton
                    onClick={() => handleGroupToggle(item.title)}
                    aria-expanded={open}
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
                    {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={open} timeout="auto" unmountOnExit>
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
                            onClick={() => child.href && handleNavigation(child.href)}
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
                onClick={() => item.href && handleNavigation(item.href)}
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
