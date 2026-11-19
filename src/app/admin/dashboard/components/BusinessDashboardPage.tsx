'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, IconButton, Skeleton, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { IconRefresh } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestRequest } from '@/hooks/useLatestRequest';
import { formatPSTDateISO } from '@/utils/timezone';
import { addDays, weekStartOf } from '@/utils/kitchenDashboard';
import { daysBetween, defaultGrouping, MAX_DAILY_DAYS, validateDashboardRange, type DayRange, type Grouping } from '@/utils/businessDashboard';
import FinancialTab from './FinancialTab';
import ItemsTab from './ItemsTab';
import VisitorsTab from './VisitorsTab';
import DriversTab from './DriversTab';
import { rangeText, type DashboardData } from './ui';

type Preset = 'thisWeek' | 'lastWeek' | 'last4' | 'last12' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';
type TabId = 'financial' | 'items' | 'visitors' | 'drivers';

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'last4', label: 'Last 4 weeks' },
  { id: 'last12', label: 'Last 12 weeks' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear', label: 'This year' },
  { id: 'custom', label: 'Custom' },
];

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'financial', label: 'Financial' },
  { id: 'items', label: 'Items' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'drivers', label: 'Drivers' },
];

const STORE_KEY = 'admin_business_dashboard';

/** Weeks run Saturday to Friday (kitchen weeks); "Last 12 weeks" = the current week plus the 11 before it */
function presetRange(preset: Exclude<Preset, 'custom'>, today: string): DayRange {
  const week = weekStartOf(today);
  const month = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case 'thisWeek':
      return { from: week, to: today };
    case 'lastWeek':
      return { from: addDays(week, -7), to: addDays(week, -1) };
    case 'last4':
      return { from: addDays(week, -21), to: today };
    case 'last12':
      return { from: addDays(week, -77), to: today };
    case 'thisMonth':
      return { from: month, to: today };
    case 'lastMonth': {
      const end = addDays(month, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

function readSaved(): { preset?: Preset; tab?: TabId; custom?: DayRange } {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function BusinessDashboardPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const today = useMemo(() => formatPSTDateISO(new Date()), []);

  const [preset, setPreset] = useState<Preset>('last12');
  const [tab, setTab] = useState<TabId>('financial');
  const [customDraft, setCustomDraft] = useState<DayRange>({ from: '', to: '' });
  const [customApplied, setCustomApplied] = useState<DayRange | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [groupChoice, setGroupChoice] = useState<Grouping | null>(null);
  const [restored, setRestored] = useState(false);

  // the period and tab chosen last time, in this browser
  useEffect(() => {
    const saved = readSaved();
    if (saved.tab && TABS.some((t) => t.id === saved.tab)) setTab(saved.tab);
    if (saved.preset === 'custom' && saved.custom && !validateDashboardRange(saved.custom)) {
      setPreset('custom');
      setCustomApplied(saved.custom);
      setCustomDraft(saved.custom);
    } else if (saved.preset && saved.preset !== 'custom' && PRESETS.some((p) => p.id === saved.preset)) {
      setPreset(saved.preset);
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ preset, tab, custom: customApplied ?? undefined }));
    } catch {
      // private window: the choice is simply not remembered
    }
  }, [preset, tab, customApplied, restored]);

  const range: DayRange | null = preset === 'custom' ? customApplied : presetRange(preset, today);
  // Daily only for ranges up to about three months; a remembered Daily choice falls back for longer ones
  const dailyAllowed = range ? daysBetween(range) <= MAX_DAILY_DAYS : false;
  const grouping: Grouping = groupChoice && (groupChoice !== 'day' || dailyAllowed) ? groupChoice : range ? defaultGrouping(range) : 'week';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const beginRequest = useLatestRequest();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token || !range || !restored) return;
    const request = beginRequest();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to, group: grouping });
      const response = await fetch(`/api/admin/business-dashboard?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
      const body = await response.json();
      if (!request.isCurrent()) return;
      if (!response.ok) throw new Error(body.error || 'Could not load the dashboard');
      setData(body.data as DashboardData);
    } catch (e) {
      if (!request.isCurrent()) return;
      setError(e instanceof Error ? e.message : 'Could not load the dashboard');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, range?.from, range?.to, grouping, restored, beginRequest]);

  useEffect(() => {
    load();
  }, [load]);

  const applyCustom = () => {
    const problem = validateDashboardRange(customDraft);
    setCustomError(problem);
    if (!problem) {
      setCustomApplied(customDraft);
      setGroupChoice(null);
    }
  };

  const choosePreset = (id: Preset) => {
    setPreset(id);
    setGroupChoice(null);
    if (id === 'custom' && !customApplied) {
      const start = presetRange('last4', today);
      setCustomDraft(start);
    }
  };

  // the money tabs wait for the main data; Visitors and Drivers load on their own
  const showMoney = tab === 'financial' || tab === 'items';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Dashboard</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {range ? `${rangeText(range)} · ${grouping === 'day' ? 'daily' : grouping === 'week' ? 'weekly (Sat–Fri)' : 'monthly'}` : 'Pick the dates'}
          </Typography>
        </Box>
        <Tooltip title="Reload">
          <span>
            <IconButton onClick={() => load()} disabled={loading || !range} aria-label="Reload">
              <IconRefresh size={20} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* period: one scrolling row of chips on a phone */}
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, '&::-webkit-scrollbar': { display: 'none' } }}>
        {PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            onClick={() => choosePreset(p.id)}
            color={preset === p.id ? 'primary' : 'default'}
            variant={preset === p.id ? 'filled' : 'outlined'}
            sx={{ flexShrink: 0, fontWeight: preset === p.id ? 600 : 500 }}
          />
        ))}
      </Box>
      {preset === 'custom' && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', mt: 1 }}>
          <TextField size="small" type="date" label="From" value={customDraft.from} onChange={(e) => setCustomDraft((d) => ({ ...d, from: e.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} sx={{ width: 165 }} />
          <TextField size="small" type="date" label="To" value={customDraft.to} onChange={(e) => setCustomDraft((d) => ({ ...d, to: e.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} sx={{ width: 165 }} />
          <Button variant="contained" onClick={applyCustom} sx={{ height: 40 }}>Show</Button>
          {customError && <Typography variant="body2" color="error" sx={{ width: '100%' }}>{customError}</Typography>}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider', mt: 1.5, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600, px: 1.5, minWidth: 0 } }}>
          {TABS.map((t) => <Tab key={t.id} value={t.id} label={t.label} />)}
        </Tabs>
        {tab !== 'drivers' && range && (
          <ToggleButtonGroup size="small" exclusive value={grouping} onChange={(_, v) => v && setGroupChoice(v)} sx={{ mb: 0.75 }}>
            <ToggleButton value="day" disabled={!dailyAllowed} title={dailyAllowed ? undefined : 'Daily is for periods up to 3 months'} sx={{ textTransform: 'none', py: 0.25 }}>Daily</ToggleButton>
            <ToggleButton value="week" sx={{ textTransform: 'none', py: 0.25 }}>Weekly</ToggleButton>
            <ToggleButton value="month" sx={{ textTransform: 'none', py: 0.25 }}>Monthly</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {!range ? (
        <Alert severity="info">Pick a start and an end date, then press Show.</Alert>
      ) : !token ? (
        <Skeleton variant="rounded" height={360} />
      ) : showMoney ? (
        error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => load()}>Try again</Button>}>{error}</Alert>
        ) : !data ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Skeleton variant="rounded" height={130} />
            <Skeleton variant="rounded" height={360} />
            <Skeleton variant="rounded" height={300} />
          </Box>
        ) : (
          <Box sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 150ms', pointerEvents: loading ? 'none' : undefined }}>
            {tab === 'financial' ? <FinancialTab data={data} /> : <ItemsTab data={data} token={token} />}
          </Box>
        )
      ) : tab === 'visitors' ? (
        <VisitorsTab token={token} range={range} grouping={grouping} />
      ) : (
        <DriversTab token={token} range={range} />
      )}
    </Box>
  );
}
