'use client';

import { Box, Button, IconButton, Typography } from '@mui/material';
import { IconMinus, IconPlus } from '@tabler/icons-react';

/**
 * The button at the end of a menu row. Nothing in the order yet: Add (or Choose when the item has options).
 * Otherwise the usual − quantity + control. For an item with options, + opens the options again (a new line) and − takes one off the latest line.
 */
export default function ItemStepper({
  quantity,
  hasOptions,
  onAdd,
  onRemove,
  name,
}: {
  quantity: number;
  hasOptions: boolean;
  onAdd: () => void;
  onRemove: () => void;
  name: string;
}) {
  if (quantity <= 0) {
    return (
      <Button size="small" variant="outlined" color="warning" startIcon={<IconPlus size={16} />} onClick={onAdd} sx={{ textTransform: 'none', flexShrink: 0, minWidth: 92 }} aria-label={`${hasOptions ? 'Choose options for' : 'Add'} ${name}`}>
        {hasOptions ? 'Choose' : 'Add'}
      </Button>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, border: '1px solid #F5C77E', borderRadius: 2, bgcolor: '#FFF8EC', minWidth: 92, justifyContent: 'space-between' }}>
      <IconButton size="small" onClick={onRemove} aria-label={`One less ${name}`} sx={{ color: '#A85A00' }}>
        <IconMinus size={16} />
      </IconButton>
      <Typography sx={{ fontWeight: 800, fontSize: 14, minWidth: 22, textAlign: 'center' }} aria-live="polite" aria-label={`${quantity} in the order`}>
        {quantity}
      </Typography>
      <IconButton size="small" onClick={onAdd} aria-label={hasOptions ? `Add another ${name} with options` : `One more ${name}`} sx={{ color: '#A85A00' }}>
        <IconPlus size={16} />
      </IconButton>
    </Box>
  );
}
