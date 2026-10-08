'use client';

import { useMemo, useState } from 'react';
import { Box, Chip, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { IconSearch } from '@tabler/icons-react';
import { GLOSSARY, groupBySection, searchGlossary, type GlossaryTone } from '@/utils/adminGlossary';

const TONES: Record<GlossaryTone, { label: string; color: string; bg: string } | null> = {
  good: { label: 'green', color: '#047857', bg: '#D1FAE5' },
  bad: { label: 'red', color: '#B91C1C', bg: '#FEE2E2' },
  warn: { label: 'amber', color: '#B45309', bg: '#FEF3C7' },
  info: { label: 'blue', color: '#1D4ED8', bg: '#DBEAFE' },
  none: null,
};

/** A list of every status, label and code the admin shows, and what each one means. Searchable. */
export default function UnderstandingAdminPage() {
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchGlossary(GLOSSARY, query), [query]);
  const groups = useMemo(() => groupBySection(found), [found]);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Understanding Admin</Typography>
      <Typography sx={{ fontSize: 14, color: '#6B7280', mb: 2 }}>
        Every status, label, colour and code shown in the admin panel, and what it means. Search for a word, for example “bounced”, “Delayed” or “card_declined”.
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search, for example: bounced, refund, cutoff, cooked"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ mb: 1.5, position: { sm: 'sticky' }, top: { sm: 77 }, zIndex: 2, bgcolor: '#fff' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} /></InputAdornment> }}
        inputProps={{ 'aria-label': 'Search the glossary' }}
      />
      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 2 }}>
        {query.trim() ? `${found.length} of ${GLOSSARY.length} entries match` : `${GLOSSARY.length} entries`}
      </Typography>

      {groups.length === 0 && <Typography sx={{ color: '#6B7280' }}>Nothing matches “{query}”. Try one word.</Typography>}

      {groups.map((group) => (
        <Box key={group.section} sx={{ mb: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>{group.section}</Typography>
          <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
            {group.entries.map((entry, index) => {
              const tone = TONES[entry.tone ?? 'none'];
              return (
                <Box key={entry.id} sx={{ p: 1.5, borderTop: index === 0 ? 'none' : '1px solid #F3F4F6' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                    <Chip
                      label={entry.term}
                      size="small"
                      sx={{ fontWeight: 700, maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.4 }, bgcolor: tone?.bg ?? '#F3F4F6', color: tone?.color ?? '#374151' }}
                    />
                    {tone && <Typography sx={{ fontSize: 11, color: '#6B7280' }}>{tone.label}</Typography>}
                  </Box>
                  <Typography sx={{ fontSize: 14, color: '#111827', wordBreak: 'break-word' }}>{entry.meaning}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>Shown in: {entry.where}</Typography>
                </Box>
              );
            })}
          </Paper>
        </Box>
      ))}
    </Box>
  );
}
