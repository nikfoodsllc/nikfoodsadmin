'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { IconRefresh } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatPSTDateISO } from '@/utils/timezone';
import {
  formatDayShort,
  formatRangeLabel,
  getPresetRange,
  validateRange,
  type DayRange,
  type KitchenDay,
  type KitchenItem,
  type WeekPreset,
} from '@/utils/kitchenDashboard';

const PRESETS: Array<{ id: WeekPreset; label: string }> = [
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'weekBeforeLast', label: 'Week before last' },
  { id: 'custom', label: 'Custom dates' },
];

function CountChips({ lines }: { lines: Array<{ label: string; quantity: number }> }) {
  if (lines.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {lines.map((line) => (
        <Chip
          key={line.label}
          size="small"
          label={`${line.label} × ${line.quantity}`}
          sx={{ height: 22, fontSize: 12, bgcolor: '#F3F4F6', color: '#374151' }}
        />
      ))}
    </Box>
  );
}

function ItemRow({ item }: { item: KitchenItem }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1.25,
        borderBottom: '1px solid #F3F4F6',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#111827', lineHeight: 1.3, wordBreak: 'break-word' }}>
          {item.name}
        </Typography>
        <CountChips lines={item.portions} />
        {item.spice.length > 0 && (
          <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
            Spice: {item.spice.map((s) => `${s.label} × ${s.quantity}`).join(', ')}
          </Typography>
        )}
        {item.inCombos > 0 && (
          <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.25 }}>
            includes {item.inCombos} inside combos
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 22, color: '#111827', lineHeight: 1.1, flexShrink: 0 }}>
        {item.quantity}
      </Typography>
    </Box>
  );
}

function DayCard({ day, isToday }: { day: KitchenDay; isToday: boolean }) {
  const empty = day.items.length === 0 && day.combos.length === 0;
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: isToday ? 'primary.main' : '#E5E7EB',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: empty ? '#FAFAFA' : '#fff',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E5E7EB', bgcolor: isToday ? 'rgba(93,135,255,0.08)' : '#F9FAFB' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>
            {day.weekday}
            {isToday && (
              <Chip size="small" color="primary" label="Today" sx={{ ml: 1, height: 20, fontSize: 11 }} />
            )}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{formatDayShort(day.day)}</Typography>
        </Box>
        {!empty && (
          <Typography sx={{ fontSize: 12.5, color: '#6B7280', mt: 0.5 }}>
            {day.totals.units} {day.totals.units === 1 ? 'unit' : 'units'} · {day.totals.orders}{' '}
            {day.totals.orders === 1 ? 'order' : 'orders'}
            {day.totals.ecoContainers > 0 ? ` · ♻️ ${day.totals.ecoContainers} eco` : ''}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: 2, py: 0.5 }}>
        {empty ? (
          <Typography sx={{ color: '#9CA3AF', fontSize: 14, py: 2 }}>Nothing ordered for this day.</Typography>
        ) : (
          <>
            {day.items.map((item) => (
              <ItemRow key={item.name} item={item} />
            ))}
          </>
        )}
      </Box>

      {day.combos.length > 0 && (
        <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid #E5E7EB', bgcolor: '#FFFBEB' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400E', mb: 0.5 }}>
            Combos to pack
          </Typography>
          {day.combos.map((combo) => (
            <Box key={combo.name} sx={{ py: 0.75 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#111827', wordBreak: 'break-word' }}>{combo.name}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#111827', flexShrink: 0 }}>{combo.quantity}</Typography>
              </Box>
              {combo.spice.length > 0 && (
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                  Spice: {combo.spice.map((s) => `${s.label} × ${s.quantity}`).join(', ')}
                </Typography>
              )}
              {combo.parts.length > 0 && (
                <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.25 }}>
                  {combo.parts
                    .map((p) => `${p.name}${p.portion ? ` (${p.portion})` : ''} × ${p.quantity}`)
                    .join(' · ')}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

export default function KitchenDashboardPage() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const today = useMemo(() => formatPSTDateISO(new Date()), []);
  const [preset, setPreset] = useState<WeekPreset>('thisWeek');
  const [customDraft, setCustomDraft] = useState<DayRange>({ startDate: '', endDate: '' });
  const [customApplied, setCustomApplied] = useState<DayRange | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

  const [days, setDays] = useState<KitchenDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range: DayRange | null = useMemo(() => {
    if (preset === 'custom') return customApplied;
    return getPresetRange(preset, today);
  }, [preset, customApplied, today]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [authLoading, isAuthenticated, router]);

  const load = useCallback(async () => {
    if (!token || !range) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      const response = await fetch(`/api/admin/kitchen-dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Could not load the kitchen dashboard');
      setDays(body.data?.days ?? []);
    } catch (e) {
      setDays([]);
      setError(e instanceof Error ? e.message : 'Could not load the kitchen dashboard');
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    load();
  }, [load]);

  const applyCustom = () => {
    const problem = validateRange(customDraft);
    setCustomError(problem);
    if (!problem) setCustomApplied({ ...customDraft });
  };

  const selectPreset = (next: WeekPreset) => {
    setPreset(next);
    setCustomError(null);
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!isAuthenticated) return null;

  const totalUnits = days.reduce((sum, d) => sum + d.totals.units, 0);
  const busyDays = days.filter((d) => d.items.length > 0 || d.combos.length > 0).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: 20, color: '#111827' }}>
            Kitchen Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280', mt: 0.5 }}>
            What to cook on each day, by the menu day each item belongs to. Paid orders only; cancelled and refunded orders are left out.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={load} disabled={loading || !range} aria-label="Refresh">
              <IconRefresh size={20} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2, mb: 2.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              clickable
              color={preset === p.id ? 'primary' : 'default'}
              variant={preset === p.id ? 'filled' : 'outlined'}
              onClick={() => selectPreset(p.id)}
              sx={{ fontWeight: 500 }}
            />
          ))}
        </Box>

        {preset === 'custom' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start', mt: 2 }}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={customDraft.startDate}
              onChange={(e) => setCustomDraft((d) => ({ ...d, startDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={customDraft.endDate}
              onChange={(e) => setCustomDraft((d) => ({ ...d, endDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <Button variant="contained" onClick={applyCustom} sx={{ height: 40 }}>
              Show
            </Button>
            {customError && (
              <Typography sx={{ color: 'error.main', fontSize: 13, width: '100%' }}>{customError}</Typography>
            )}
          </Box>
        )}

        {range && (
          <Typography sx={{ mt: 1.5, fontSize: 13.5, color: '#6B7280' }}>
            {formatRangeLabel(range)}
            {!loading && !error && days.length > 0 ? ` · ${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'} across ${busyDays} ${busyDays === 1 ? 'day' : 'days'}` : ''}
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!range && preset === 'custom' && (
        <Typography sx={{ color: '#6B7280' }}>Pick a start and an end date, then press Show.</Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2, alignItems: 'start' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={220} />)
          : days.map((day) => <DayCard key={day.day} day={day} isToday={day.day === today} />)}
      </Box>
    </Box>
  );
}
