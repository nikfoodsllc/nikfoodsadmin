'use client';

import { Box, Typography } from '@mui/material';
import { IconChevronRight, IconHandClick } from '@tabler/icons-react';

/** The corner arrow on a tile that opens a list when tapped, so it is clear there is more inside */
export function DrillArrow() {
  return (
    <Box aria-hidden sx={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', bgcolor: '#FBF3E6', color: '#B8893B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconChevronRight size={15} stroke={2.2} />
    </Box>
  );
}

/** 'See names' with an arrow, under a tile's number */
export function DrillLabel({ text = 'See names' }: { text?: string }) {
  return (
    <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: 11, color: '#B8893B', fontWeight: 700, mt: 0.25 }}>
      {text}
      <IconChevronRight size={13} stroke={2.4} />
    </Typography>
  );
}

/** A line above a chart whose bars can be tapped */
export function TapBarsHint({ text = 'Tap a bar to see names' }: { text?: string }) {
  return (
    <Typography component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12, color: '#B8893B', fontWeight: 600, mb: 0.75 }}>
      <IconHandClick size={15} />
      {text}
    </Typography>
  );
}
