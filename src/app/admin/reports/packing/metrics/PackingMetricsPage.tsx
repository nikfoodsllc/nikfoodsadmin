'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { formatDayShort, formatRangeLabel, getPresetRange, validateRange, type DayRange, type WeekPreset } from '@/utils/kitchenDashboard';
import { formatPSTDateISO } from '@/utils/timezone';
import { formatDuration } from '@/utils/packingProgress';
import type { CustomerTime, PackingMetrics } from '@/utils/packingMetrics';

const ORANGE = '#F89C35';
const PRESETS: Array<{ id: WeekPreset; label: string }> = [
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'weekBeforeLast', label: 'Week before last' },
  { id: 'custom', label: 'Custom dates' },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, minWidth: 0 }}>
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

function Row({ left, sub, right, first }: { left: string; sub: string; right: string; first: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderTop: first ? 'none' : '1px solid #F3F4F6' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{left}</Typography>
        <Typography sx={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-word' }}>{sub}</Typography>
      </Box>
      <Typography sx={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{right}</Typography>
    </Box>
  );
}

const customerLine = (c: CustomerTime) => `${formatDayShort(c.date)} · ${c.driver} · ${c.units} unit${c.units === 1 ? '' : 's'}`;

export default function PackingMetricsPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const today = useMemo(() => formatPSTDateISO(new Date()), []);
  const [preset, setPreset] = useState<WeekPreset>('thisWeek');
  const [custom, setCustom] = useState<DayRange>(() => getPresetRange('lastWeek', formatPSTDateISO(new Date())));
  const [data, setData] = useState<(PackingMetrics & { from: string; to: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(true);
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
        How long packing took, from Pack live. Days are delivery dates.
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
      {!loading && empty && <Typography sx={{ color: '#9CA3AF', py: 3 }}>No packing was timed in these days. Times come from Pack live (Start packing, Next customer, Finish packing).</Typography>}

      {!loading && data && !empty && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.25, mb: 1 }}>
            <Tile label="Customers packed" value={String(data.customersPacked)} hint={`${data.units} unit${data.units === 1 ? '' : 's'}`} />
            <Tile label="Average per customer" value={data.customersPacked ? formatDuration(data.averageMs) : '–'} hint={data.customersPacked ? `middle value ${formatDuration(data.medianMs)}` : undefined} />
            <Tile label="Per unit" value={data.secondsPerUnit ? `${data.secondsPerUnit} sec` : '–'} hint="time on a customer ÷ items" />
            <Tile label="Customers per hour" value={data.customersPerHour ? String(data.customersPerHour) : '–'} hint="while packing a customer" />
            <Tile label="Time on customers" value={formatDuration(data.customerMs)} />
            <Tile label="Route clock" value={data.routesFinished ? formatDuration(data.routeMs) : '–'} hint="Start to Finish, finished routes" />
            <Tile label="Between customers" value={data.routesFinished ? formatDuration(data.betweenMs) : '–'} hint="breaks, waiting, walking" />
            <Tile label="Routes" value={`${data.routesFinished} done`} hint={data.routesInProgress ? `${data.routesInProgress} still packing` : undefined} />
          </Box>
          {data.customersSkipped > 0 && (
            <Typography sx={{ fontSize: 13, color: '#B45309', mb: 2 }}>
              {data.customersSkipped} customer{data.customersSkipped === 1 ? ' was' : 's were'} moved past with items not ticked. They are left out of the averages.
            </Typography>
          )}

          <Box sx={{ mt: 2 }}>
            <Section title="By day">
              {data.days.map((d, i) => (
                <Row key={d.date} first={i === 0} left={formatDayShort(d.date)} sub={`${d.routes} route${d.routes === 1 ? '' : 's'} · ${d.customers} customers · ${d.units} units${d.routeMs ? ` · clock ${formatDuration(d.routeMs)}` : ''}`} right={d.customers ? `${formatDuration(d.averageMs)} avg` : '–'} />
              ))}
            </Section>
            <Section title="By driver">
              {data.drivers.map((d, i) => (
                <Row key={d.driver} first={i === 0} left={d.driver} sub={`${d.routes} route${d.routes === 1 ? '' : 's'} · ${d.customers} customers · ${d.units} units${d.routeMs ? ` · clock ${formatDuration(d.routeMs)}` : ''}`} right={d.customers ? `${formatDuration(d.averageMs)} avg` : '–'} />
              ))}
            </Section>
            {data.packers.length > 0 && (
              <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 2.5 }}>
                Routes started by: {data.packers.map((p) => `${p.name} (${p.routes})`).join(', ')}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Chip label="Slowest customers" clickable onClick={() => setSlow(true)} variant={slow ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(slow ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
              <Chip label="Fastest customers" clickable onClick={() => setSlow(false)} variant={!slow ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(!slow ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
            </Box>
            <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
              {(slow ? data.slowest : data.fastest).map((c, i) => (
                <Row key={`${c.date}-${c.driver}-${c.orderIds.join('_')}-${i}`} first={i === 0} left={`${i + 1}. ${c.name}`} sub={`${customerLine(c)}${c.orderIds.length ? ` · ${c.orderIds.join(', ')}` : ''}`} right={formatDuration(c.ms)} />
              ))}
              {(slow ? data.slowest : data.fastest).length === 0 && <Typography sx={{ p: 2, color: '#9CA3AF' }}>No customers yet.</Typography>}
            </Paper>
          </Box>
        </>
      )}
    </Box>
  );
}
