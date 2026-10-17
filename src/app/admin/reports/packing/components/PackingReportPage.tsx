'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, Paper, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { IconClockHour4, IconColumns3, IconFileSpreadsheet, IconPlayerPlay, IconPrinter, IconRefresh, IconRoute, IconSearch, IconX } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import { addDays, formatDayShort, isDayString, pacificDayOf, shortSpiceLabel } from '@/utils/kitchenDashboard';
import { formatPSTDateISO } from '@/utils/timezone';
import { applyColumnChoice, TONE_COLORS } from '@/utils/kitchenReportSheets';
import { buildPackingSheets, PACKING_SHEET_CHOICES } from '@/utils/packingReportSheets';
import { filterPackingReport, type PackLine, type PackRoute, type PackStop, type PackTotal, type PackingReport } from '@/utils/packingReport';
import { buildReportWorkbook, downloadBlob } from '@/utils/downloadReportExcel';
import { buildReportPdf } from '@/utils/reportPdf';
import ReportColumnsDialog from '../../kitchen/components/ReportColumnsDialog';
import HeldList from './HeldList';
import { useReloadWhenStale } from '@/hooks/useReloadWhenStale';
import { updatedAtText } from '@/utils/dataFreshness';

type TabId = 'routes' | 'totals' | 'held';
type Preset = 'today' | 'tomorrow' | 'other';

interface ReportData extends PackingReport {
  roster: { fetchedAt: string | null; changedAt: string | null; drivers: number } | null;
}

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

/** On screen every row is white and only an ECO row is green (the red and white rows are kept in the Excel file and the PDF). */
const rowBg = (isEco: boolean) => (isEco ? `#${TONE_COLORS.eco}` : '#FFFFFF');
const SPICE_CHIP = { bgcolor: '#FDE7E2', color: '#A12A14' };

/** "11:32 PM" in Pacific time */
function pacificTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(d);
}

function LineRow({ line }: { line: PackLine }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.8, px: 2, borderTop: '1px solid #F3F4F6', bgcolor: rowBg(line.isEco) }}>
      <Typography sx={{ width: { xs: 40, sm: 48 }, flexShrink: 0, fontSize: 16, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', lineHeight: 1.3 }}>× {line.quantity}</Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#111827', wordBreak: 'break-word' }}>{line.name}</Typography>
        {(line.spice || line.portion || line.isEco) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.3 }}>
            {line.portion && <Typography sx={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{line.portion}</Typography>}
            {line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 22, fontSize: 12, ...SPICE_CHIP }} />}
            {line.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
          </Box>
        )}
        {line.choices.map((c) => (
          <Typography key={c} sx={{ fontSize: 12, color: '#4B5563', wordBreak: 'break-word' }}>{c}</Typography>
        ))}
        {line.pickedFor && (
          <Typography sx={{ fontSize: 12, color: '#B45309' }}>{line.madeEarlier ? `Made ${formatDayShort(line.pickedFor)} · from the fridge` : `Picked for ${formatDayShort(line.pickedFor)}`}</Typography>
        )}
      </Box>
    </Box>
  );
}

function StopCard({ stop, warn }: { stop: PackStop; warn?: boolean }) {
  const units = stop.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <Paper className="print-card" elevation={0} sx={{ border: '1px solid', borderColor: warn ? '#FCD34D' : '#E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 1.25, bgcolor: '#fff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1, bgcolor: warn ? '#FDEFC4' : '#E4EAF2', borderBottom: '1px solid #CBD5E1' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
          {/* how many units to pack, first, so it is next to the name and not at the far right */}
          {units > 0 && <Typography sx={{ width: { xs: 56, sm: 64 }, flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#374151', lineHeight: 1.7, whiteSpace: 'nowrap' }}>{units} unit{units === 1 ? '' : 's'}</Typography>}
          {stop.number > 0 && (
            <Box sx={{ minWidth: 30, height: 30, borderRadius: '50%', bgcolor: '#F89C35', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{stop.number}</Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#111827', wordBreak: 'break-word', lineHeight: 1.3 }}>{stop.customerName || 'Customer'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{stop.orderIds.join(', ')}</Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          {stop.scheduledAt && <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{stop.scheduledAt}</Typography>}
        </Box>
      </Box>
      {stop.empty ? (
        <Typography sx={{ px: 2, py: 1, fontSize: 13, color: '#B45309' }}>Nothing to pack for this date. Check the order.</Typography>
      ) : (
        stop.lines.map((line, i) => <LineRow key={`${line.orderId}-${i}`} line={line} />)
      )}
    </Paper>
  );
}

function RouteBlock({ route }: { route: PackRoute }) {
  const units = route.stops.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.quantity, 0), 0);
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1, px: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#111827', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconRoute size={18} />
          {route.title}
          {route.driverName && <Typography component="span" sx={{ fontWeight: 600, fontSize: 15, color: '#374151' }}>· {route.driverName}</Typography>}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
          {route.vehicle ? `${route.vehicle} · ` : ''}
          {route.stops.length} stop{route.stops.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}
        </Typography>
      </Box>
      {route.stops.map((stop) => (
        <StopCard key={`${route.key}-${stop.number}`} stop={stop} />
      ))}
    </Box>
  );
}

function TotalsTab({ totals, searching }: { totals: PackTotal[]; searching: boolean }) {
  if (totals.length === 0) return <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? 'No item matches your search.' : 'Nothing to deliver on this date.'}</Typography>;
  return (
    <Paper className="print-card" elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
      {totals.map((t, i) => (
        <Box key={`${t.isCombo}-${t.name}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, py: 0.8, px: 2, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', bgcolor: '#FFFFFF' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800, width: 44, flexShrink: 0, textAlign: 'right' }}>{t.quantity}</Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>
              {t.name} {t.isCombo && <Typography component="span" sx={{ fontSize: 12, color: '#6B7280' }}>(combo)</Typography>}
            </Typography>
            {(t.sizes.length > 0 || t.eco > 0) && (
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                {t.sizes.map((s) => `${s.label} × ${s.quantity}`).join(' · ')}
                {t.eco > 0 ? `${t.sizes.length > 0 ? ' · ' : ''}♻️ Eco × ${t.eco}` : ''}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

export default function PackingReportPage() {
  const { token, loading: authLoading, isAuthenticated, user } = useAuth();
  // a packer has the report and the Packing Planner; the packing times and reading routes from OptimoRoute are for admins
  const isPacker = user?.role === 'PACKER';
  const router = useRouter();
  const today = useMemo(() => pacificDayOf(new Date()) ?? formatPSTDateISO(new Date()), []);
  // after the evening the next day's routes are what the team looks at
  const startPreset = useMemo<Preset>(() => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(new Date()));
    return hour >= 18 ? 'tomorrow' : 'today';
  }, []);
  const [preset, setPreset] = useState<Preset>(startPreset);
  const [otherDate, setOtherDate] = useState(addDays(today, 2));
  const [tab, setTab] = useState<TabId>('routes');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const startRequest = useLatestRequest();

  const listCols = useColumnPreferences(PACKING_SHEET_CHOICES[0].baseKey, PACKING_SHEET_CHOICES[0].columns, PACKING_SHEET_CHOICES[0].serverTable);
  const totalCols = useColumnPreferences(PACKING_SHEET_CHOICES[1].baseKey, PACKING_SHEET_CHOICES[1].columns, PACKING_SHEET_CHOICES[1].serverTable);

  const date = preset === 'today' ? today : preset === 'tomorrow' ? addDays(today, 1) : isDayString(otherDate) ? otherDate : null;

  // `silent`: load again without covering what is on screen (used when coming back to the tab and before a download).
  // Returns the fresh report, or null when it could not be loaded.
  const load = useCallback(async (options: { silent?: boolean } = {}): Promise<ReportData | null> => {
    if (!token || !date) return null;
    const request = startRequest();
    if (!options.silent) setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/packing-report?date=${date}`, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
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
  }, [token, date, startRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  // a page left open while orders came in: load again when the admin comes back to it
  useReloadWhenStale(loadedAt, () => void load({ silent: true }), Boolean(data));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const searching = search.trim().length > 0;
  const shown = useMemo(() => (data ? filterPackingReport(data, search) : null), [data, search]);

  const refreshRoutes = async () => {
    if (!token || !date) return;
    setRefreshing(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/admin/packing-report/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) throw new Error(json.error || 'Could not read the routes from OptimoRoute');
      const report = json.data as { action?: string; routes?: number; stops?: number } | undefined;
      setNotice(report?.action === 'no_routes' ? 'OptimoRoute has no routes for this day yet.' : `Routes read from OptimoRoute: ${report?.routes ?? 0} driver(s), ${report?.stops ?? 0} stops.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the routes from OptimoRoute');
    } finally {
      setRefreshing(false);
    }
  };

  // the sheets for the Excel file and the PDF: what is on the screen, with the columns this admin chose
  const sheetsFrom = (src: ReportData) => applyColumnChoice(buildPackingSheets(filterPackingReport(src, search)), { packing: [...listCols.hiddenKeys], packTotals: [...totalCols.hiddenKeys] });

  const printPdf = async () => {
    if (!shown || !date) return;
    const win = window.open('', '_blank');
    win?.document.write('<p style="font-family:sans-serif;padding:24px">Making the PDF...</p>');
    setPrinting(true);
    try {
      // always from the latest orders, not from what was loaded when the page was opened
      const latest = await load({ silent: true });
      if (!latest) throw new Error('could not get the latest orders, so nothing was made. Try again');
      const blob = await buildReportPdf(sheetsFrom(latest), `Delivery ${formatDayShort(date)}${searching ? ` · search: ${search.trim()}` : ''}`);
      if (win) win.location.href = URL.createObjectURL(blob);
      else downloadBlob(blob, `packing-report-${date}.pdf`);
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? `Could not make the PDF: ${e.message}` : 'Could not make the PDF');
    } finally {
      setPrinting(false);
    }
  };

  const download = async () => {
    if (!shown || !date) return;
    setExporting(true);
    try {
      // always from the latest orders, not from what was loaded when the page was opened
      const latest = await load({ silent: true });
      if (!latest) throw new Error('could not get the latest orders, so nothing was made. Try again');
      downloadBlob(await buildReportWorkbook(sheetsFrom(latest), `Packing report ${date}`), `packing-report-${date}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? `Could not make the Excel file: ${e.message}` : 'Could not make the Excel file');
    } finally {
      setExporting(false);
    }
  };

  const presets: Array<{ id: Preset; label: string }> = [
    { id: 'today', label: formatDayShort(today) },
    { id: 'tomorrow', label: formatDayShort(addDays(today, 1)) },
    { id: 'other', label: 'Other date' },
  ];
  const readAt = pacificTime(data?.roster?.fetchedAt);
  const stopCount = shown ? shown.routes.reduce((n, r) => n + r.stops.length, 0) : 0;

  return (
    <Box>
      <style>{PRINT_CSS}</style>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827' }}>
            Packing Report
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
            What to pack for each delivery stop, in the order of the drivers&apos; routes. Only what is delivered on the day counts, whatever day it was cooked for.
          </Typography>
        </Box>
        <Box className="no-print" sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button component={Link} href="/admin/reports/packing/live" variant="contained" size="small" startIcon={<IconPlayerPlay size={16} />} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#F89C35', '&:hover': { bgcolor: '#E08A28' } }}>
            Packing Planner
          </Button>
          {!isPacker && <Button component={Link} href="/admin/reports/packing/metrics" variant="outlined" size="small" startIcon={<IconClockHour4 size={16} />} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Packing times
          </Button>}
          <Button variant="outlined" size="small" startIcon={<IconColumns3 size={16} />} onClick={() => setColumnsOpen(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Columns
          </Button>
          <Button variant="outlined" size="small" startIcon={<IconFileSpreadsheet size={16} />} onClick={download} disabled={!shown || loading || exporting} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {exporting ? 'Making the file...' : 'Download Excel'}
          </Button>
          <Button variant="outlined" size="small" startIcon={<IconPrinter size={16} />} onClick={printPdf} disabled={!shown || loading || printing} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {printing ? 'Making the PDF...' : 'Print (PDF)'}
          </Button>
          {!isPacker && <Tooltip title="Read the routes from OptimoRoute now">
            <span>
              <IconButton onClick={refreshRoutes} disabled={loading || refreshing || !date} aria-label="Read the routes from OptimoRoute now">
                {refreshing ? <CircularProgress size={20} /> : <IconRoute size={20} />}
              </IconButton>
            </span>
          </Tooltip>}
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {presets.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              clickable
              onClick={() => setPreset(p.id)}
              variant={preset === p.id ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600, ...(preset === p.id ? { bgcolor: '#F89C35', color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }}
            />
          ))}
          {preset === 'other' && <TextField label="Delivery date" type="date" size="small" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} InputLabelProps={{ shrink: true }} />}
        </Box>
      </Paper>

      {date && (
        <Typography sx={{ fontSize: 14, color: '#374151', fontWeight: 600, mb: 1.5 }}>
          Delivery {formatDayShort(date)}
          {data && !loading ? ` · ${data.stats.orders} order${data.stats.orders === 1 ? '' : 's'} · ${data.stats.units} unit${data.stats.units === 1 ? '' : 's'}${data.stats.eco > 0 ? ` · ♻️ ${data.stats.eco} eco` : ''}` : ''}
          {data && !loading && loadedAt ? ` · ${updatedAtText(loadedAt)}` : ''}
        </Typography>
      )}
      {preset === 'other' && !date && <Typography sx={{ color: '#B91C1C', mb: 2 }}>Pick a real date.</Typography>}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert className="no-print" severity="info" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}

      {data && !loading && (
        data.roster ? (
          <Typography className="no-print" sx={{ fontSize: 13, color: '#6B7280', mb: 1.5 }}>
            Routes from OptimoRoute{readAt ? `, read at ${readAt}` : ''} · {data.roster.drivers} driver{data.roster.drivers === 1 ? '' : 's'} · {data.stats.stops} stop{data.stats.stops === 1 ? '' : 's'}. If they changed since, press the route button to read them again.
          </Typography>
        ) : (
          <Alert className="no-print" severity="warning" sx={{ mb: 2 }}>
            There are no routes for this day yet (OptimoRoute plans them at 8 PM the evening before). Everything for the day is listed under &quot;Not on a route yet&quot; for now.
          </Alert>
        )
      )}
      {data && !loading && data.roster && data.unrouted.length > 0 && (
        <Alert className="no-print" severity="warning" sx={{ mb: 2 }}>
          {data.unrouted.length} customer{data.unrouted.length === 1 ? ' is' : 's are'} not on any route yet (an order that came in after the routes were planned). They are listed at the end.
        </Alert>
      )}

      <TextField
        className="no-print"
        size="small"
        fullWidth
        placeholder="Search customer, item, order or driver"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 1.5, bgcolor: '#fff' }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={18} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear the search" onClick={() => setSearch('')}>
                  <IconX size={16} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />

      <Tabs className="no-print" value={tab} onChange={(_, v: TabId) => setTab(v)} sx={{ borderBottom: '1px solid #E5E7EB', mb: 2 }}>
        <Tab value="routes" label={`By route${data ? ` (${stopCount + (shown?.unrouted.length ?? 0)})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="totals" label="Item totals" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab value="held" label={`Not going out today${data?.held ? ` (${shown?.held?.customers.length ?? data.held.customers.length})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && shown && tab === 'routes' && (
        <>
          {shown.routes.length === 0 && shown.unrouted.length === 0 && (
            <Typography sx={{ color: '#9CA3AF', py: 3 }}>{searching ? `Nothing matches “${search.trim()}”.` : 'Nothing to deliver on this date.'}</Typography>
          )}
          {shown.routes.map((route) => (
            <RouteBlock key={route.key} route={route} />
          ))}
          {shown.unrouted.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400E', mb: 1 }}>Not on a route yet</Typography>
              {shown.unrouted.map((stop) => (
                <StopCard key={`u-${stop.orderIds.join('-')}`} stop={stop} warn />
              ))}
            </Box>
          )}
        </>
      )}
      {!loading && shown && tab === 'totals' && <TotalsTab totals={shown.totals} searching={searching} />}
      {!loading && shown && tab === 'held' && <HeldList held={shown.held} date={shown.date} searching={searching} />}

      <ReportColumnsDialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        groups={[
          { key: 'packing', title: 'Packing List', columns: listCols.allColumns, hidden: listCols.hiddenKeys, syncStatus: listCols.syncStatus, onToggle: listCols.toggleColumn, onReset: listCols.showAll, onHideAll: listCols.hideAll },
          { key: 'packTotals', title: 'Item totals', columns: totalCols.allColumns, hidden: totalCols.hiddenKeys, syncStatus: totalCols.syncStatus, onToggle: totalCols.toggleColumn, onReset: totalCols.showAll, onHideAll: totalCols.hideAll },
        ]}
      />
    </Box>
  );
}
