'use client';

import { Box, Typography, Card, CardContent } from '@mui/material';
import { useRouter } from 'next/navigation';
import { IconToolsKitchen2, IconTruckDelivery, IconShoppingCart } from '@tabler/icons-react';

export default function ReportsDashboardPage() {
  const router = useRouter();

  const reportCards = [
    {
      title: 'Kitchen Report (BETA)',
      description: 'View item-wise and order-wise kitchen details including quantities and spice levels',
      icon: IconToolsKitchen2,
      iconColor: '#4F8CFF',
      iconBgColor: '#E6F0FF',
      path: '/admin/reports/kitchen',
    },
    {
      title: 'Delivery Report',
      description: 'View delivery-wise reports with customer details and order summaries',
      icon: IconTruckDelivery,
      iconColor: '#5FD068',
      iconBgColor: '#EBFBEF',
      path: '/admin/reports/delivery',
    },
    {
      title: 'Ordered Items',
      description: 'View detailed ordered items report with customer details, quantities, spice levels, and pricing',
      icon: IconShoppingCart,
      iconColor: '#F59E0B',
      iconBgColor: '#FEF3C7',
      path: '/admin/reports/ordered-items',
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          marginBottom: 4,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827', marginBottom: 1 }}>
          Reports
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>
          Select a report type to view detailed analytics and data
        </Typography>
      </Box>

      {/* Report Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(2, 1fr)',
          },
          gap: 3,
        }}
      >
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              onClick={() => router.push(card.path)}
              sx={{
                cursor: 'pointer',
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ flex: 1, padding: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    backgroundColor: card.iconBgColor,
                    marginBottom: 2,
                  }}
                >
                  <Icon size={28} color={card.iconColor} />
                </Box>

                <Typography
                  variant="h6"
                  sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: 1,
                  }}
                >
                  {card.title}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '14px',
                    color: '#6B7280',
                    lineHeight: 1.5,
                  }}
                >
                  {card.description}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
