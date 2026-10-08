'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, Paper, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { IconDownload, IconPrinter, IconRefresh, IconSearch, IconTruckDelivery, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { formatPSTDateISO } from '@/utils/timezone';
import {
  addDays,
  deliveryNote,
  filterBlockBySearch,
  formatDayShort,
  formatRangeLabel,
  getPresetRange,
  shortSpiceLabel,
  validateRange,
  type DayRange,
  type KitchenDay,
} from '@/utils/kitchenDashboard';
import {
  blockTotal,
  filterBlocksBySearch,
  filterStickersBySearch,
  prepCsvRows,
  stickersCsvRows,
  toCsvText,
  type KitchenReport,
  type PrepBlock,
  type PrepLine,
  type StickerLine,
} from '@/utils/kitchenReport';
import { downloadCSV } from '@/utils/csv';

type Preset = 'today' | 'tomorrow' | 'thisWeek' | 'custom';
type TabId = 'prep' | 'stickers' | 'days';

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'custom', label: 'Custom dates' },
];

interface ReportData extends KitchenReport {
  startDate: string;
  endDate: string;
  days: KitchenDay[];
}

/** Printing: only the report, no sidebar or top bar, and a block is never split across two pages. */
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  header, nav, aside, .MuiDrawer-root, .MuiAppBar-root { display: none !important; }
  main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  body { background: #fff !important; }
  .print-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; }
}
`;

const SPICE_CHIP = { bgcolor: '#FDE7E2', color: '#A12A14' };

/** When the order was placed, the day the kitchen cooks it and the day it is delivered (amber when that is a later day). */
function DatesLine({ orderedOn, kitchenDay, deliveryDate }: { orderedOn: string | null; kitchenDay: string; deliveryDate: string }) {
  const later = deliveryDate !== kitchenDay;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.45, mt: 0.15 }}>
      {orderedOn && <span>Ordered {formatDayShort(orderedOn)}</span>}
      <span>Kitchen {formatDayShort(kitchenDay)}</span>
      <Box component="span" sx={later ? { color: '#B45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.4 } : undefined}>
        {later && <IconTruckDelivery size={13} style={{ flexShrink: 0 }} />}
        Delivery {formatDayShort(deliveryDate)}
      </Box>
    </Box>
  );
}

function LineRow({ line }: { line: PrepLine }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, py: 0.9, borderTop: '1px solid #F3F4F6' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#111827', wordBreak: 'break-word' }}>{line.customerName}</Typography>
        {line.viaCombo && (
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            with {line.viaCombo}
            {line.viaSpice ? ` (${shortSpiceLabel(line.viaSpice)})` : ''}
          </Typography>
        )}
        <DatesLine orderedOn={line.orderedOn} kitchenDay={line.day} deliveryDate={line.deliveryDate} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, flexShrink: 0, maxWidth: '62%' }}>
        {line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 22, fontSize: 12, ...SPICE_CHIP }} />}
        <Typography sx={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
          {line.portion ? `${line.portion} × ${line.quantity}` : `× ${line.quantity}`}
        </Typography>
        {line.amountText && <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400E', whiteSpace: 'nowrap' }}>{line.amountText}</Typography>}
        {line.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
      </Box>
    </Box>
  );
}

function PrepCard({ block, warn }: { block: PrepBlock; warn?: boolean }) {
  return (
    <Paper className="print-card" elevation={0} sx={{ border: '1px solid', borderColor: warn ? '#FCD34D' : '#E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 1.5, bgcolor: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.25, bgcolor: warn ? '#FFFBEB' : '#F9FAFB' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#111827', wordBreak: 'break-word', lineHeight: 1.3 }}>{block.name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {block.quantity} unit{block.quantity === 1 ? '' : 's'} · {block.lines.length} order{block.lines.length === 1 ? '' : 's'}
            {block.unsized > 0 && block.totalText ? ` · ${block.unsized} without a size` : ''}
          </Typography>
          {block.eco > 0 && <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#126B2C' }}>♻️ Eco × {block.eco}</Typography>}
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: block.totalText ? 18 : 22, color: '#92400E', textAlign: 'right', lineHeight: 1.2, flexShrink: 0 }}>{blockTotal(block)}</Typography>
      </Box>
      <Box sx={{ px: 2, pb: 0.25 }}>
        {block.lines.map((line, i) => (
          <LineRow key={`${line.orderId}-${i}`} line={line} />
        ))}
      </Box>
    </Paper>
  );
}

function StickersTab({ stickers, searching }: { stickers: StickerLine[]; searching: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, StickerLine[]>();
    for (const s of stickers) {
      const key = s.deliveryDate;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stickers]);
  if (stickers.length === 0) return <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? 'No sticker matches your search.' : 'No ready-to-eat items for these days.'}</Typography>;
  return (
    <>
      {groups.map(([day, list]) => (
        <Paper key={day} className="print-card" elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 1.5, bgcolor: '#fff' }}>
          <Box sx={{ px: 2, py: 1, bgcolor: '#F9FAFB', display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Delivery {formatDayShort(day)}</Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{list.length} sticker{list.length === 1 ? '' : 's'}</Typography>
          </Box>
          <Box sx={{ px: 2, pb: 0.25 }}>
            {list.map((s, i) => (
              <Box key={`${s.orderId}-${i}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, py: 0.9, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-word' }}>{s.customerName}</Typography>
                  <Typography sx={{ fontSize: 13, color: '#374151', wordBreak: 'break-word' }}>{s.item}</Typography>
                  {s.viaCombo && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>with {s.viaCombo}</Typography>}
                  <DatesLine orderedOn={s.orderedOn} kitchenDay={s.day} deliveryDate={s.deliveryDate} />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, flexShrink: 0, maxWidth: '55%' }}>
                  {s.spice && <Chip size="small" label={shortSpiceLabel(s.spice)} sx={{ height: 22, fontSize: 12, ...SPICE_CHIP }} />}
                  <Typography sx={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{s.portion ? `${s.portion} × ${s.quantity}` : `× ${s.quantity}`}</Typography>
                  {s.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      ))}
    </>
  );
}

function DayTotalsTab({ days, searching }: { days: KitchenDay[]; searching: boolean }) {
  const filled = days.filter((d) => d.items.length > 0 || d.combos.length > 0);
  if (filled.length === 0) return <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? 'No item matches your search.' : 'Nothing ordered for these days.'}</Typography>;
  return (
    <>
      {filled.map((day) => (
        <Paper key={day.day} className="print-card" elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 1.5, bgcolor: '#fff' }}>
          <Box sx={{ px: 2, py: 1, bgcolor: '#F9FAFB', display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
              {day.weekday} <Typography component="span" sx={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{formatDayShort(day.day)}</Typography>
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{day.totals.units} units · {day.totals.orders} orders</Typography>
          </Box>
          <Box sx={{ px: 2, pb: 0.25 }}>
            {day.items.map((item, i) => {
              const note = deliveryNote(item.deliveries, item.quantity);
              return (
                <Box key={item.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, py: 0.8, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{item.name}</Typography>
                    {note && <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>{note}</Typography>}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexShrink: 0 }}>
                    {item.totalText && <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#92400E', whiteSpace: 'nowrap' }}>{item.totalText}</Typography>}
                    <Typography sx={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{item.quantity}</Typography>
                  </Box>
                </Box>
              );
            })}
            {day.combos.map((combo) => (
              <Box key={combo.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.8, borderTop: '1px solid #F3F4F6', bgcolor: '#FFFBEB', mx: -2, px: 2 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{combo.name} <Typography component="span" sx={{ fontSize: 12, color: '#6B7280' }}>(combo)</Typography></Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{combo.quantity}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      ))}
    </>
  );
}

export default function KitchenReportPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const today = useMemo(() => formatPSTDateISO(new Date()), []);
  const [preset, setPreset] = useState<Preset>('tomorrow');
  const [custom, setCustom] = useState<DayRange>({ startDate: today, endDate: addDays(today, 1) });
  const [customApplied, setCustomApplied] = useState<DayRange | null>(null);
  const [tab, setTab] = useState<TabId>('prep');
  // search: an item, a customer, an order number or a combo
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const startRequest = useLatestRequest();

  const range = useMemo<DayRange | null>(() => {
    if (preset === 'today') return { startDate: today, endDate: today };
    if (preset === 'tomorrow') return { startDate: addDays(today, 1), endDate: addDays(today, 1) };
    if (preset === 'thisWeek') return getPresetRange('thisWeek', today);
    return customApplied;
  }, [preset, today, customApplied]);

  const load = useCallback(async () => {
    if (!token || !range) return;
    const request = startRequest();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/kitchen-report?startDate=${range.startDate}&endDate=${range.endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: request.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok) throw new Error(json.error || 'Could not load the report');
      setData(json.data as ReportData);
    } catch (e) {
      if (!request.isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return;
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load the report');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [token, range, startRequest]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const searching = search.trim().length > 0;
  const cooked = useMemo(() => (data ? filterBlocksBySearch(data.cooked, search) : []), [data, search]);
  const notSet = useMemo(() => (data ? filterBlocksBySearch(data.notSet, search) : []), [data, search]);
  const stickers = useMemo(() => (data ? filterStickersBySearch(data.stickers, search) : []), [data, search]);
  const dayBlocks = useMemo(() => (data ? data.days.map((d) => (searching ? filterBlockBySearch(d, search) : d)) : []), [data, search, searching]);
  const cookedCount = cooked.length;
  const notSetCount = notSet.length;

  if (authLoading || !isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  const customProblem = preset === 'custom' ? validateRange(custom) : null;

  const download = () => {
    if (!data || !range) return;
    const label = range.startDate === range.endDate ? range.startDate : `${range.startDate}_to_${range.endDate}`;
    if (tab === 'prep') downloadCSV(toCsvText(prepCsvRows([...cooked, ...notSet])), `kitchen-prep-${label}.csv`);
    else if (tab === 'stickers') downloadCSV(toCsvText(stickersCsvRows(stickers)), `stickers-${label}.csv`);
    else {
      const rows: string[][] = [['Day', 'Item', 'Quantity', 'Total amount', 'Delivered later']];
      for (const d of dayBlocks) {
        for (const i of d.items) rows.push([d.day, i.name, String(i.quantity), i.totalText, deliveryNote(i.deliveries, i.quantity)]);
        for (const c of d.combos) rows.push([d.day, `${c.name} (combo)`, String(c.quantity), '', deliveryNote(c.deliveries, c.quantity)]);
      }
      downloadCSV(toCsvText(rows), `day-totals-${label}.csv`);
    }
  };

  return (
    <Box>
      <style>{PRINT_CSS}</style>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
            Kitchen Report (BETA)
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
            What to cook and what to pack for each menu day. Paid orders only; cancelled and refunded orders are left out.
          </Typography>
        </Box>
        <Box className="no-print" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="outlined" size="small" startIcon={<IconDownload size={16} />} onClick={download} disabled={!data || loading} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Download CSV
          </Button>
          <Button variant="outlined" size="small" startIcon={<IconPrinter size={16} />} onClick={() => window.print()} disabled={!data || loading} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Print
          </Button>
          <Tooltip title="Reload">
            <span>
              <IconButton onClick={load} disabled={loading} aria-label="Reload the report">
                <IconRefresh size={20} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Paper className="no-print" elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: preset === 'custom' ? 1.5 : 0 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              clickable
              onClick={() => setPreset(p.id)}
              color={preset === p.id ? 'primary' : 'default'}
              variant={preset === p.id ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600, ...(preset === p.id ? { bgcolor: '#F89C35', color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }}
            />
          ))}
        </Box>
        {preset === 'custom' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <TextField label="From" type="date" size="small" value={custom.startDate} onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" size="small" value={custom.endDate} onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <Button variant="contained" size="small" disabled={Boolean(customProblem)} onClick={() => setCustomApplied({ ...custom })} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#F89C35', '&:hover': { bgcolor: '#E08A28' } }}>
              Show
            </Button>
            {customProblem && <Typography sx={{ fontSize: 12, color: '#B91C1C' }}>{customProblem}</Typography>}
          </Box>
        )}
      </Paper>

      {range && (
        <Typography sx={{ fontSize: 14, color: '#374151', fontWeight: 600, mb: 1.5 }}>
          {formatRangeLabel(range)}
          {data && !loading ? ` · ${cookedCount} item${cookedCount === 1 ? '' : 's'} to cook · ${stickers.length} sticker${stickers.length === 1 ? '' : 's'}` : ''}
        </Typography>
      )}
      {preset === 'custom' && !range && <Typography sx={{ color: '#6B7280', mb: 2 }}>Pick the dates and press Show.</Typography>}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        className="no-print"
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search an item, customer or order number"
        inputProps={{ 'aria-label': 'Search the report' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <IconSearch size={18} />
            </InputAdornment>
          ),
          endAdornment: searching ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Clear the search" onClick={() => setSearch('')}>
                <IconX size={16} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
        sx={{ maxWidth: 520, mb: 1.5, bgcolor: '#fff' }}
      />

      <Tabs className="no-print" value={tab} onChange={(_, v: TabId) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ borderBottom: '1px solid #E5E7EB', mb: 2 }}>
        <Tab value="prep" label={`Kitchen Prep${data ? ` (${cookedCount})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="stickers" label={`Stickers${data ? ` (${stickers.length})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="days" label="Day totals" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && data && tab === 'prep' && (
        <>
          {notSetCount > 0 && (
            <Alert className="no-print" severity="warning" sx={{ mb: 2 }}>
              {notSetCount} item{notSetCount === 1 ? ' has' : 's have'} no preparation type yet ({notSet.map((b) => b.name).join(', ')}). They are listed at the end. Set Cooked or Ready to eat in Food Items so they go to the right list.
            </Alert>
          )}
          {cookedCount === 0 && notSetCount === 0 && (
            <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? `Nothing matches “${search.trim()}”.` : 'Nothing to cook for these days.'}</Typography>
          )}
          {cooked.map((block) => (
            <PrepCard key={block.name} block={block} />
          ))}
          {notSetCount > 0 && (
            <>
              <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400E', mt: 3, mb: 1 }}>Preparation type not set yet</Typography>
              {notSet.map((block) => (
                <PrepCard key={`notset-${block.name}`} block={block} warn />
              ))}
            </>
          )}
        </>
      )}
      {!loading && data && tab === 'stickers' && <StickersTab stickers={stickers} searching={searching} />}
      {!loading && data && tab === 'days' && <DayTotalsTab days={dayBlocks} searching={searching} />}
    </Box>
  );
}
