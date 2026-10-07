'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Chip, Collapse, InputAdornment, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconChevronDown, IconChevronRight, IconSearch } from '@tabler/icons-react';
import {
  allMenuNodes,
  allNodeIds,
  dayMenuNodes,
  uniqueIds,
  filterNodes,
  isValidDate,
  needsOptions,
  quantityFor,
  type CartLine,
  type CatalogPayload,
  type MenuItem,
  type MenuNode,
} from '@/utils/createOrder';
import ItemStepper from './ItemStepper';

const money = (n: number) => `$${Number(n).toFixed(2)}`;

export const dayChipLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

type View = 'day' | 'all';

/**
 * Pick the delivery date (any day, also closed or past ones), then add items from that day's menu or from the whole
 * menu. Categories and sub-categories can be opened and closed. The same − quantity + control as the website's cart.
 */
export default function MenuPicker({
  catalog,
  date,
  onDate,
  lines,
  counts,
  onAdd,
  onRemove,
}: {
  catalog: CatalogPayload;
  date: string;
  onDate: (d: string) => void;
  lines: CartLine[];
  /** Items already in the order, per day (shown on the day chips) */
  counts: Record<string, number>;
  onAdd: (item: MenuItem) => void;
  onRemove: (item: MenuItem) => void;
}) {
  const [view, setView] = useState<View>('day');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const baseNodes = useMemo(() => (view === 'all' ? allMenuNodes(catalog) : dayMenuNodes(catalog, date)), [catalog, view, date]);
  const nodes = useMemo(() => filterNodes(baseNodes, catalog.items, search), [baseNodes, catalog.items, search]);
  const searching = search.trim().length > 0;
  const totalItems = useMemo(() => uniqueIds(baseNodes).length, [baseNodes]);

  // searching opens everything that matched; clearing the search puts the categories back as they were
  const expanded = useMemo(() => (searching ? new Set(allNodeIds(nodes)) : open), [searching, nodes, open]);
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // every category and sub-category starts closed (the menu is long): search, or open the ones you need

  const known = new Set(catalog.dates.map((d) => d.date));
  const dateChips = [...catalog.dates.map((d) => ({ date: d.date, hint: d.state === 'past' ? 'past' : d.state === 'closed' ? 'closed' : '' }))];
  if (date && !known.has(date)) dateChips.push({ date, hint: date < catalog.today ? 'past' : '' });
  dateChips.sort((a, b) => a.date.localeCompare(b.date));

  const renderItem = (id: string) => {
    const item = catalog.items[id];
    if (!item) return null;
    const qty = quantityFor(lines, date, id);
    return (
      <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid #F3F4F6' }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: item.veg ? '#16A34A' : '#DC2626' }} aria-label={item.veg ? 'Vegetarian' : 'Non-vegetarian'} />
        <Box sx={{ minWidth: 0, flex: '0 1 auto' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{item.name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {item.portions?.length ? `from ${money(Math.min(...(item.portionPrices?.length ? item.portionPrices : [item.price])))}` : money(item.price)}
            {item.hasCombo ? ' · combo' : ''}
            {(item as MenuItem & { available?: boolean }).available === false ? ' · hidden on the website' : ''}
          </Typography>
        </Box>
        <ItemStepper quantity={qty} hasOptions={needsOptions(item)} name={item.name} onAdd={() => onAdd(item)} onRemove={() => onRemove(item)} />
      </Box>
    );
  };

  const renderNode = (node: MenuNode, depth: number) => {
    const isOpen = expanded.has(node.id);
    // what is already in the order from this category, so it is visible while the category is closed
    const inOrder = uniqueIds([node]).reduce((sum, id) => sum + quantityFor(lines, date, id), 0);
    return (
      <Box key={node.id} sx={{ mb: depth === 0 ? 1 : 0.5, ml: depth * 1.5 }}>
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={() => toggle(node.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(node.id))}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: depth === 0 ? 0.9 : 0.6, px: 0.75, borderRadius: 1.5, cursor: 'pointer', bgcolor: depth === 0 ? '#FFF4E0' : '#F9FAFB', border: '1px solid', borderColor: depth === 0 ? '#F5D9A8' : '#EEF0F3', '&:hover': { bgcolor: depth === 0 ? '#FFEBC8' : '#F3F4F6' } }}
        >
          {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
          <Typography sx={{ flex: 1, fontSize: depth === 0 ? 13 : 13, fontWeight: 800, letterSpacing: depth === 0 ? '0.05em' : 0, textTransform: depth === 0 ? 'uppercase' : 'none', color: depth === 0 ? '#A85A00' : '#374151' }}>{node.name}</Typography>
          {inOrder > 0 && <Chip size="small" color="warning" label={`${inOrder} in order`} sx={{ height: 20, fontWeight: 700 }} />}
          <Chip size="small" label={node.total} sx={{ height: 20, fontWeight: 700 }} />
        </Box>
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <Box sx={{ pl: { xs: 0.5, sm: 1 }, pt: 0.25 }}>
            {node.itemIds.map(renderItem)}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #E5E7EB', borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.5 }}>2. Items</Typography>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 1.5 }}>
        Pick the delivery date, then add items. No cutoff applies here: any day can be used, also closed or past ones, and any item can go on any day.
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, mb: 1, alignItems: 'center' }}>
        {dateChips.map(({ date: d, hint }) => (
          <Chip
            key={d}
            label={`${dayChipLabel(d)}${hint ? ` (${hint})` : ''}${counts[d] ? ` · ${counts[d]}` : ''}`}
            color={d === date ? 'warning' : 'default'}
            variant={d === date ? 'filled' : 'outlined'}
            onClick={() => onDate(d)}
            sx={{ flexShrink: 0, fontWeight: 600 }}
          />
        ))}
      </Box>
      <TextField
        type="date"
        label="Another date"
        size="small"
        value={date}
        onChange={(e) => isValidDate(e.target.value) && onDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ mb: 1.5, width: { xs: '100%', sm: 220 } }}
        helperText={date ? `Delivering ${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}` : 'Choose a delivery date'}
      />

      <ToggleButtonGroup exclusive fullWidth size="small" value={view} onChange={(_, v: View | null) => v && setView(v)} sx={{ mb: 1.5, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700 }, '& .Mui-selected': { bgcolor: '#FDE9C4 !important', color: '#7A4300' } }}>
        <ToggleButton value="day">This day&apos;s menu</ToggleButton>
        <ToggleButton value="all">All menu</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <TextField
          placeholder={view === 'all' ? 'Search the whole menu' : "Search this day's menu"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: '1 1 220px' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} /></InputAdornment> }}
        />
        <Button size="small" onClick={() => setOpen(new Set(allNodeIds(baseNodes)))} disabled={searching} sx={{ textTransform: 'none' }}>Expand all</Button>
        <Button size="small" onClick={() => setOpen(new Set())} disabled={searching} sx={{ textTransform: 'none' }}>Collapse all</Button>
      </Box>
      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 1 }}>
        {view === 'all' ? `Whole menu: ${totalItems} items` : `${totalItems} items on the menu for this day`} · adding to {date ? dayChipLabel(date) : 'no date'}
      </Typography>

      {nodes.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>{searching ? 'Nothing matches your search.' : 'Nothing is on the menu for this day. Try "All menu".'}</Typography>}
      {nodes.map((n) => renderNode(n, 0))}
    </Paper>
  );
}
