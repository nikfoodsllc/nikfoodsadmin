'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, Menu, MenuItem, Paper, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { IconChevronDown, IconColumns3, IconFileSpreadsheet, IconPrinter, IconRefresh, IconSearch, IconSortAscending, IconSortDescending, IconTruckDelivery, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import { formatPSTDateISO } from '@/utils/timezone';
import {
  addDays,
  deliveryNote,
  filterBlockBySearch,
  formatDayShort,
  formatRangeLabel,
  getPresetRange,
  pacificDayOf,
  shortSpiceLabel,
  validateRange,
  type DayRange,
  type KitchenDay,
} from '@/utils/kitchenDashboard';
import {
  blockTotal,
  filterBlocksBySearch,
  filterStickersBySearch,
  DEFAULT_SORT,
  SORT_OPTIONS,
  sortBlocks,
  sortDayItems,
  sortStickers,
  type KitchenReport,
  type PrepBlock,
  type PrepLine,
  type SortChoice,
  type SortKey,
  type StickerLine,
} from '@/utils/kitchenReport';
import { buildReportWorkbook, downloadBlob } from '@/utils/downloadReportExcel';
import { buildReportPdf } from '@/utils/reportPdf';
import { applyColumnChoice, buildReportSheets, PREP_COLUMNS, STICKER_COLUMNS, TONE_COLORS, type SheetKey } from '@/utils/kitchenReportSheets';
import ReportColumnsDialog from './ReportColumnsDialog';
import { useReloadWhenStale } from '@/hooks/useReloadWhenStale';
import { updatedAtText } from '@/utils/dataFreshness';

type Preset = 'today' | 'tomorrow' | 'thisWeek' | 'custom';
type TabId = 'prep' | 'ready' | 'stickers' | 'days';

/** The three downloadable sheets: the name shown, the start of the file name, and the order in the menus. */
const SHEET_ORDER: SheetKey[] = ['prep', 'ready', 'stickers'];
const SHEET_TITLES: Record<string, string> = { prep: 'Kitchen Prep', ready: 'Ready to Eat', stickers: 'Stickers' };
const SHEET_FILES: Record<string, string> = { prep: 'kitchen-prep', ready: 'ready-to-eat', stickers: 'stickers' };
/** A sheet worth making: it has at least one row of data (a header alone is not). */
const hasRows = (sheets: Array<{ rows: Array<{ kind: string }> }>) => sheets.some((sheet) => sheet.rows.some((r) => r.kind === 'data'));

/** The range buttons. The first two show the day and the date ("Thu, Oct 8"), so there is no doubt which day they mean. */
function presetsFor(today: string): Array<{ id: Preset; label: string }> {
  return [
    { id: 'today', label: formatDayShort(today) },
    { id: 'tomorrow', label: formatDayShort(addDays(today, 1)) },
    { id: 'thisWeek', label: 'This week' },
    { id: 'custom', label: 'Custom dates' },
  ];
}

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
  .print-card, .print-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/**
 * On screen every row is white and only an ECO row is green. (The red and white rows that make a row hard to miss are kept
 * in the Excel file and the PDF only.)
 */
const rowBg = (isEco: boolean) => (isEco ? `#${TONE_COLORS.eco}` : '#FFFFFF');

/** Items are written in a soft blue so they are easy to tell apart from the customers' names (dark). */
const ITEM_COLOR = '#4F7CAC';

const SPICE_CHIP = { bgcolor: '#FDE7E2', color: '#A12A14' };

/**
 * One order line of an item card, easy to scan: who and how much first (the amount big on the right), then the size,
 * spice and ECO as small tags. Dates are only shown when they matter: the kitchen day when the report covers several
 * days, and the delivery day when it is a later day than the kitchen day. (The day the order was placed is left out.)
 */
function LineRow({ line, showKitchenDay }: { line: PrepLine; showKitchenDay: boolean }) {
  const later = line.deliveryDate !== line.day;
  const amount = line.amountText || `× ${line.quantity}`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.1, px: 2, borderTop: '1px solid #F3F4F6', bgcolor: rowBg(line.isEco) }}>
      <Typography sx={{ width: { xs: 104, sm: 126 }, flexShrink: 0, fontSize: 15, fontWeight: 800, color: '#92400E', whiteSpace: 'nowrap', lineHeight: 1.35 }}>{amount}</Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#111827', wordBreak: 'break-word', lineHeight: 1.3 }}>{line.customerName}</Typography>
        {(line.portion || line.spice || line.isEco) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            {line.portion && <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{`${line.portion} × ${line.quantity}`}</Typography>}
            {line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 22, fontSize: 12, fontWeight: 600, ...SPICE_CHIP }} />}
            {line.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
          </Box>
        )}
        {line.viaCombo && (
          <Typography sx={{ fontSize: 12.5, color: '#4B5563', mt: 0.4 }}>
            From {line.viaCombo}
            {line.viaSpice ? ` (${shortSpiceLabel(line.viaSpice)})` : ''}
          </Typography>
        )}
        {(showKitchenDay || later || line.movedFrom) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.15, mt: 0.4, fontSize: 12.5, lineHeight: 1.45 }}>
            {showKitchenDay && <Box component="span" sx={{ color: '#4B5563' }}>Cook {formatDayShort(line.day)}</Box>}
            {later && (
              <Box component="span" sx={{ color: '#B45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <IconTruckDelivery size={14} style={{ flexShrink: 0 }} />
                Delivered {formatDayShort(line.deliveryDate)}
              </Box>
            )}
            {line.movedFrom && <Box component="span" sx={{ color: '#B45309', fontWeight: 600 }}>Moved from {formatDayShort(line.movedFrom)}</Box>}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function PrepCard({ block, warn, showKitchenDay }: { block: PrepBlock; warn?: boolean; showKitchenDay: boolean }) {
  return (
    <Paper className="print-card" elevation={0} sx={{ border: '1px solid', borderColor: warn ? '#FCD34D' : '#E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 1.5, bgcolor: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.25, bgcolor: warn ? '#FDEFC4' : '#E4EAF2', borderBottom: '1px solid #CBD5E1' }}>
        {/* the item's total is on the left, in the same column as each line's amount, so the eye does not travel to the far right */}
        <Typography sx={{ minWidth: { xs: 104, sm: 126 }, flexShrink: 0, fontWeight: 800, fontSize: block.totalText ? 16 : 20, color: '#92400E', lineHeight: 1.25 }}>{blockTotal(block)}</Typography>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: ITEM_COLOR, wordBreak: 'break-word', lineHeight: 1.3 }}>{block.name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
            {block.quantity} unit{block.quantity === 1 ? '' : 's'} · {block.lines.length} order{block.lines.length === 1 ? '' : 's'}
            {block.unsized > 0 && block.totalText ? ` · ${block.unsized} without a size` : ''}
          </Typography>
          {block.eco > 0 && <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#126B2C' }}>♻️ Eco × {block.eco}</Typography>}
        </Box>
      </Box>
      <Box>
        {block.lines.map((line, i) => (
          <LineRow key={`${line.orderId}-${i}`} line={line} showKitchenDay={showKitchenDay} />
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
          <Box sx={{ px: 2, py: 1, bgcolor: '#E4EAF2', borderBottom: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Delivery {formatDayShort(day)}</Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{list.length} sticker{list.length === 1 ? '' : 's'}</Typography>
          </Box>
          <Box>
            {list.map((s, i) => (
              <Box key={`${s.orderId}-${i}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 0.9, px: 2, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', bgcolor: rowBg(s.isEco) }}>
                <Typography sx={{ width: { xs: 74, sm: 96 }, flexShrink: 0, fontSize: 15, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', lineHeight: 1.35 }}>{s.portion ? `${s.portion} × ${s.quantity}` : `× ${s.quantity}`}</Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: ITEM_COLOR, wordBreak: 'break-word', lineHeight: 1.3 }}>{s.item}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>{s.customerName}</Typography>
                  {(s.spice || s.isEco) && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.4 }}>
                      {s.spice && <Chip size="small" label={shortSpiceLabel(s.spice)} sx={{ height: 22, fontSize: 12, fontWeight: 600, ...SPICE_CHIP }} />}
                      {s.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
                    </Box>
                  )}
                  {s.viaCombo && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>with {s.viaCombo}</Typography>}
                  {s.movedFrom && <Typography sx={{ fontSize: 12, color: '#B45309' }}>Moved from {formatDayShort(s.movedFrom)}</Typography>}
                  {s.day !== s.deliveryDate && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.4, fontSize: 12.5, fontWeight: 700, color: '#B45309' }}>
                      <IconTruckDelivery size={14} style={{ flexShrink: 0 }} />
                      Picked for {formatDayShort(s.day)}
                    </Box>
                  )}
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
          <Box sx={{ px: 2, py: 1, bgcolor: '#E4EAF2', borderBottom: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
              {day.weekday} <Typography component="span" sx={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{formatDayShort(day.day)}</Typography>
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{day.totals.units} units · {day.totals.orders} orders</Typography>
          </Box>
          <Box>
            {day.items.map((item, i) => {
              const note = deliveryNote(item.deliveries, item.quantity);
              return (
                <Box key={item.name} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, py: 0.8, px: 2, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', bgcolor: '#FFFFFF' }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 800, width: 44, flexShrink: 0, textAlign: 'right' }}>{item.quantity}</Typography>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: ITEM_COLOR, wordBreak: 'break-word' }}>{item.name}</Typography>
                    {note && <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>{note}</Typography>}
                  </Box>
                  {item.totalText && <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#92400E', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.totalText}</Typography>}
                </Box>
              );
            })}
            {day.combos.map((combo) => (
              <Box key={combo.name} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, py: 0.8, px: 2, borderTop: '1px solid #F3F4F6', bgcolor: '#FFFFFF' }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800, width: 44, flexShrink: 0, textAlign: 'right' }}>{combo.quantity}</Typography>
                <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: ITEM_COLOR, wordBreak: 'break-word' }}>{combo.name} <Typography component="span" sx={{ fontSize: 12, color: '#6B7280' }}>(combo)</Typography></Typography>
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
  // today in Pacific time, whatever time zone this browser is in
  const today = useMemo(() => pacificDayOf(new Date()) ?? formatPSTDateISO(new Date()), []);
  const presets = useMemo(() => presetsFor(today), [today]);
  const [preset, setPreset] = useState<Preset>('tomorrow');
  const [custom, setCustom] = useState<DayRange>({ startDate: today, endDate: addDays(today, 1) });
  const [customApplied, setCustomApplied] = useState<DayRange | null>(null);
  const [tab, setTab] = useState<TabId>('prep');
  // search: an item, a customer, an order number or a combo
  const [search, setSearch] = useState('');
  // how every sheet is ordered (the screen, the Excel file and the PDF)
  const [sort, setSort] = useState<SortChoice>(DEFAULT_SORT);
  const [exporting, setExporting] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  // which columns go into the Excel file and the PDF, per sheet (saved in the admin's account)
  const prepCols = useColumnPreferences('admin_kitchen_report_prep_columns', PREP_COLUMNS, 'kitchen-report-prep');
  const readyCols = useColumnPreferences('admin_kitchen_report_ready_columns', PREP_COLUMNS, 'kitchen-report-ready');
  const stickerCols = useColumnPreferences('admin_kitchen_report_stickers_columns', STICKER_COLUMNS, 'kitchen-report-stickers');
  // the three Excel files and the three PDFs: one menu each (which sheet to make)
  const [fileMenu, setFileMenu] = useState<{ anchor: HTMLElement; kind: 'excel' | 'pdf' } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const startRequest = useLatestRequest();

  const range = useMemo<DayRange | null>(() => {
    if (preset === 'today') return { startDate: today, endDate: today };
    if (preset === 'tomorrow') return { startDate: addDays(today, 1), endDate: addDays(today, 1) };
    if (preset === 'thisWeek') return getPresetRange('thisWeek', today);
    return customApplied;
  }, [preset, today, customApplied]);

  // `silent`: load again without covering what is on screen (used when coming back to the tab and before a download).
  // Returns the fresh report, or null when it could not be loaded.
  const load = useCallback(async (options: { silent?: boolean } = {}): Promise<ReportData | null> => {
    if (!token || !range) return null;
    const request = startRequest();
    if (!options.silent) setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/kitchen-report?startDate=${range.startDate}&endDate=${range.endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: request.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return null;
      if (!response.ok) throw new Error(json.error || 'Could not load the report');
      const fresh = json.data as ReportData;
      setData(fresh);
      setLoadedAt(new Date());
      return fresh;
    } catch (e) {
      if (!request.isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return null;
      if (!options.silent) setData(null);
      setError(e instanceof Error ? e.message : 'Could not load the report');
      return null;
    } finally {
      if (request.isCurrent() && !options.silent) setLoading(false);
    }
  }, [token, range, startRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  // a page left open while orders came in: load again when the admin comes back to it
  useReloadWhenStale(loadedAt, () => void load({ silent: true }), Boolean(data));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const searching = search.trim().length > 0;
  const sortDay = (d: KitchenDay): KitchenDay => ({ ...d, items: sortDayItems(d.items, sort), combos: sortDayItems(d.combos, sort) });
  const cooked = useMemo(() => (data ? sortBlocks(filterBlocksBySearch(data.cooked, search), sort) : []), [data, search, sort]);
  const notSet = useMemo(() => (data ? sortBlocks(filterBlocksBySearch(data.notSet, search), sort) : []), [data, search, sort]);
  const readyToEat = useMemo(() => (data ? sortBlocks(filterBlocksBySearch(data.readyToEat, search), sort) : []), [data, search, sort]);
  const stickers = useMemo(() => (data ? sortStickers(filterStickersBySearch(data.stickers, search), sort) : []), [data, search, sort]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dayBlocks = useMemo(() => (data ? data.days.map((d) => sortDay(searching ? filterBlockBySearch(d, search) : d)) : []), [data, search, searching, sort]);
  // the kitchen day is only written on each line when the report covers more than one kitchen day
  const multiDay = useMemo(() => {
    const days = new Set<string>();
    for (const b of [...(data?.cooked ?? []), ...(data?.readyToEat ?? []), ...(data?.notSet ?? [])]) for (const l of b.lines) days.add(l.day);
    return days.size > 1;
  }, [data]);
  const cookedCount = cooked.length;
  const notSetCount = notSet.length;
  const readyCount = readyToEat.length + notSetCount;

  // the one sheet for an Excel file or a PDF, with only the columns this admin chose, from the report it is made from
  const sheetsFrom = (src: ReportData, only: SheetKey) =>
    applyColumnChoice(
      buildReportSheets({
        cooked: sortBlocks(filterBlocksBySearch(src.cooked, search), sort),
        readyToEat: sortBlocks(filterBlocksBySearch(src.readyToEat, search), sort),
        notSet: sortBlocks(filterBlocksBySearch(src.notSet, search), sort),
        stickers: sortStickers(filterStickersBySearch(src.stickers, search), sort),
      }).filter((sheet) => sheet.key === only),
      {
        prep: [...prepCols.hiddenKeys],
        ready: [...readyCols.hiddenKeys],
        stickers: [...stickerCols.hiddenKeys],
      }
    );

  if (authLoading || !isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  const customProblem = preset === 'custom' ? validateRange(custom) : null;

  // Print: the PDF version of the Excel file, opened in a new tab (print or save it from there)
  const printPdf = async (only: SheetKey) => {
    if (!data || !range) return;
    const label = range.startDate === range.endDate ? range.startDate : `${range.startDate}_to_${range.endDate}`;
    // the tab is opened right now, while the click still counts, and filled when the PDF is ready
    const tab = window.open('', '_blank');
    tab?.document.write('<p style="font-family:sans-serif;padding:24px">Making the PDF...</p>');
    setPrinting(true);
    try {
      // always from the latest orders, not from what was loaded when the page was opened
      const latest = await load({ silent: true });
      if (!latest) throw new Error('could not get the latest orders, so nothing was made. Try again');
      const sheets = sheetsFrom(latest, only);
      if (!hasRows(sheets)) throw new Error(`there is nothing in ${SHEET_TITLES[only]} for these days`);
      const title = `${SHEET_TITLES[only]} · ${formatRangeLabel(range)}${searching ? ` · search: ${search.trim()}` : ''}`;
      const blob = await buildReportPdf(sheets, title, { orientation: 'portrait', boxPerPage: true });
      if (tab) tab.location.href = URL.createObjectURL(blob);
      else downloadBlob(blob, `${SHEET_FILES[only]}-${label}.pdf`); // the browser blocked the new tab: save the file instead
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? `Could not make the PDF: ${e.message}` : 'Could not make the PDF');
    } finally {
      setPrinting(false);
    }
  };

  const download = async (only: SheetKey) => {
    if (!data || !range) return;
    const label = range.startDate === range.endDate ? range.startDate : `${range.startDate}_to_${range.endDate}`;
    setExporting(true);
    try {
      // always from the latest orders, not from what was loaded when the page was opened
      const latest = await load({ silent: true });
      if (!latest) throw new Error('could not get the latest orders, so nothing was made. Try again');
      // the file has just this sheet and follows the search, like the screen
      const sheets = sheetsFrom(latest, only);
      if (!hasRows(sheets)) throw new Error(`there is nothing in ${SHEET_TITLES[only]} for these days`);
      const blob = await buildReportWorkbook(sheets, `${SHEET_TITLES[only]} ${label}`);
      downloadBlob(blob, `${SHEET_FILES[only]}-${label}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? `Could not make the Excel file: ${e.message}` : 'Could not make the Excel file');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box>
      <style>{PRINT_CSS}</style>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
            Kitchen Report
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
            What to cook and what to pack for each menu day. Paid orders only; cancelled and refunded orders are left out.
          </Typography>
          <Typography variant="body2" sx={{ color: '#374151', fontWeight: 600, mt: 0.5 }}>
            Amounts are in ounces (oz) and pounds (lb): 16 oz = 1 lb. Items without a size are counted in units.
          </Typography>
        </Box>
        <Box className="no-print" sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<IconColumns3 size={16} />} onClick={() => setColumnsOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Columns
          </Button>
          <Button variant="outlined" size="small" startIcon={<IconFileSpreadsheet size={16} />} endIcon={<IconChevronDown size={14} />} onClick={(e) => setFileMenu({ anchor: e.currentTarget, kind: 'excel' })} disabled={!data || loading || exporting} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {exporting ? 'Making the file...' : 'Download Excel'}
          </Button>
          <Button variant="outlined" size="small" startIcon={<IconPrinter size={16} />} endIcon={<IconChevronDown size={14} />} onClick={(e) => setFileMenu({ anchor: e.currentTarget, kind: 'pdf' })} disabled={!data || loading || printing} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {printing ? 'Making the PDF...' : 'Print (PDF)'}
          </Button>
          <Menu anchorEl={fileMenu?.anchor} open={!!fileMenu} onClose={() => setFileMenu(null)}>
            {SHEET_ORDER.map((key) => (
              <MenuItem
                key={key}
                onClick={() => {
                  const kind = fileMenu?.kind;
                  setFileMenu(null);
                  if (kind === 'excel') void download(key);
                  else void printPdf(key);
                }}
              >
                {SHEET_TITLES[key]}
              </MenuItem>
            ))}
          </Menu>
          <Tooltip title="Reload">
            <span>
              <IconButton onClick={() => void load()} disabled={loading} aria-label="Reload the report">
                <IconRefresh size={20} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Paper className="no-print" elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: preset === 'custom' ? 1.5 : 0 }}>
          {presets.map((p) => (
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
          {data && !loading && loadedAt ? ` · ${updatedAtText(loadedAt)}` : ''}
        </Typography>
      )}
      {preset === 'custom' && !range && <Typography sx={{ color: '#6B7280', mb: 2 }}>Pick the dates and press Show.</Typography>}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box className="no-print" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
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
        sx={{ flex: '1 1 260px', maxWidth: 520, bgcolor: '#fff' }}
      />
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <TextField
            select
            size="small"
            label="Sort by"
            value={sort.key}
            onChange={(e) => setSort((c) => ({ ...c, key: e.target.value as SortKey }))}
            sx={{ minWidth: 160, bgcolor: '#fff' }}
            inputProps={{ 'aria-label': 'Sort the report by' }}
          >
            {SORT_OPTIONS.map((o) => (
              <MenuItem key={o.key} value={o.key}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Tooltip title={sort.dir === 'asc' ? 'Smallest / A to Z first (tap to reverse)' : 'Largest / Z to A first (tap to reverse)'}>
            <span>
              <IconButton aria-label={sort.dir === 'asc' ? 'Sorted ascending, tap to reverse' : 'Sorted descending, tap to reverse'} disabled={sort.key === 'default'} onClick={() => setSort((c) => ({ ...c, dir: c.dir === 'asc' ? 'desc' : 'asc' }))}>
                {sort.dir === 'asc' ? <IconSortAscending size={20} /> : <IconSortDescending size={20} />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Tabs className="no-print" value={tab} onChange={(_, v: TabId) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ borderBottom: '1px solid #E5E7EB', mb: 2 }}>
        <Tab value="prep" label={`Kitchen Prep${data ? ` (${cookedCount})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="ready" label={`Ready to Eat${data ? ` (${readyCount})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
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
          {cookedCount === 0 && (
            <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? `Nothing matches “${search.trim()}”.` : 'Nothing to cook for these days.'}</Typography>
          )}
          {cooked.map((block) => (
            <PrepCard key={block.name} block={block} showKitchenDay={multiDay} />
          ))}
        </>
      )}
      {!loading && data && tab === 'ready' && (
        <>
          {notSetCount > 0 && (
            <Alert className="no-print" severity="warning" sx={{ mb: 2 }}>
              {notSetCount} item{notSetCount === 1 ? ' has' : 's have'} no preparation type yet ({notSet.map((b) => b.name).join(', ')}). They are listed at the end. Set Cooked or Ready to eat in Food Items.
            </Alert>
          )}
          {readyCount === 0 && (
            <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? `Nothing matches “${search.trim()}”.` : 'No ready-to-eat items for these days.'}</Typography>
          )}
          {readyToEat.map((block) => (
            <PrepCard key={`ready-${block.name}`} block={block} showKitchenDay={multiDay} />
          ))}
          {notSetCount > 0 && (
            <>
              <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400E', mt: 3, mb: 1 }}>Preparation type not set yet</Typography>
              {notSet.map((block) => (
                <PrepCard key={`notset-${block.name}`} block={block} warn showKitchenDay={multiDay} />
              ))}
            </>
          )}
        </>
      )}
      {!loading && data && tab === 'stickers' && <StickersTab stickers={stickers} searching={searching} />}
      {!loading && data && tab === 'days' && <DayTotalsTab days={dayBlocks} searching={searching} />}
      <ReportColumnsDialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        groups={[
          { key: 'prep', title: 'Kitchen Prep', columns: prepCols.allColumns, hidden: prepCols.hiddenKeys, syncStatus: prepCols.syncStatus, onToggle: prepCols.toggleColumn, onReset: prepCols.showAll, onHideAll: prepCols.hideAll },
          { key: 'ready', title: 'Ready to Eat', columns: readyCols.allColumns, hidden: readyCols.hiddenKeys, syncStatus: readyCols.syncStatus, onToggle: readyCols.toggleColumn, onReset: readyCols.showAll, onHideAll: readyCols.hideAll },
          { key: 'stickers', title: 'Stickers', columns: stickerCols.allColumns, hidden: stickerCols.hiddenKeys, syncStatus: stickerCols.syncStatus, onToggle: stickerCols.toggleColumn, onReset: stickerCols.showAll, onHideAll: stickerCols.hideAll },
        ]}
      />
    </Box>
  );
}
