'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Snackbar, Typography } from '@mui/material';
import { IconSortDescending } from '@tabler/icons-react';
import ItemSequenceDialog from '../food-category/components/ItemSequenceDialog';
import { useFoodMenuCategory } from '../menu-builder/useFoodMenuCategory';

/** Menu Item Sequence (left menu): the Food Menu's item order opens right away; Open brings it back after closing. */
export default function MenuItemSequencePage() {
  const { category, error, loading } = useFoodMenuCategory();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const openedOnce = useRef(false);

  useEffect(() => {
    if (category && !openedOnce.current) {
      openedOnce.current = true;
      setOpen(true);
    }
  }, [category]);

  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (loading || !category) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', px: { xs: 0, sm: 1 } }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Menu Item Sequence</Typography>
      <Typography sx={{ fontSize: 13.5, color: '#6B7280', mt: 0.25, mb: 2 }}>Set the order the Food Menu items are shown in, day by day.</Typography>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 800 }}>{category.name}</Typography>
        <Button variant="contained" startIcon={<IconSortDescending size={18} />} onClick={() => setOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1F1712', '&:hover': { bgcolor: '#3A2A1E' } }}>
          Set the order
        </Button>
      </Paper>
      <ItemSequenceDialog
        open={open}
        category={category}
        onClose={() => setOpen(false)}
        onSave={() => {
          setOpen(false);
          setNote('Item sequence updated successfully');
        }}
      />
      <Snackbar open={Boolean(note)} autoHideDuration={4000} onClose={() => setNote('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setNote('')} severity="success" sx={{ width: '100%' }}>{note}</Alert>
      </Snackbar>
    </Box>
  );
}
