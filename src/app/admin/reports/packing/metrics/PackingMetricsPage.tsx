'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, TextField, Typography } from '@mui/material';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { formatDayShort, formatRangeLabel, getPresetRange, validateRange, type DayRange, type WeekPreset } from '@/utils/kitchenDashboard';
import { formatPSTDateISO } from '@/utils/timezone';
import { formatDuration } from '@/utils/packingProgress';
import type { CustomerTime, PackingMetrics, RunSummary } from '@/utils/packingMetrics';

const ORANGE = '#F89C35';
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
type View = { kind: 'customers'; title: string; list: CustomerTime[]; sort: 'slow' | 'fast' | 'order' } | { kind: 'routes'; title: string; runs: RunSummary[] };

const routeSub = (r: RunSummary) => `${r.customers} customer${r.customers === 1 ? '' : 's'} · ${r.units} unit${r.units === 1 ? '' : 's'}${r.packer ? ` · ${r.packer}` : ''}${r.startedAt ? ` · ${pacificTime(r.startedAt)}${r.finishedAt ? `–${pacificTime(r.finishedAt)}` : ' · still packing'}` : ''}`;

function DetailDialog({ stack, onChange, onClose }: { stack: View[]; onChange: (next: View[]) => void; onClose: () => void }) {
  const view = stack[stack.length - 1];
  if (!view) return null;
  const back = stack.length > 1 ? () => onChange(stack.slice(0, -1)) : undefined;
  const sortedList = view.kind === 'customers' ? [...view.list].sort((a, b) => (view.sort === 'slow' ? b.ms - a.ms : view.sort === 'fast' ? a.ms - b.ms : a.openedAt.localeCompare(b.openedAt))) : [];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pb: 0.5 }}>{view.title}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {view.kind === 'customers' ? (
          <>
            <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
              {([['slow', 'Slowest first'], ['fast', 'Fastest first'], ['order', 'In packing order']] as const).map(([id, label]) => (
                <Chip key={id} label={label} clickable size="small" onClick={() => onChange([...stack.slice(0, -1), { ...view, sort: id }])} variant={view.sort === id ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(view.sort === id ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
              ))}
            </Box>
            {sortedList.length === 0 && <Typography sx={{ p: 2, color: '#9CA3AF' }}>No customers yet.</Typography>}
            {sortedList.map((c, i) => (
              <Row key={`${c.date}-${c.driver}-${c.orderIds.join('_')}-${i}`} first={i === 0} left={`${i + 1}. ${c.name}`} sub={`${formatDayShort(c.date)} · ${c.driver} · ${c.units} unit${c.units === 1 ? '' : 's'}${c.orderIds.length ? ` · ${c.orderIds.join(', ')}` : ''}${c.auto ? ' · average time (last customer)' : ''}`} right={`${c.auto ? '~' : ''}${formatDuration(c.ms)}`} />
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
                right={r.customers ? `${formatDuration(r.averageMs)} avg` : '–'}
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
  const [preset, setPreset] = useState<WeekPreset>('thisWeek');
  const [custom, setCustom] = useState<DayRange>(() => getPresetRange('lastWeek', formatPSTDateISO(new Date())));
  const [data, setData] = useState<(PackingMetrics & { from: string; to: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stack, setStack] = useState<View[]>([]);
  const startRequest = useLatestRequest();

  const range: DayRange = preset === 'custom' ? custom : getPresetRange(preset as Exclude<WeekPreset, 'custom'>, today);
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
        <Typography sx={{ fontSize: 14, color: problem ? '#B91C1C' : '#374151', fontWeight: 600, mt: 1.25 }}>{problem ?? formatRangeLabel(range)}</Typography>
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
                right={d.customers ? `${formatDuration(d.averageMs)} avg` : '–'}
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
                right={d.customers ? `${formatDuration(d.averageMs)} avg` : '–'}
                onClick={() => setStack([{ kind: 'routes', title: d.driver, runs: data.runs.filter((r) => r.driver === d.driver) }])}
              />
            ))}
          </Section>
          <DetailDialog stack={stack} onChange={setStack} onClose={() => setStack([])} />
        </>
      )}
    </Box>
  );
}
