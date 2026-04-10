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
  modifierName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  open,
  modifierName,
  loading,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ fontSize: '18px', fontWeight: 600, paddingBottom: 2 }}>
        Delete Modifier
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" sx={{ color: '#4B5563', marginBottom: 1 }}>
          Are you sure you want to delete the modifier <strong>"{modifierName}"</strong>?
        </Typography>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>
          This action cannot be undone. The modifier will be permanently removed from the system.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ paddingX: 3, paddingBottom: 3 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          sx={{
            textTransform: 'none',
            color: '#666',
            '&:hover': {
              backgroundColor: 'transparent',
              color: '#333',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{
            textTransform: 'none',
            backgroundColor: '#EF4444',
            '&:hover': {
              backgroundColor: '#DC2626',
            },
            '&:disabled': {
              backgroundColor: '#ccc',
              color: '#666',
            },
          }}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
