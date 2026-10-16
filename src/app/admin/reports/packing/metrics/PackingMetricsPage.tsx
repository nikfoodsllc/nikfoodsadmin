'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, TextField, Typography } from '@mui/material';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { addDays, formatDayShort, formatRangeLabel, getPresetRange, validateRange, type DayRange, type WeekPreset } from '@/utils/kitchenDashboard';
import { formatPSTDateISO } from '@/utils/timezone';
import { formatDuration } from '@/utils/packingProgress';
import type { CustomerTime, PackingMetrics, RunSummary } from '@/utils/packingMetrics';

const ORANGE = '#F89C35';
type Preset = WeekPreset | 'today' | 'yesterday' | 'dayBefore';
const DAY_PRESETS: Array<{ id: 'today' | 'yesterday' | 'dayBefore'; label: string; back: number }> = [
  { id: 'today', label: 'Today', back: 0 },
  { id: 'yesterday', label: 'Yesterday', back: 1 },
  { id: 'dayBefore', label: 'Day before', back: 2 },
];
const PRESETS: Array<{ id: WeekPreset; label: string }> = [
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'weekBeforeLast', label: 'Week before last' },
  { id: 'custom', label: 'Custom dates' },
];

const pacificTime = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '');

/** A tile you can tap to see what is behind the number. */
function Tile({ label, value, hint, onClick }: { label: string; value: string; hint?: string; onClick?: () => void }) {
  return (
    <Paper
      elevation={0}
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) } : {})}
      sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, minWidth: 0, ...(onClick ? { cursor: 'pointer', '&:hover': { borderColor: ORANGE, bgcolor: '#FFFBF2' }, '&:focus-visible': { outline: '2px solid #F5C77E' } } : {}) }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6B7280', lineHeight: 1.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: '#6B7280', lineHeight: 1.3 }}>{hint}</Typography>}
    </Paper>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', mb: 0.75 }}>{title}</Typography>
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
        {children}
      </Paper>
    </Box>
  );
}

function Row({ left, sub, right, first, onClick }: { left: string; sub: string; right: string; first: boolean; onClick?: () => void }) {
  return (
    <Box
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) } : {})}
      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderTop: first ? 'none' : '1px solid #F3F4F6', ...(onClick ? { cursor: 'pointer', '&:hover': { bgcolor: '#FFF8EC' }, '&:focus-visible': { outline: '2px solid #F5C77E', outlineOffset: -2 } } : {}) }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{left}</Typography>
        <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{sub}</Typography>
      </Box>
      <Typography sx={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{right}</Typography>
    </Box>
  );
}

/** What the tap opened: a list of customers or a list of routes, one level deep from a route into its customers. */
type View = { kind: 'customers'; title: string; list: CustomerTime[]; sort: 'slow' | 'fast' | 'order' } | { kind: 'routes'; title: string; runs: RunSummary[] } | { kind: 'order'; title: string; customer: CustomerTime };

const routeSub = (r: RunSummary) => `${r.customers} customer${r.customers === 1 ? '' : 's'} · ${r.units} unit${r.units === 1 ? '' : 's'}${r.packer ? ` · ${r.packer}` : ''}${r.startedAt ? ` · ${pacificTime(r.startedAt)}${r.finishedAt ? `–${pacificTime(r.finishedAt)}` : ' · still packing'}` : ''}`;

interface OrderLineItem {
  name: string;
  quantity: number;
  portion: string;
  spice: string;
  eco: boolean;
  notes: string;
  choices: string[];
}

/** What one packed customer had in their order for that delivery day, next to the time it took. */
function CustomerOrder({ customer, token }: { customer: CustomerTime; token: string | null }) {
  const [orders, setOrders] = useState<Array<{ orderId: string; items: OrderLineItem[] }> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token || customer.orderIds.length === 0) return;
    const controller = new AbortController();
    fetch(`/api/admin/packing-metrics/order?date=${customer.date}&orderIds=${encodeURIComponent(customer.orderIds.join(','))}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || 'Could not load the order');
        setOrders(json.data.orders);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'Could not load the order');
      });
    return () => controller.abort();
  }, [customer, token]);
  return (
    <Box>
      <Box sx={{ px: 2, py: 1.25, bgcolor: '#FFFBF2', borderBottom: '1px solid #F3F4F6' }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {customer.auto ? '~' : ''}
          {formatDuration(customer.ms)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
          {formatDayShort(customer.date)} · {customer.driver} · {customer.units} unit{customer.units === 1 ? '' : 's'} · {customer.lines} line{customer.lines === 1 ? '' : 's'}
          {customer.auto ? ' · average time (last customer)' : ''}
        </Typography>
      </Box>
      {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}
      {!error && !orders && customer.orderIds.length > 0 && (
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={22} />
        </Box>
      )}
      {customer.orderIds.length === 0 && <Typography sx={{ p: 2, color: '#9CA3AF' }}>No order is saved for this stop.</Typography>}
      {orders?.map((o) => (
        <Box key={o.orderId}>
          <Typography sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{o.orderId}</Typography>
          {o.items.length === 0 && <Typography sx={{ px: 2, pb: 1.5, color: '#9CA3AF', fontSize: 14 }}>Nothing for this day.</Typography>}
          {o.items.map((it, i) => (
            <Box key={`${o.orderId}-${i}`} sx={{ display: 'flex', gap: 1.5, px: 2, py: 0.9, borderTop: '1px solid #F3F4F6' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>{it.quantity}×</Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{it.name}</Typography>
                {[it.portion, it.spice, it.eco ? 'Eco' : ''].filter(Boolean).length > 0 && (
                  <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{[it.portion, it.spice, it.eco ? 'Eco' : ''].filter(Boolean).join(' · ')}</Typography>
                )}
                {it.choices.map((c) => (
                  <Typography key={c} sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{c}</Typography>
                ))}
                {it.notes && <Typography sx={{ fontSize: 12, color: '#B45309', wordBreak: 'break-word' }}>Note: {it.notes}</Typography>}
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function DetailDialog({ stack, onChange, onClose, token }: { stack: View[]; onChange: (next: View[]) => void; onClose: () => void; token: string | null }) {
  const view = stack[stack.length - 1];
  if (!view) return null;
  const back = stack.length > 1 ? () => onChange(stack.slice(0, -1)) : undefined;
  const sortedList = view.kind === 'customers' ? [...view.list].sort((a, b) => (view.sort === 'slow' ? b.ms - a.ms : view.sort === 'fast' ? a.ms - b.ms : a.openedAt.localeCompare(b.openedAt))) : [];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pb: 0.5 }}>{view.title}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {view.kind === 'order' ? (
          <CustomerOrder customer={view.customer} token={token} />
        ) : view.kind === 'customers' ? (
          <>
            <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
              {([['slow', 'Slowest first'], ['fast', 'Fastest first'], ['order', 'In packing order']] as const).map(([id, label]) => (
                <Chip key={id} label={label} clickable size="small" onClick={() => onChange([...stack.slice(0, -1), { ...view, sort: id }])} variant={view.sort === id ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(view.sort === id ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
              ))}
            </Box>
            {sortedList.length === 0 && <Typography sx={{ p: 2, color: '#9CA3AF' }}>No customers yet.</Typography>}
            {sortedList.map((c, i) => (
              <Row key={`${c.date}-${c.driver}-${c.orderIds.join('_')}-${i}`} first={i === 0} left={`${i + 1}. ${c.name}`} sub={`${formatDayShort(c.date)} · ${c.driver} · ${c.units} unit${c.units === 1 ? '' : 's'}${c.orderIds.length ? ` · ${c.orderIds.join(', ')}` : ''}${c.auto ? ' · average time (last customer)' : ''}`} right={`${c.auto ? '~' : ''}${formatDuration(c.ms)}`} onClick={() => onChange([...stack, { kind: 'order', title: c.name, customer: c }])} />
            ))}
          </>
        ) : (
          <>
            {view.runs.length === 0 && <Typography sx={{ p: 2, color: '#9CA3AF' }}>No routes.</Typography>}
            {view.runs.map((r, i) => (
              <Row
                key={`${r.date}-${r.routeKey}`}
                first={i === 0}
                left={`${formatDayShort(r.date)} · ${r.driver}`}
                sub={routeSub(r)}
                right={r.finishedAt ? `${formatDuration(r.routeMs)} total` : r.startedAt ? 'Packing…' : '–'}
                onClick={() => onChange([...stack, { kind: 'customers', title: `${r.driver} · ${formatDayShort(r.date)}`, list: r.list, sort: 'order' }])}
              />
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {back && (
          <Button onClick={back} sx={{ textTransform: 'none', mr: 'auto' }}>
            Back
          </Button>
        )}
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PackingMetricsPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const today = useMemo(() => formatPSTDateISO(new Date()), []);
  const [preset, setPreset] = useState<Preset>('thisWeek');
  const [custom, setCustom] = useState<DayRange>(() => getPresetRange('lastWeek', formatPSTDateISO(new Date())));
  const [data, setData] = useState<(PackingMetrics & { from: string; to: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stack, setStack] = useState<View[]>([]);
  const startRequest = useLatestRequest();

  const dayPreset = DAY_PRESETS.find((d) => d.id === preset);
  const range: DayRange = dayPreset
    ? { startDate: addDays(today, -dayPreset.back), endDate: addDays(today, -dayPreset.back) }
    : preset === 'custom' ? custom : getPresetRange(preset as Exclude<WeekPreset, 'custom'>, today);
  const problem = preset === 'custom' ? validateRange(custom) : null;

  const load = useCallback(async () => {
    if (!token || problem) return;
    const request = startRequest();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/packing-metrics?from=${range.startDate}&to=${range.endDate}`, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
      const json = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok) throw new Error(json.error || 'Could not load the packing times');
      setData(json.data);
    } catch (e) {
      if (!request.isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return;
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load the packing times');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [token, range.startDate, range.endDate, problem, startRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const empty = data && data.routesStarted === 0;

  return (
    <Box>
      <Button component={Link} href="/admin/reports/packing" size="small" startIcon={<IconArrowLeft size={16} />} sx={{ textTransform: 'none', fontWeight: 600, ml: -1, mb: 1 }}>
        Packing Report
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827', mb: 0.5 }}>
        Packing times
      </Typography>
      <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
        How long packing took, from the Packing Planner. Days are delivery dates. Tap a number to see what is behind it.
      </Typography>

      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {DAY_PRESETS.map((d) => {
            const day = addDays(today, -d.back);
            return (
              <Chip key={d.id} label={`${d.label} · ${formatDayShort(day)}`} clickable onClick={() => setPreset(d.id)} variant={preset === d.id ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(preset === d.id ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
            );
          })}
          {PRESETS.map((p) => (
            <Chip key={p.id} label={p.label} clickable onClick={() => setPreset(p.id)} variant={preset === p.id ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(preset === p.id ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
          ))}
        </Box>
        {preset === 'custom' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
            <TextField label="From" type="date" size="small" value={custom.startDate} onChange={(e) => setCustom({ ...custom, startDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" size="small" value={custom.endDate} onChange={(e) => setCustom({ ...custom, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Box>
        )}
        <Typography sx={{ fontSize: 14, color: problem ? '#B91C1C' : '#374151', fontWeight: 600, mt: 1.25 }}>{problem ?? (range.startDate === range.endDate ? `${formatDayShort(range.startDate)}, ${range.startDate.slice(0, 4)}` : formatRangeLabel(range))}</Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && !problem && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && empty && <Typography sx={{ color: '#9CA3AF', py: 3 }}>No packing was timed in these days. Times come from the Packing Planner (Start packing, then Next customer).</Typography>}

      {!loading && data && !empty && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.25, mb: 2.5 }}>
            <Tile label="Customers packed" value={String(data.customersPacked)} hint={`${data.units} unit${data.units === 1 ? '' : 's'}`} onClick={() => setStack([{ kind: 'customers', title: 'All customers', list: data.runs.flatMap((r) => r.list), sort: 'order' }])} />
            <Tile label="Average per customer" value={data.customersPacked ? formatDuration(data.averageMs) : '–'} onClick={() => setStack([{ kind: 'customers', title: 'Time per customer', list: data.runs.flatMap((r) => r.list), sort: 'slow' }])} />
            <Tile label="Customers per hour" value={data.customersPerHour ? String(data.customersPerHour) : '–'} onClick={() => setStack([{ kind: 'routes', title: 'All routes', runs: data.runs }])} />
            <Tile label="Average route time" value={data.routesFinished ? formatDuration(Math.round(data.routeMs / data.routesFinished)) : '–'} hint={`${data.routesFinished} route${data.routesFinished === 1 ? '' : 's'} done${data.routesInProgress ? ` · ${data.routesInProgress} still packing` : ''}`} onClick={() => setStack([{ kind: 'routes', title: 'All routes', runs: data.runs }])} />
          </Box>

          <Section title="By day">
            {[...data.days].sort((x, y) => y.date.localeCompare(x.date)).map((d, i) => (
              <Row
                key={d.date}
                first={i === 0}
                left={formatDayShort(d.date)}
                sub={`${d.routes} route${d.routes === 1 ? '' : 's'} · ${d.customers} customers`}
                right={d.routeMs ? `${formatDuration(d.routeMs)} total` : '–'}
                onClick={() => setStack([{ kind: 'routes', title: formatDayShort(d.date), runs: data.runs.filter((r) => r.date === d.date) }])}
              />
            ))}
          </Section>
          <Section title="By driver">
            {data.drivers.map((d, i) => (
              <Row
                key={d.driver}
                first={i === 0}
                left={d.driver}
                sub={`${d.routes} route${d.routes === 1 ? '' : 's'} · ${d.customers} customers`}
                right={d.routeMs ? `${formatDuration(d.routeMs)} total` : '–'}
                onClick={() => setStack([{ kind: 'routes', title: d.driver, runs: data.runs.filter((r) => r.driver === d.driver) }])}
              />
            ))}
          </Section>
          <DetailDialog stack={stack} onChange={setStack} onClose={() => setStack([])} token={token} />
        </>
      )}
    </Box>
  );
}
