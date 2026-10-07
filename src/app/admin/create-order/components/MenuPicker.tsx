'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Chip, InputAdornment, Paper, TextField, Typography } from '@mui/material';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { itemGroupsForDay, needsOptions, type MenuItem, type MenuPayload } from '@/utils/createOrder';

const money = (n: number) => `$${Number(n).toFixed(2)}`;

export const dayChipLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Pick the delivery day, then add items from that day's menu (the same menu customers see). */
export default function MenuPicker({
  menu,
  date,
  onDate,
  counts,
  onChoose,
}: {
  menu: MenuPayload;
  date: string;
  onDate: (d: string) => void;
  /** Items already in the order, per day (shown on the day chips) */
  counts: Record<string, number>;
  onChoose: (item: MenuItem) => void;
}) {
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemGroupsForDay(menu, date)
      .map((g) => ({ ...g, items: q ? g.items.filter((i) => i.name.toLowerCase().includes(q)) : g.items }))
      .filter((g) => g.items.length > 0);
  }, [menu, date, search]);

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #E5E7EB', borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.5 }}>2. Items</Typography>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 1.5 }}>Choose the delivery day, then add items. Only days that are still open for ordering are listed.</Typography>

      {menu.openDates.length === 0 ? (
        <Typography sx={{ color: '#B45309', fontSize: 14 }}>No day is open for ordering right now.</Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, mb: 1 }}>
          {menu.openDates.map((d) => (
            <Chip
              key={d}
              label={`${dayChipLabel(d)}${counts[d] ? ` · ${counts[d]}` : ''}`}
              color={d === date ? 'warning' : 'default'}
              variant={d === date ? 'filled' : 'outlined'}
              onClick={() => onDate(d)}
              sx={{ flexShrink: 0, fontWeight: 600 }}
            />
          ))}
        </Box>
      )}

      <TextField
        placeholder="Search this day's menu"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        fullWidth
        InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} /></InputAdornment> }}
        sx={{ mb: 1.5 }}
      />

      {groups.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>{search ? 'Nothing matches your search.' : 'Nothing is on the menu for this day.'}</Typography>}
      {groups.map((group) => (
        <Box key={group.category} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A85A00', mb: 0.5 }}>{group.category}</Typography>
          {group.items.map((item) => (
            <Box key={item._id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: item.veg ? '#16A34A' : '#DC2626' }} aria-label={item.veg ? 'Vegetarian' : 'Non-vegetarian'} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{item.name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                  {item.portions?.length ? `from ${money(Math.min(...(item.portionPrices?.length ? item.portionPrices : [item.price])))}` : money(item.price)}
                  {item.hasCombo ? ' · combo' : ''}
                </Typography>
              </Box>
              <Button size="small" variant="outlined" color="warning" startIcon={<IconPlus size={16} />} onClick={() => onChoose(item)} sx={{ textTransform: 'none', flexShrink: 0 }}>
                {needsOptions(item) ? 'Choose' : 'Add'}
              </Button>
            </Box>
          ))}
        </Box>
      ))}
    </Paper>
  );
}
