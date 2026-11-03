'use client';

import { Box, Typography } from '@mui/material';
import { ALLERGENS, AllergenKey, cleanAllergens } from '@/utils/allergens';

/** Tick the allergens an item contains (edit dialogs). Nothing ticked = the item has none. */
export default function AllergensField({ value, onChange, disabled }: { value?: string[] | null; onChange: (value: AllergenKey[]) => void; disabled?: boolean }) {
  const have = cleanAllergens(value);
  const toggle = (key: AllergenKey) => onChange(cleanAllergens(have.includes(key) ? have.filter((k) => k !== key) : [...have, key]));
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>
          Allergens
        </Typography>
        <Typography variant="caption" sx={{ color: '#6B7280' }}>
          Tick what it contains. None ticked = no allergens.
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }} role="group" aria-label="Allergens">
        {ALLERGENS.map((a) => {
          const on = have.includes(a.key);
          return (
            <Box
              key={a.key}
              component="button"
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={disabled}
              onClick={() => toggle(a.key)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                border: `1.5px solid ${on ? a.color : '#D1D5DB'}`,
                backgroundColor: on ? a.bg : '#fff',
                color: on ? a.color : '#4B5563',
                fontWeight: on ? 700 : 500,
                fontSize: 13,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                font: 'inherit',
                '&:focus-visible': { outline: `2px solid ${a.color}`, outlineOffset: 1 },
              }}
            >
              {a.emoji && <span aria-hidden>{a.emoji}</span>}
              {a.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
