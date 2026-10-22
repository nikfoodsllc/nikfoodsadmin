'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { nameMatches, type CategoryDeleteVerdict } from '@/utils/categoryDelete';

interface DeleteConfirmDialogProps {
  open: boolean;
  categoryName: string;
  loading: boolean;
  checking: boolean; // still working out what the delete would take with it
  verdict: CategoryDeleteVerdict | null;
  checkError: string | null;
  onConfirm: (typedName: string) => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  open,
  categoryName,
  loading,
  checking,
  verdict,
  checkError,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open, categoryName]);

  const blocked = verdict ? !verdict.allowed : false;
  const needsName = !!verdict?.needsName;
  const canDelete = !!verdict && verdict.allowed && !checkError && (!needsName || nameMatches(typed, categoryName));

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          m: { xs: 2, sm: 4 },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem' }}>Delete Category</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ color: '#666' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: '#333' }}>{categoryName}</strong>?
        </Typography>
        {checking && (
          <Typography variant="body2" sx={{ color: '#999', marginTop: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} /> Checking what is inside...
          </Typography>
        )}
        {checkError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {checkError}
          </Alert>
        )}
        {blocked && verdict?.blockedReason && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {verdict.blockedReason}
          </Alert>
        )}
        {verdict?.allowed && verdict.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {verdict.warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </Alert>
        )}
        {needsName && (
          <>
            <Typography variant="body2" sx={{ color: '#333', mt: 2, mb: 0.75 }}>
              Type <strong>{categoryName}</strong> to confirm
            </Typography>
            <TextField
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              fullWidth
              size="small"
              autoComplete="off"
              inputProps={{ 'aria-label': `Type ${categoryName} to confirm` }}
            />
          </>
        )}
        {!blocked && (
          <Typography variant="body2" sx={{ color: '#999', marginTop: 1 }}>
            This action cannot be undone. The category image will also be deleted.
          </Typography>
        )}
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
          {blocked ? 'Close' : 'Cancel'}
        </Button>
        {!blocked && (
          <Button
            onClick={() => onConfirm(typed)}
            disabled={loading || !canDelete}
            variant="contained"
            color="error"
            sx={{
              textTransform: 'none',
              minWidth: 100,
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
