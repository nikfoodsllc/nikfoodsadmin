'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Box,
  IconButton,
  Paper,
} from '@mui/material';
import { IconX, IconAlertCircle } from '@tabler/icons-react';
import { safeFormatCurrency } from '@/utils/currency';

interface ZeroPricedItem {
  itemName: string;
  sectionTitle: string;
  currentPrice: number;
  suggestedPrice: number;
}

interface PriceConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  items: ZeroPricedItem[];
  loading: boolean;
}

export default function PriceConfirmationDialog({
  open,
  onClose,
  onConfirm,
  onCancel,
  items,
  loading,
}: PriceConfirmationDialogProps) {
  const totalSuggestedPrice = items.reduce((sum, item) => sum + item.suggestedPrice, 0);

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingX: 3,
          paddingY: 2,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              backgroundColor: '#FEF3C7',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconAlertCircle size={24} color="#D97706" />
          </Box>
          <Box sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
            Price Update Confirmation
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={loading}
          sx={{
            color: '#6B7280',
            '&:hover': {
              backgroundColor: '#F3F4F6',
            },
          }}
        >
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ paddingX: 3, paddingY: 3 }}>
        <Typography variant="body1" sx={{ color: '#374151', marginBottom: 2 }}>
          The following combo item{items.length > 1 ? 's have' : ' has'} a price set to $0.
          Would you like to apply the original price{items.length > 1 ? 's' : ''} from the source item{items.length > 1 ? 's' : ''}?
        </Typography>

        {/* Items List */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, marginBottom: 2 }}>
          {items.map((item, index) => (
            <Paper
              key={index}
              elevation={0}
              sx={{
                padding: 2,
                border: '1px solid #E5E7EB',
                borderRadius: 2,
                backgroundColor: '#F9FAFB',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#111827', marginBottom: 0.5 }}
                  >
                    {item.itemName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    Section: {item.sectionTitle}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: '#9CA3AF', textDecoration: 'line-through', display: 'block' }}
                  >
                    Current: {safeFormatCurrency(item.currentPrice)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#10B981' }}
                  >
                    Suggested: {safeFormatCurrency(item.suggestedPrice)}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* Summary */}
        {items.length > 1 && (
          <Box
            sx={{
              padding: 2,
              backgroundColor: '#E6F0FF',
              borderRadius: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, color: '#374151' }}>
              Total suggested price for {items.length} items:
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#4F8CFF' }}>
              {safeFormatCurrency(totalSuggestedPrice)}
            </Typography>
          </Box>
        )}

        <Typography variant="body2" sx={{ color: '#6B7280', marginTop: 2 }}>
          Choose &quot;Apply Price&quot; to update with the suggested prices, or &quot;Keep at $0&quot; to save with zero prices.
        </Typography>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          paddingX: 3,
          paddingY: 2,
          borderTop: '1px solid #E5E7EB',
          gap: 1,
        }}
      >
        <Button
          onClick={onCancel}
          disabled={loading}
          sx={{
            textTransform: 'none',
            color: '#6B7280',
            '&:hover': {
              backgroundColor: '#F3F4F6',
            },
          }}
        >
          Keep at $0
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          sx={{
            textTransform: 'none',
            backgroundColor: '#4F8CFF',
            paddingX: 3,
            minWidth: 120,
            '&:hover': {
              backgroundColor: '#3B7AE8',
            },
            '&.Mui-disabled': {
              backgroundColor: '#D1D5DB',
              color: '#9CA3AF',
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={16} sx={{ color: '#fff', marginRight: 1 }} />
              Applying...
            </>
          ) : (
            'Apply Price'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
