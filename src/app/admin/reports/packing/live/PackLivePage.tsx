'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPlayerPause, IconPlayerPlay, IconCheck, IconTruckDelivery } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { addDays, formatDayShort, isDayString, shortSpiceLabel, weekdayName } from '@/utils/kitchenDashboard';
import { formatPSTDateISO } from '@/utils/timezone';
import type { PackingReport, PackStop } from '@/utils/packingReport';
import {
  formatDuration,
  groupByDay,
  packableRoutes,
  routeLabel,
  runElapsedMs,
  runStatus,
  startIndex,
  stopCounts,
  stopMetaOf,
  stopElapsedMs,
  stopKeyOf,
  summarizeRoute,
  type PackableRoute,
  type PackingRun,
} from '@/utils/packingProgress';

type Preset = 'today' | 'tomorrow' | 'other';
type TabId = 'pack' | 'times';

const ORANGE = '#F89C35';
const POLL_MS = 4000;
const SPICE_CHIP = { bgcolor: '#FDE7E2', color: '#A12A14' };

/** Phone: checkbox | quantity | item + chips. Wider screens follow the sheet: Check | Portion | Qty | Item | ECO | Spice. */
const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: { xs: '52px 34px 1fr', sm: '56px 90px 56px 1fr 80px 150px' },
  gridTemplateAreas: { xs: '"check qty item"', sm: '"check portion qty item eco spice"' },
  alignItems: 'center',
  columnGap: 1,
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function PackLivePage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const today = useMemo(() => formatPSTDateISO(new Date()), []);
  const startPreset = useMemo<Preset>(() => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(new Date()));
    return hour >= 18 ? 'tomorrow' : 'today';
  }, []);
  const [preset, setPreset] = useState<Preset>(startPreset);
  const [otherDate, setOtherDate] = useState(addDays(today, 2));
  const [report, setReport] = useState<PackingReport | null>(null);
  const [runs, setRuns] = useState<PackingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [routeKey, setRouteKey] = useState<string>('');
  const [tab, setTab] = useState<TabId>('pack');
  const [clockSkew, setClockSkew] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirm, setConfirm] = useState<null | 'next' | 'finish' | 'reset' | 'stop'>(null);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const startRequest = useLatestRequest();
  const inFlight = useRef(0);

  const date = preset === 'today' ? today : preset === 'tomorrow' ? addDays(today, 1) : isDayString(otherDate) ? otherDate : null;

  const routes = useMemo<PackableRoute[]>(() => (report ? packableRoutes(report.routes, report.unrouted) : []), [report]);
  const route = routes.find((r) => r.key === routeKey) ?? null;
  const run = runs.find((r) => r.routeKey === routeKey) ?? null;
  const status = runStatus(run);
  const serverNow = nowMs + clockSkew;

  // the report (what to pack) and the saved progress (who is where): the report once, the progress again and again
  const load = useCallback(async () => {
    if (!token || !date) return;
    const request = startRequest();
    setLoading(true);
    setError('');
    try {
      const [reportRes, progressRes] = await Promise.all([
        fetch(`/api/admin/packing-report?date=${date}`, { headers: authHeaders(token), signal: request.signal }),
        fetch(`/api/admin/packing-progress?date=${date}`, { headers: authHeaders(token), signal: request.signal }),
      ]);
      const reportJson = await reportRes.json().catch(() => ({}));
      const progressJson = await progressRes.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!reportRes.ok) throw new Error(reportJson.error || 'Could not load the packing list');
      if (!progressRes.ok) throw new Error(progressJson.error || 'Could not load the packing progress');
      setReport(reportJson.data as PackingReport);
      setRuns((progressJson.data?.runs ?? []) as PackingRun[]);
      if (progressJson.data?.now) setClockSkew(new Date(progressJson.data.now).getTime() - Date.now());
    } catch (e) {
      if (!request.isCurrent() || (e instanceof DOMException && e.name === 'AbortError')) return;
      setReport(null);
      setError(e instanceof Error ? e.message : 'Could not load the packing list');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [token, date, startRequest]);

  useEffect(() => {
    setRouteKey('');
    setRuns([]);
    void load();
  }, [load]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  // the same screen for everyone: pick up what the others ticked (not while one of my own taps is still being saved)
  useEffect(() => {
    if (!token || !date || loading) return;
    const timer = setInterval(async () => {
      if (inFlight.current > 0 || document.hidden) return;
      try {
        const res = await fetch(`/api/admin/packing-progress?date=${date}`, { headers: authHeaders(token) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || inFlight.current > 0) return;
        setRuns((json.data?.runs ?? []) as PackingRun[]);
        if (json.data?.now) setClockSkew(new Date(json.data.now).getTime() - Date.now());
      } catch {
        /* the next tick tries again */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [token, date, loading]);

  // the timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // with one route, no need to choose
  useEffect(() => {
    if (!routeKey && routes.length === 1) setRouteKey(routes[0].key);
  }, [routes, routeKey]);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      if (!token || !date) return null;
      inFlight.current += 1;
      try {
        const res = await fetch('/api/admin/packing-progress', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ date, ...body }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not save that');
        const saved = json.data?.run as PackingRun | null;
        if (json.data?.now) setClockSkew(new Date(json.data.now).getTime() - Date.now());
        setRuns((prev) => {
          const rest = prev.filter((r) => r.routeKey !== body.routeKey);
          return saved ? [...rest, saved] : rest;
        });
        return saved;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that');
        return null;
      } finally {
        inFlight.current -= 1;
      }
    },
    [token, date]
  );

  const stops = route?.stops ?? [];
  const currentKey = run?.currentStopKey ?? null;
  const index = status === 'packing' || status === 'paused' ? Math.max(0, stops.findIndex((s) => stopKeyOf(s) === currentKey)) : status === 'done' ? stops.length - 1 : startIndex(route ?? { key: '', title: '', driverName: '', stops: [] }, run);
  const stop: PackStop | undefined = stops[index];
  const stopKey = stop ? stopKeyOf(stop) : '';
  const progress = stop ? run?.stops?.[stopKey] : undefined;
  const counts = stop ? stopCounts(stop, progress) : { total: 0, done: 0, complete: false };
  const summary = route ? summarizeRoute(route, run, serverNow) : null;

  const start = async () => {
    if (!route || stops.length === 0) return;
    setBusy(true);
    const first = stops[index] ?? stops[0];
    await send({ action: 'start', routeKey: route.key, driverName: routeLabel(route), firstStopKey: stopKeyOf(first), firstMeta: stopMetaOf(first), totals: { customers: stops.length, units: summary?.units ?? 0 } });
    setBusy(false);
  };

  const goTo = async (target: number) => {
    if (!route || target < 0 || target >= stops.length) return;
    setConfirm(null);
    // show it at once, the answer confirms it
    setRuns((prev) => prev.map((r) => (r.routeKey === route.key ? { ...r, currentStopKey: stopKeyOf(stops[target]) } : r)));
    await send({ action: 'goto', routeKey: route.key, toStopKey: stopKeyOf(stops[target]), meta: stopMetaOf(stops[target]) });
  };

  const finish = async () => {
    if (!route) return;
    setConfirm(null);
    setBusy(true);
    await send({ action: 'finish', routeKey: route.key });
    setBusy(false);
    setTab('times');
  };

  const pause = async () => {
    if (!route) return;
    setConfirm(null);
    setBusy(true);
    await send({ action: 'pause', routeKey: route.key });
    setBusy(false);
    setShowPicker(false);
  };

  const resume = async () => {
    if (!route) return;
    setBusy(true);
    await send({ action: 'resume', routeKey: route.key });
    setBusy(false);
    setTab('pack');
  };

  const reset = async () => {
    if (!route) return;
    setConfirm(null);
    await send({ action: 'reset', routeKey: route.key });
    setTab('pack');
  };

  const tick = (keys: string[], checked: boolean) => {
    if (!route || !stop || status !== 'packing') return;
    setRuns((prev) =>
      prev.map((r) => {
        if (r.routeKey !== route.key) return r;
        const before = new Set(r.stops?.[stopKey]?.checked ?? []);
        keys.forEach((k) => (checked ? before.add(k) : before.delete(k)));
        return { ...r, stops: { ...r.stops, [stopKey]: { ...r.stops?.[stopKey], checked: [...before] } } };
      })
    );
    void send({ action: 'check', routeKey: route.key, stopKey, lineKeys: keys, checked });
  };

  const onNext = () => {
    if (index >= stops.length - 1) {
      if (!counts.complete) setConfirm('finish');
      else void finish();
      return;
    }
    if (!counts.complete) setConfirm('next');
    else void goTo(index + 1);
  };

  const presets: Array<{ id: Preset; label: string }> = [
    { id: 'today', label: formatDayShort(today) },
    { id: 'tomorrow', label: formatDayShort(addDays(today, 1)) },
    { id: 'other', label: 'Other date' },
  ];
  const isLast = index >= stops.length - 1;
  // while packing the screen is only the work: the day and driver choices come back with "Change"
  const pickerOpen = status !== 'packing' || showPicker;
  const checkedSet = new Set(progress?.checked ?? []);

  return (
    <Box sx={{ pb: { xs: status === 'packing' ? 12 : 2, md: status === 'packing' ? 12 : 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button component={Link} href="/admin/reports/packing" size="small" startIcon={<IconArrowLeft size={16} />} sx={{ textTransform: 'none', fontWeight: 600, ml: -1 }}>
          Packing Report
        </Button>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827', mb: 1.5 }}>
        Pack live
      </Typography>

      {pickerOpen && (
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {presets.map((p) => (
            <Chip key={p.id} label={p.label} clickable onClick={() => setPreset(p.id)} variant={preset === p.id ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(preset === p.id ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
          ))}
          {preset === 'other' && <TextField label="Delivery date" type="date" size="small" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} InputLabelProps={{ shrink: true }} />}
        </Box>
        {date && <Typography sx={{ fontSize: 14, color: '#374151', fontWeight: 600, mt: 1.25 }}>Delivery {formatDayShort(date)}</Typography>}
      </Paper>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && report && routes.length === 0 && <Typography sx={{ color: '#9CA3AF', py: 3 }}>Nothing to pack for this date.</Typography>}

      {!loading && routes.length > 0 && pickerOpen && (
        <>
          <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', mb: 0.75 }}>Select driver</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {routes.map((r) => {
              const rr = runs.find((x) => x.routeKey === r.key);
              const st = runStatus(rr);
              const s = summarizeRoute(r, rr, serverNow);
              const selected = r.key === routeKey;
              return (
                <Chip
                  key={r.key}
                  clickable
                  onClick={() => {
                    setRouteKey(r.key);
                    setTab('pack');
                    setShowPicker(false);
                  }}
                  variant={selected ? 'filled' : 'outlined'}
                  icon={st === 'done' ? <IconCheck size={16} /> : undefined}
                  label={`${routeLabel(r)} · ${st === 'not_started' ? `${r.stops.length} stops` : st === 'paused' ? `paused ${s.complete}/${s.customers}` : `${s.complete}/${s.customers}`}`}
                  sx={{ height: 40, fontSize: 15, fontWeight: selected ? 800 : 500, ...(selected ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}), ...(st === 'done' && !selected ? { borderColor: '#126B2C', color: '#126B2C' } : {}) }}
                />
              );
            })}
          </Box>
        </>
      )}

      {route && (
        <>
          <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280' }}>Packing for{date ? ` · ${formatDayShort(date)}` : ''}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#111827', wordBreak: 'break-word' }}>{routeLabel(route)}</Typography>
              </Box>
              {status === 'packing' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                  <Button size="small" variant="outlined" color="error" startIcon={<IconPlayerPause size={16} />} onClick={() => setConfirm('stop')} disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Stop packing
                  </Button>
                  <Button size="small" onClick={() => setShowPicker((v) => !v)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    {showPicker ? 'Hide' : 'Change driver or day'}
                  </Button>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mt: 1.25 }}>
              {status === 'not_started' ? (
                <Button variant="contained" size="large" startIcon={<IconPlayerPlay size={20} />} onClick={start} disabled={busy} sx={{ textTransform: 'none', fontWeight: 800, bgcolor: ORANGE, '&:hover': { bgcolor: '#E08A28' } }}>
                  Start packing
                </Button>
              ) : (
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280' }}>{status === 'done' ? 'Total time' : status === 'paused' ? 'Paused' : 'Timer'}</Typography>
                  <Typography sx={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: status === 'done' ? '#126B2C' : status === 'paused' ? '#B45309' : '#111827', lineHeight: 1.1 }}>{formatDuration(runElapsedMs(run, serverNow))}</Typography>
                </Box>
              )}
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Typography sx={{ fontSize: 14, color: '#374151' }}>
                  {route.stops.length} customer{route.stops.length === 1 ? '' : 's'} · {summary?.units ?? 0} unit{summary?.units === 1 ? '' : 's'}
                </Typography>
                {status !== 'not_started' && (
                  <Typography sx={{ fontSize: 14, color: '#374151' }}>
                    {summary?.complete ?? 0} of {summary?.customers ?? 0} packed{run?.startedBy ? ` · started by ${run.startedBy}` : ''}
                  </Typography>
                )}
              </Box>
            </Box>
            {status !== 'not_started' && <LinearProgress variant="determinate" value={summary && summary.customers > 0 ? (summary.complete / summary.customers) * 100 : 0} sx={{ mt: 1.5, height: 8, borderRadius: 4, bgcolor: '#F3F4F6', '& .MuiLinearProgress-bar': { bgcolor: '#126B2C' } }} />}
            {status === 'paused' && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
                <Button variant="contained" size="large" startIcon={<IconPlayerPlay size={20} />} onClick={() => void resume()} disabled={busy} sx={{ textTransform: 'none', fontWeight: 800, bgcolor: ORANGE, '&:hover': { bgcolor: '#E08A28' } }}>
                  Resume packing
                </Button>
                <Typography sx={{ fontSize: 13, color: '#6B7280' }}>Your place and ticks are kept. The timers are stopped.</Typography>
              </Box>
            )}
          </Paper>

          {status !== 'not_started' && (
            <Tabs value={tab} onChange={(_, v: TabId) => setTab(v)} sx={{ borderBottom: '1px solid #E5E7EB', mb: 2 }}>
              <Tab value="pack" label="Pack" sx={{ textTransform: 'none', fontWeight: 600 }} />
              <Tab value="times" label="Times" sx={{ textTransform: 'none', fontWeight: 600 }} />
            </Tabs>
          )}

          {status === 'not_started' && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>Press Start packing to begin with customer 1. The timer runs for each customer until you move to the next.</Typography>}

          {status !== 'not_started' && tab === 'pack' && stop && (
            <Box>
              <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <Box sx={{ px: 2, py: 1.25, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#6B7280' }}>Customer {index + 1} of {stops.length}</Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{formatDuration(stopElapsedMs(progress, serverNow))}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827', wordBreak: 'break-word' }}>{stop.customerName}</Typography>
                    <Typography sx={{ fontSize: 14, color: '#374151', wordBreak: 'break-word', pt: 0.4 }}>Order # {stop.orderIds.join(', ')}</Typography>
                  </Box>
                  {date && (
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <IconTruckDelivery size={16} /> Delivery {formatDayShort(date)}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 13, color: counts.complete ? '#126B2C' : '#6B7280', fontWeight: 600 }}>
                    {counts.done} of {counts.total} item{counts.total === 1 ? '' : 's'} checked
                  </Typography>
                </Box>

                {groupByDay(stop).map((group) => {
                  const keys = group.lines.map((l) => l.key);
                  const all = keys.every((k) => checkedSet.has(k));
                  const some = keys.some((k) => checkedSet.has(k));
                  // a day other than the delivery date: the food was picked for that day and goes out on the delivery date
                  const otherDay = Boolean(group.day && date && group.day !== date);
                  return (
                    <Box key={group.day}>
                      <Box sx={{ ...ROW_GRID, px: 1, py: otherDay ? 0.75 : 0.5, bgcolor: otherDay ? '#FEF3C7' : '#FFF7ED', borderBottom: `1px solid ${otherDay ? '#FCD34D' : '#FED7AA'}` }}>
                        <Box sx={{ gridArea: 'check' }}>
                          <Checkbox disabled={status !== 'packing'} checked={all} indeterminate={some && !all} onChange={() => tick(keys, !all)} inputProps={{ 'aria-label': `Check all for ${group.day ? formatDayShort(group.day) : 'this day'}` }} sx={{ p: 1.25, color: ORANGE, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: ORANGE } }} />
                        </Box>
                        <Box sx={{ gridArea: { xs: 'qty / qty / qty / item', sm: 'portion / portion / portion / spice' }, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 15, color: otherDay ? '#92400E' : '#9A3412' }}>
                            {group.day ? (otherDay ? `${weekdayName(group.day)} items · ${formatDayShort(group.day)}` : formatDayShort(group.day)) : 'Items'}{' '}
                            <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: otherDay ? '#92400E' : '#9A3412', whiteSpace: 'nowrap' }}>· check all</Typography>
                          </Typography>
                          {otherDay && date && (
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <IconTruckDelivery size={15} /> Delivered {formatDayShort(date)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ ...ROW_GRID, display: { xs: 'none', sm: 'grid' }, px: 1, py: 0.5, borderBottom: '1px solid #F3F4F6' }}>
                        {[
                          ['check', 'Check'],
                          ['portion', 'Portion size'],
                          ['qty', 'Qty'],
                          ['item', 'Item'],
                          ['eco', 'ECO'],
                          ['spice', 'Spice level'],
                        ].map(([area, label]) => (
                          <Typography key={area} sx={{ gridArea: area, fontSize: 12, fontWeight: 700, color: '#6B7280', textAlign: area === 'check' || area === 'qty' ? 'center' : 'left' }}>
                            {label}
                          </Typography>
                        ))}
                      </Box>
                      {group.lines.map(({ key, line }) => {
                        const on = checkedSet.has(key);
                        return (
                          <Box
                            key={key}
                            onClick={() => tick([key], !on)}
                            sx={{ ...ROW_GRID, px: 1, py: 0.5, minHeight: 56, cursor: 'pointer', borderBottom: '1px solid #F3F4F6', bgcolor: on ? '#F0FDF4' : line.isEco ? '#F4FBF6' : '#fff', '&:hover': { bgcolor: on ? '#E7F8EE' : '#FAFAFA' } }}
                          >
                            <Box sx={{ gridArea: 'check', display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <Checkbox disabled={status !== 'packing'} checked={on} onChange={() => tick([key], !on)} inputProps={{ 'aria-label': `Packed: ${line.name}` }} sx={{ p: 1.25, '&.Mui-checked': { color: '#126B2C' } }} />
                            </Box>
                            <Typography sx={{ gridArea: 'portion', display: { xs: 'none', sm: 'block' }, fontSize: 14, color: '#374151' }}>{line.portion ?? ''}</Typography>
                            <Typography sx={{ gridArea: 'qty', fontSize: 18, fontWeight: 800, color: '#111827', textAlign: 'center' }}>{line.quantity}</Typography>
                            <Box sx={{ gridArea: 'item', minWidth: 0, textDecoration: on ? 'line-through' : 'none', color: on ? '#6B7280' : '#111827' }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 15, wordBreak: 'break-word', textDecoration: 'inherit' }}>{line.name}</Typography>
                              {line.choices.map((c) => (
                                <Typography key={c} sx={{ fontSize: 12, color: '#4B5563', wordBreak: 'break-word', textDecoration: 'inherit' }}>
                                  {c}
                                </Typography>
                              ))}
                              <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {line.portion && <Chip size="small" label={line.portion} sx={{ height: 22, fontSize: 12 }} />}
                                {line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 22, fontSize: 12, ...SPICE_CHIP }} />}
                                {line.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
                              </Box>
                            </Box>
                            <Box sx={{ gridArea: 'eco', display: { xs: 'none', sm: 'block' } }}>{line.isEco && <Chip size="small" label="ECO" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}</Box>
                            <Box sx={{ gridArea: 'spice', display: { xs: 'none', sm: 'block' } }}>{line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 22, fontSize: 12, ...SPICE_CHIP }} />}</Box>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
              </Paper>
            </Box>
          )}

          {status !== 'not_started' && tab === 'times' && summary && (
            <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, px: 2, py: 1.5, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>On customers</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(summary.totalMs)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Average per customer</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{summary.averageMs > 0 ? formatDuration(summary.averageMs) : '–'}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Packed</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
                    {summary.complete} of {summary.customers}
                  </Typography>
                </Box>
              </Box>
              {stops.map((s, i) => {
                const key = stopKeyOf(s);
                const p = run?.stops?.[key];
                const c = stopCounts(s, p);
                const ms = stopElapsedMs(p, serverNow);
                return (
                  <Box
                    key={key}
                    onClick={() => {
                      setTab('pack');
                      if (status === 'packing') void goTo(i);
                    }}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', cursor: status === 'packing' ? 'pointer' : 'default', bgcolor: key === currentKey ? '#FFF7ED' : '#fff' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>
                        {i + 1}. {s.customerName}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: c.complete ? '#126B2C' : c.done > 0 ? '#B45309' : '#9CA3AF' }}>
                        {c.done} of {c.total} item{c.total === 1 ? '' : 's'}{c.complete ? ' · packed' : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: ms > 0 ? '#111827' : '#D1D5DB' }}>{ms > 0 ? formatDuration(ms) : '–'}</Typography>
                  </Box>
                );
              })}
              <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #E5E7EB' }}>
                <Button color="inherit" size="small" onClick={() => setConfirm('reset')} sx={{ textTransform: 'none', color: '#B91C1C' }}>
                  Start this route again
                </Button>
              </Box>
            </Paper>
          )}
        </>
      )}

      {status === 'packing' && stop && tab === 'pack' && (
        <Box sx={{ position: 'fixed', left: { xs: 0, md: 270 }, right: 0, bottom: 0, zIndex: 1200, p: 1.25, bgcolor: '#fff', borderTop: '1px solid #E5E7EB', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', display: 'flex', gap: 1.25 }}>
          <Button variant="outlined" size="large" startIcon={<IconChevronLeft size={20} />} disabled={index === 0} onClick={() => void goTo(index - 1)} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, minHeight: 52 }}>
            Previous
          </Button>
          <Button variant="contained" size="large" endIcon={isLast ? <IconCheck size={20} /> : <IconChevronRight size={20} />} onClick={onNext} disabled={busy} sx={{ flex: 1.4, textTransform: 'none', fontWeight: 800, minHeight: 52, bgcolor: counts.complete ? '#126B2C' : ORANGE, '&:hover': { bgcolor: counts.complete ? '#0E5522' : '#E08A28' } }}>
            {isLast ? 'Finish packing' : 'Next customer'}
          </Button>
        </Box>
      )}

      <Dialog open={confirm === 'stop'} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>Stop packing?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {summary?.complete ?? 0} of {summary?.customers ?? 0} customers are packed. Pause keeps your place and every tick, and you carry on later. Finish ends this route as done.
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button variant="contained" size="large" startIcon={<IconPlayerPause size={20} />} onClick={() => void pause()} sx={{ textTransform: 'none', fontWeight: 800, bgcolor: ORANGE, '&:hover': { bgcolor: '#E08A28' } }}>
              Pause and go back
            </Button>
            <Button variant="outlined" size="large" startIcon={<IconCheck size={20} />} onClick={() => void finish()} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Finish this route now
            </Button>
            <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }}>
              Keep packing
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={confirm === 'next' || confirm === 'finish'} onClose={() => setConfirm(null)}>
        <DialogTitle>Some items are not checked</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {counts.total - counts.done} of {counts.total} items for {stop?.customerName} are not checked. {confirm === 'finish' ? 'Finish packing anyway?' : 'Go to the next customer anyway?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }}>
            Keep packing
          </Button>
          <Button variant="contained" onClick={() => (confirm === 'finish' ? void finish() : void goTo(index + 1))} sx={{ textTransform: 'none', bgcolor: ORANGE, '&:hover': { bgcolor: '#E08A28' } }}>
            {confirm === 'finish' ? 'Finish anyway' : 'Next anyway'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirm === 'reset'} onClose={() => setConfirm(null)}>
        <DialogTitle>Start this route again?</DialogTitle>
        <DialogContent>
          <DialogContentText>This clears every check mark and all the times saved for {route ? routeLabel(route) : 'this route'}. It cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void reset()} sx={{ textTransform: 'none' }}>
            Clear and start again
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
