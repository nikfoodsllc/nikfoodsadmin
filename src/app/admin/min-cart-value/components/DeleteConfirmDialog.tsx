'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';

interface DeleteConfirmDialogProps {
  open: boolean;
  zipcode: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  open,
  zipcode,
  loading,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem' }}>Delete Delivery Zone</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ color: '#666' }}>
          Are you sure you want to delete delivery zone for zipcode{' '}
          <strong style={{ color: '#333' }}>{zipcode}</strong>?
        </Typography>
        <Typography variant="body2" sx={{ color: '#999', marginTop: 1 }}>
          This action cannot be undone. The delivery zone configuration for this zipcode will be removed.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ padding: 2, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          sx={{
            textTransform: 'none',
            color: '#666',
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color="error"
          sx={{
            textTransform: 'none',
            minWidth: 100,
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
