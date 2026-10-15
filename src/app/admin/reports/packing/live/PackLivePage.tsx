'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, TextField, Typography } from '@mui/material';
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPlayerPause, IconPlayerPlay, IconCheck, IconTruckDelivery, IconListDetails } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { useReloadWhenStale } from '@/hooks/useReloadWhenStale';
import { comparePackingReports, describeChanges, type PackingChanges } from '@/utils/packingChanges';
import { addDays, formatDayShort, isDayString, shortSpiceLabel, weekdayName } from '@/utils/kitchenDashboard';
import { formatPSTDateISO } from '@/utils/timezone';
import type { PackingReport, PackStop } from '@/utils/packingReport';
import {
  findMovedStop,
  groupByDay,
  packableRoutes,
  routeLabel,
  runStatus,
  startIndex,
  stopMetaOf,
  stopKeyOf,
  summarizeRoute,
  type PackableRoute,
  type PackingRun,
} from '@/utils/packingProgress';

type Preset = 'today' | 'tomorrow' | 'other';

const ORANGE = '#F89C35';
const POLL_MS = 4000;
/** The main button of the screen (Start packing, Resume packing): big enough to hit with a thumb, full width on a phone */
const BIG_BUTTON = { textTransform: 'none', fontWeight: 800, fontSize: 22, minHeight: 72, px: 5, width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 340 }, borderRadius: 2, bgcolor: ORANGE, '&:hover': { bgcolor: '#E08A28' } } as const;
const SPICE_CHIP = { bgcolor: '#FDE7E2', color: '#A12A14' };

/** Phone: quantity | item + chips. Wider screens follow the sheet: Portion | Qty | Item | ECO | Spice. (No checkboxes: the packer just moves on.) */
const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: { xs: '40px 1fr', sm: '76px 44px minmax(0, 440px) 60px 140px' },
  justifyContent: 'start',
  gridTemplateAreas: { xs: '"qty item"', sm: '"portion qty item eco spice"' },
  alignItems: 'center',
  columnGap: 1,
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Every customer of the route by name, in route order. The ones the packer has been through carry a check mark, the one on screen is
 * highlighted, and tapping any name goes straight to that customer (while packing is on). Customers the packer skipped over stay unchecked.
 */
function CustomerList({ stops, run, current, canJump, finished, onJump, maxHeight }: { stops: PackStop[]; run: PackingRun | null; current: number; canJump: boolean; finished?: boolean; onJump: (index: number) => void; maxHeight?: string }) {
  const currentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // keep the customer on screen in view inside the list (not the whole page)
    const el = currentRef.current;
    const box = el?.parentElement;
    if (el && box) box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2);
  }, [current]);
  return (
    <Box sx={{ maxHeight, overflowY: 'auto' }}>
      {stops.map((s, i) => {
        const progress = run?.stops?.[stopKeyOf(s)];
        // once the route is finished every customer the packer reached (the last one too) is checked and nobody is "current"
        const isCurrent = i === current && !finished;
        const visited = !isCurrent && Boolean(progress && (Number(progress.timeMs) > 0 || progress.firstOpenedAt));
        return (
          <Box
            key={stopKeyOf(s)}
            ref={isCurrent ? currentRef : undefined}
            {...(canJump ? { role: 'button', tabIndex: 0, onClick: () => onJump(i), onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onJump(i)) } : {})}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.9, minHeight: 44, borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', bgcolor: isCurrent ? '#FFF1DC' : '#fff', cursor: canJump ? 'pointer' : 'default', '&:hover': canJump ? { bgcolor: isCurrent ? '#FFF1DC' : '#FAFAFA' } : undefined, '&:focus-visible': { outline: '2px solid #F5C77E', outlineOffset: -2 } }}
          >
            <Box sx={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: visited ? '#126B2C' : 'transparent', border: visited ? 'none' : `1.5px solid ${isCurrent ? ORANGE : '#D1D5DB'}`, color: '#fff' }}>
              {visited && <IconCheck size={14} stroke={3} />}
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: isCurrent ? 800 : 600, color: visited ? '#6B7280' : '#111827', wordBreak: 'break-word', lineHeight: 1.3 }}>
              <Box component="span" sx={{ color: '#9CA3AF', fontWeight: 600, mr: 0.75 }}>{i + 1}</Box>
              {s.customerName || 'Customer'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
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
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  // a newer list that is waiting for the packers to accept it (never swapped in while someone is packing)
  const [pending, setPending] = useState<{ report: PackingReport; changes: PackingChanges } | null>(null);
  const [runs, setRuns] = useState<PackingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [routeKey, setRouteKey] = useState<string>('');
  const [clockSkew, setClockSkew] = useState(0);
  const [confirm, setConfirm] = useState<null | 'reset' | 'stop'>(null);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // the list of all customers: always at the side on a computer, in a window on a phone
  const [listOpen, setListOpen] = useState(false);
  const startRequest = useLatestRequest();
  const inFlight = useRef(0);
  // when the packer last moved to another customer: a second tap right after the first (a double tap) must not skip a customer
  const lastMoveAt = useRef(0);

  const date = preset === 'today' ? today : preset === 'tomorrow' ? addDays(today, 1) : isDayString(otherDate) ? otherDate : null;

  const routes = useMemo<PackableRoute[]>(() => (report ? packableRoutes(report.routes, report.unrouted) : []), [report]);
  const route = routes.find((r) => r.key === routeKey) ?? null;
  const run = runs.find((r) => r.routeKey === routeKey) ?? null;
  const status = runStatus(run);
  const serverNow = Date.now() + clockSkew;

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
      setLoadedAt(new Date());
      setPending(null);
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

  // Is anyone packing right now (on any route of this day)? Then the list must not change under them.
  const someonePacking = runs.some((r) => runStatus(r) === 'packing');

  // Orders paid after this page opened: look again quietly. Nothing changes on screen while someone is packing; a banner offers
  // the new list instead. When nobody is packing, the new list is simply used.
  const checkForNew = useCallback(async () => {
    if (!token || !date || !report) return;
    try {
      const res = await fetch(`/api/admin/packing-report?date=${date}`, { headers: authHeaders(token) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.data) return;
      const fresh = json.data as PackingReport;
      const changes = comparePackingReports(report, fresh);
      if (changes.same) {
        setLoadedAt(new Date());
        setPending(null);
      } else if (someonePacking) {
        setPending({ report: fresh, changes });
      } else {
        setReport(fresh);
        setLoadedAt(new Date());
        setPending(null);
      }
    } catch {
      /* the next check tries again */
    }
  }, [token, date, report, someonePacking]);

  useReloadWhenStale(loadedAt, () => void checkForNew(), Boolean(report));

  // and while the screen stays open all day (packing never leaves it): look every 90 seconds
  useEffect(() => {
    if (!report) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void checkForNew();
    }, 90 * 1000);
    return () => clearInterval(timer);
  }, [report, checkForNew]);

  const applyPending = () => {
    if (!pending) return;
    setReport(pending.report);
    setLoadedAt(new Date());
    setPending(null);
  };

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
  const summary = route ? summarizeRoute(route, run, serverNow) : null;

  // The list was swapped for a newer one. A customer whose stop was renumbered (a second order joined it) keeps their place: found again by
  // name and orders. Only while packing is on.
  useEffect(() => {
    if (status !== 'packing' || !route || !run || stops.length === 0) return;
    const keys = new Set(stops.map(stopKeyOf));
    if (currentKey && !keys.has(currentKey)) {
      const target = findMovedStop(stops, run.stops?.[currentKey]?.meta);
      if (target >= 0) void goTo(target, { automatic: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, run, stops, status, currentKey]);

  const start = async () => {
    if (!route || stops.length === 0) return;
    setBusy(true);
    const first = stops[index] ?? stops[0];
    await send({ action: 'start', routeKey: route.key, driverName: routeLabel(route), firstStopKey: stopKeyOf(first), firstMeta: stopMetaOf(first), totals: { customers: stops.length, units: summary?.units ?? 0 } });
    setBusy(false);
  };

  const goTo = async (target: number, options: { automatic?: boolean; jump?: boolean } = {}) => {
    if (!route || target < 0 || target >= stops.length) return;
    if (!options.automatic && !options.jump) {
      if (Date.now() - lastMoveAt.current < 900) return;
      lastMoveAt.current = Date.now();
    }
    setConfirm(null);
    // show it at once, the answer confirms it
    setRuns((prev) => prev.map((r) => (r.routeKey === route.key ? { ...r, currentStopKey: stopKeyOf(stops[target]) } : r)));
    // the last customer is never moved on from: the server gives it the average time and finishes the route
    const last = target === stops.length - 1 && stops.length > 1;
    await send({ action: 'goto', routeKey: route.key, toStopKey: stopKeyOf(stops[target]), meta: stopMetaOf(stops[target]), ...(last ? { finishIfLast: true } : {}) });
  };

  const finish = async () => {
    if (!route) return;
    setConfirm(null);
    setBusy(true);
    await send({ action: 'finish', routeKey: route.key });
    setBusy(false);
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
  };

  const reset = async () => {
    if (!route) return;
    setConfirm(null);
    await send({ action: 'reset', routeKey: route.key });
  };

  // no checkboxes and no questions: Next customer simply moves on (the last customer finishes the route by itself)
  const onNext = () => {
    if (index >= stops.length - 1) void finish();
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

  return (
    <Box sx={{ pb: { xs: status === 'packing' ? 12 : 2, md: status === 'packing' ? 12 : 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button component={Link} href="/admin/reports/packing" size="small" startIcon={<IconArrowLeft size={16} />} sx={{ textTransform: 'none', fontWeight: 600, ml: -1 }}>
          Packing Report
        </Button>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#111827', mb: 1.5 }}>
        Packing Planner
      </Typography>

      {pickerOpen && (
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {presets.map((p) => (
            <Chip key={p.id} label={p.label} clickable onClick={() => setPreset(p.id)} variant={preset === p.id ? 'filled' : 'outlined'} sx={{ fontWeight: 600, ...(preset === p.id ? { bgcolor: ORANGE, color: '#fff', '&:hover': { bgcolor: '#E08A28' } } : {}) }} />
          ))}
          {preset === 'other' && <TextField label="Delivery date" type="date" size="small" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} InputLabelProps={{ shrink: true }} />}
        </Box>
      </Paper>
      )}

      {pending && (
        <Alert
          severity="warning"
          sx={{ mb: 2, alignItems: 'center' }}
          action={
            <Button color="inherit" size="small" onClick={applyPending} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Update list
            </Button>
          }
        >
          {describeChanges(pending.changes)} since you opened this. Update the list when you are between customers (your ticks and place are kept).
        </Alert>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#111827', wordBreak: 'break-word', lineHeight: 1.2 }}>{routeLabel(route)}</Typography>
                {/* the delivery day and the driver are written once, here at the top */}
                {status === 'not_started' && (
                  <Typography sx={{ fontSize: 14, color: '#374151' }}>
                    {date ? `${formatDayShort(date)} · ` : ''}{route.stops.length} customer{route.stops.length === 1 ? '' : 's'} · {summary?.units ?? 0} unit{summary?.units === 1 ? '' : 's'}
                  </Typography>
                )}
                {status !== 'not_started' && (
                  <Typography sx={{ fontSize: 14, color: status === 'done' ? '#126B2C' : status === 'paused' ? '#B45309' : '#374151', fontWeight: status === 'packing' ? 400 : 700 }}>
                    {date ? `${formatDayShort(date)} · ` : ''}{status === 'done' ? 'Route done' : status === 'paused' ? 'Paused' : `${Math.min(index + 1, stops.length)} of ${stops.length}`}
                  </Typography>
                )}
              </Box>
              {status === 'packing' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <Button size="small" startIcon={<IconListDetails size={16} />} onClick={() => setListOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, display: { xs: 'inline-flex', md: 'none' } }}>
                    Customers
                  </Button>
                  <Button size="small" onClick={() => setShowPicker((v) => !v)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    {showPicker ? 'Hide' : 'Change driver or day'}
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<IconPlayerPause size={16} />} onClick={() => setConfirm('stop')} disabled={busy} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Stop packing
                  </Button>
                </Box>
              )}
            </Box>
            {status === 'not_started' && (
              <Box sx={{ mt: 1.5 }}>
                <Button variant="contained" size="large" startIcon={<IconPlayerPlay size={30} />} onClick={start} disabled={busy} sx={BIG_BUTTON}>
                  Start packing
                </Button>
              </Box>
            )}
            {status !== 'not_started' && <LinearProgress variant="determinate" value={stops.length > 0 ? (Math.min(status === 'done' ? stops.length : index, stops.length) / stops.length) * 100 : 0} sx={{ mt: 1.25, height: 8, borderRadius: 4, bgcolor: '#F3F4F6', '& .MuiLinearProgress-bar': { bgcolor: '#126B2C' } }} />}
            {status === 'paused' && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
                <Button variant="contained" size="large" startIcon={<IconPlayerPlay size={30} />} onClick={() => void resume()} disabled={busy} sx={BIG_BUTTON}>
                  Resume packing
                </Button>
              </Box>
            )}
            {(status === 'paused' || status === 'done') && (
              <Button color="inherit" size="small" onClick={() => setConfirm('reset')} sx={{ textTransform: 'none', color: '#B91C1C', mt: 1, ml: -1 }}>
                Start this route again
              </Button>
            )}
          </Paper>

          {status !== 'not_started' && stop && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 280px' }, columnGap: 2, alignItems: 'start' }}>
              <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                <Box sx={{ px: 2, py: 1.25, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#6B7280' }}>Customer {index + 1} of {stops.length}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#111827', wordBreak: 'break-word' }}>{stop.customerName}</Typography>
                    <Typography sx={{ fontSize: 14, color: '#374151', wordBreak: 'break-word', pt: 0.4 }}>Order # {stop.orderIds.join(', ')}</Typography>
                  </Box>
                </Box>

                {(() => {
                  const groups = groupByDay(stop);
                  return groups.map((group) => {
                    // a day other than the delivery date: the food was picked for that day and goes out on the delivery date
                    const otherDay = Boolean(group.day && date && group.day !== date);
                    // the day heading is only written when it tells something: several days, or a day other than the delivery date
                    const showHeading = groups.length > 1 || otherDay;
                    return (
                      <Box key={group.day}>
                        {showHeading && (
                          <Box sx={{ px: 2, py: 0.75, bgcolor: otherDay ? '#FEF3C7' : '#FFF7ED', borderBottom: `1px solid ${otherDay ? '#FCD34D' : '#FED7AA'}` }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 16, color: otherDay ? '#92400E' : '#9A3412' }}>
                              {group.day ? (otherDay ? `${weekdayName(group.day)} items · ${formatDayShort(group.day)}` : formatDayShort(group.day)) : 'Items'}
                            </Typography>
                            {otherDay && date && (
                              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <IconTruckDelivery size={15} /> Delivered {formatDayShort(date)}
                              </Typography>
                            )}
                          </Box>
                        )}
                        <Box sx={{ ...ROW_GRID, display: { xs: 'none', sm: 'grid' }, px: 2, py: 0.5, borderBottom: '1px solid #F3F4F6' }}>
                          {[
                            ['portion', 'Portion size'],
                            ['qty', 'Qty'],
                            ['item', 'Item'],
                            ['eco', 'ECO'],
                            ['spice', 'Spice level'],
                          ].map(([area, label]) => (
                            <Typography key={area} sx={{ gridArea: area, fontSize: 13, fontWeight: 700, color: '#6B7280', textAlign: 'left' }}>
                              {label}
                            </Typography>
                          ))}
                        </Box>
                        {group.lines.map((item) => {
                          const { key, line } = item;
                          return (
                            <Box key={key} sx={{ ...ROW_GRID, px: 2, py: 0.75, minHeight: 56, borderBottom: '1px solid #F3F4F6', bgcolor: line.isEco ? '#F4FBF6' : '#fff' }}>
                              <Typography sx={{ gridArea: 'portion', display: { xs: 'none', sm: 'block' }, fontSize: 16, color: '#374151' }}>{line.portion ?? ''}</Typography>
                              <Typography sx={{ gridArea: 'qty', fontSize: 18, fontWeight: 800, color: '#111827', textAlign: 'left' }}>{line.quantity}</Typography>
                              <Box sx={{ gridArea: 'item', minWidth: 0, color: '#111827' }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, wordBreak: 'break-word' }}>{line.name}</Typography>
                                {item.viaCombo && <Typography sx={{ fontSize: 13, color: '#6B7280', wordBreak: 'break-word' }}>from {item.viaCombo}</Typography>}
                                {line.choices.map((c) => (
                                  <Typography key={c} sx={{ fontSize: 14, color: '#4B5563', wordBreak: 'break-word' }}>
                                    {c}
                                  </Typography>
                                ))}
                                <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                  {line.portion && <Chip size="small" label={line.portion} sx={{ height: 26, fontSize: 14 }} />}
                                  {line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 26, fontSize: 14, ...SPICE_CHIP }} />}
                                  {line.isEco && <Chip size="small" label="ECO" sx={{ height: 26, fontSize: 14, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}
                                </Box>
                              </Box>
                              <Box sx={{ gridArea: 'eco', display: { xs: 'none', sm: 'block' } }}>{line.isEco && <Chip size="small" label="ECO" sx={{ height: 26, fontSize: 14, fontWeight: 700, bgcolor: '#E2F4E7', color: '#126B2C' }} />}</Box>
                              <Box sx={{ gridArea: 'spice', display: { xs: 'none', sm: 'block' } }}>{line.spice && <Chip size="small" label={shortSpiceLabel(line.spice)} sx={{ height: 26, fontSize: 14, ...SPICE_CHIP }} />}</Box>
                            </Box>
                          );
                        })}
                      </Box>
                    );
                  });
                })()}
              </Paper>
              <Paper elevation={0} sx={{ display: { xs: 'none', md: 'block' }, border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden', mb: 2, position: 'sticky', top: 80 }}>
                <Typography sx={{ px: 1.5, py: 1, fontSize: 13, fontWeight: 700, color: '#6B7280', bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>Customers</Typography>
                <CustomerList stops={stops} run={run} current={index} finished={status === 'done'} canJump={status === 'packing'} onJump={(i) => void goTo(i, { jump: true })} maxHeight="calc(100vh - 230px)" />
              </Paper>
            </Box>
          )}
        </>
      )}

      {status === 'packing' && stop && (
        <Box sx={{ position: 'fixed', left: { xs: 0, md: 270 }, right: 0, bottom: 0, zIndex: 1200, p: 1.25, bgcolor: '#fff', borderTop: '1px solid #E5E7EB', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)', display: 'flex', gap: 1.25 }}>
          <Button variant="outlined" size="large" startIcon={<IconChevronLeft size={20} />} disabled={index === 0} onClick={() => void goTo(index - 1)} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, minHeight: 52 }}>
            Previous
          </Button>
          <Button variant="contained" size="large" endIcon={isLast ? <IconCheck size={20} /> : <IconChevronRight size={20} />} onClick={onNext} disabled={busy} sx={{ flex: 1.4, textTransform: 'none', fontWeight: 800, minHeight: 52, bgcolor: ORANGE, '&:hover': { bgcolor: '#E08A28' } }}>
            {isLast ? 'Finish packing' : 'Next customer'}
          </Button>
        </Box>
      )}

      <Dialog open={listOpen} onClose={() => setListOpen(false)} fullWidth maxWidth="xs" scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>Customers</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <CustomerList stops={stops} run={run} current={index} finished={status === 'done'} canJump={status === 'packing'} onJump={(i) => { setListOpen(false); void goTo(i, { jump: true }); }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirm === 'stop'} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>Stop packing?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Pause keeps your place and you carry on later. Finish ends this route as done.
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
      <Dialog open={confirm === 'reset'} onClose={() => setConfirm(null)}>
        <DialogTitle>Start this route again?</DialogTitle>
        <DialogContent>
          <DialogContentText>This clears all the times saved for {route ? routeLabel(route) : 'this route'}. It cannot be undone.</DialogContentText>
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
