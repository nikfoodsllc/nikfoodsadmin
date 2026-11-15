'use client';

import { useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import CategoryPickerList from '../menu-builder/components/CategoryPickerList';
import ItemSequenceDialog from '../food-category/components/ItemSequenceDialog';
import type { FoodCategory } from '@/types/order';

/** Menu Item Sequence: pick a category, then drag its items into the order customers see them. */
export default function MenuItemSequencePage() {
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [note, setNote] = useState('');
  return (
    <>
      <CategoryPickerList
        title="Menu Item Sequence"
        description="Choose a category to set the order its items are shown in."
        actionLabel="Set order"
        onPick={(c) => setCategory(c)}
      />
      <ItemSequenceDialog
        open={category !== null}
        category={category}
        onClose={() => setCategory(null)}
        onSave={() => {
          setCategory(null);
          setNote('Item sequence updated successfully');
        }}
      />
      <Snackbar open={Boolean(note)} autoHideDuration={4000} onClose={() => setNote('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setNote('')} severity="success" sx={{ width: '100%' }}>{note}</Alert>
      </Snackbar>
    </>
  );
}
