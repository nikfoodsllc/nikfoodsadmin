'use client';

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';

interface DeleteConfirmDialogProps {
  open: boolean;
  itemName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  open,
  itemName,
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
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem' }}>Delete Food Item</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ color: '#666' }}>
          Are you sure you want to delete <strong style={{ color: '#333' }}>{itemName}</strong>?
        </Typography>
        <Typography variant="body2" sx={{ color: '#999', marginTop: 1 }}>
          This action cannot be undone. The item image will also be deleted.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ padding: 2, gap: 1 }}>
        <Button onClick={onCancel} disabled={loading} sx={{ textTransform: 'none', color: '#666' }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color="error"
          sx={{ textTransform: 'none', minWidth: 100 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
