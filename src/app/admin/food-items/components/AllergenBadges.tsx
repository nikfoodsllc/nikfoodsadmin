'use client';

import { Box, Typography } from '@mui/material';
import { ALLERGENS, cleanAllergens } from '@/utils/allergens';

/** The allergens of an item as small chips for the table ("None" when it has none). */
export default function AllergenBadges({ value }: { value?: string[] | null }) {
  const list = cleanAllergens(value);
  if (list.length === 0) {
    return <Typography sx={{ fontSize: '12.5px', fontStyle: 'italic', color: '#9CA3AF', whiteSpace: 'nowrap' }}>None</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {list.map((k) => {
        const a = ALLERGENS.find((x) => x.key === k)!;
        return (
          <Box key={k} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.9, py: 0.2, borderRadius: 999, backgroundColor: a.bg, color: a.color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {a.emoji && <span aria-hidden>{a.emoji}</span>}
            {a.label}
          </Box>
        );
      })}
    </Box>
  );
}
