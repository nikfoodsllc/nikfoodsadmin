'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Collapse, Dialog, DialogContent, DialogTitle, IconButton, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import { DrillArrow, DrillLabel, TapBarsHint } from '@/components/common/DrillHint';

interface Activity {
  today: string;
  days: string[];
  onApp: { customers: number; installs: number };
  /** iPhone vs Android (missing on an older server) */
  platforms?: Record<'ios' | 'android', { customers: number; installs: number; last30: number }>;
  active: { today: number; last7: number; last30: number };
  newInstalls: Array<{ day: string; installs: number }>;
  daily: Array<{ day: string; customers: number | null }>;
  recordingSince: string | null;
  returning7: number | null;
  orders: Array<{ day: string; app: number; appAndroid?: number; all: number; appCustomers: number }>;
  versions: Array<{ version: string; platform?: 'ios' | 'android'; customers: number }>;
  lists: {
    have: string[];
    today: string[];
    last7: string[];
    last30: string[];
    returning7: string[];
    byDay: Record<string, string[]>;
    newByDay: Record<string, string[]>;
  };
  people: Record<string, { name: string; email: string; phone: string; lastSeenAt: string | null; daysOpened: number }>;
}

interface Picked {
  title: string;
  subtitle?: string;
  ids: string[];
}

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

function Tile({ value, label, hint, onClick }: { value: string | number; label: string; hint?: string; onClick?: () => void }) {
  const clickable = Boolean(onClick) && value !== '–';
  return (
    <Paper
      variant="outlined"
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick?.()) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      sx={{ position: 'relative', p: 1.5, pr: clickable ? 4 : 1.5, borderRadius: 2, minWidth: 0, cursor: clickable ? 'pointer' : 'default', '&:hover': clickable ? { borderColor: '#B8893B', bgcolor: '#FFFBF5' } : undefined }}
    >
      {clickable && <DrillArrow />}
      <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{hint}</Typography>}
      {clickable && <DrillLabel />}
    </Paper>
  );
}

/** Simple bars (no chart library): one per day, height = value, the number above it. */
function Bars({ rows, color, onPick }: { rows: Array<{ day: string; value: number | null }>; color: string; onPick?: (day: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.25, sm: 1 }, height: 130, overflowX: 'auto', pb: 0.5 }}>
      {rows.map((r) => (
        <Box
          key={r.day}
          onClick={onPick && r.value ? () => onPick(r.day) : undefined}
          onKeyDown={onPick && r.value ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(r.day)) : undefined}
          role={onPick && r.value ? 'button' : undefined}
          tabIndex={onPick && r.value ? 0 : undefined}
          aria-label={onPick && r.value ? `${r.value} on ${shortDay(r.day)}: see names` : undefined}
          sx={{ cursor: onPick && r.value ? 'pointer' : 'default', '&:hover > div:nth-of-type(2)': onPick && r.value ? { filter: 'brightness(0.9)' } : undefined, flex: '1 0 0', minWidth: { xs: 17, sm: 22 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: r.value === null ? '#9CA3AF' : '#111827' }}>{r.value === null ? '–' : r.value}</Typography>
          <Box sx={{ width: '100%', maxWidth: 34, borderRadius: '6px 6px 0 0', bgcolor: r.value === null ? '#F3F4F6' : color, height: `${r.value === null ? 4 : Math.max(4, (r.value / max) * 90)}px` }} />
          <Typography sx={{ fontSize: { xs: 9, sm: 10 }, color: '#6B7280', mt: 0.5, lineHeight: 1.1, textAlign: 'center' }}>{weekday(r.day)}<br />{shortDay(r.day)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const APP_COLOR = '#2F7D5B';
const WEB_COLOR = '#D9CBB0';

/** Paid orders per day as stacked bars: app at the bottom, website on top, the day's total above. */
function OrderMixBars({ rows }: { rows: Array<{ day: string; app: number; all: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.all));
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 0.75, fontSize: 12, color: '#374151' }}>
        {[['App', APP_COLOR], ['Website', WEB_COLOR]].map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color }} />
            {label}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.25, sm: 1 }, height: 165, overflowX: 'auto', pb: 0.5 }}>
        {rows.map((r) => {
          const web = Math.max(0, r.all - r.app);
          const total = 100;
          const appH = r.all ? (r.app / max) * total : 0;
          const webH = r.all ? (web / max) * total : 0;
          const label = `${weekday(r.day)} ${shortDay(r.day)}: ${r.app} app, ${web} website${r.all ? ` (${Math.round((r.app / r.all) * 100)}% app)` : ''}`;
          return (
            <Box key={r.day} title={label} aria-label={label} role="img" sx={{ flex: '1 0 0', minWidth: { xs: 17, sm: 22 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: r.all ? '#111827' : '#9CA3AF' }}>{r.all || '–'}</Typography>
              <Box sx={{ width: '100%', maxWidth: 34, display: 'flex', flexDirection: 'column', gap: web && r.app ? '2px' : 0 }}>
                {web > 0 && <Box sx={{ height: `${Math.max(3, webH)}px`, bgcolor: WEB_COLOR, borderRadius: '6px 6px 0 0' }} />}
                {r.app > 0 && (
                  <Box sx={{ height: `${Math.max(3, appH)}px`, bgcolor: APP_COLOR, borderRadius: web ? 0 : '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {appH >= 12 && <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{r.app}</Typography>}
                  </Box>
                )}
                {!r.all && <Box sx={{ height: 4, bgcolor: '#F3F4F6', borderRadius: '6px 6px 0 0' }} />}
              </Box>
              <Typography sx={{ fontSize: { xs: 9, sm: 10 }, color: '#6B7280', mt: 0.5, lineHeight: 1.1, textAlign: 'center' }}>{weekday(r.day)}<br />{shortDay(r.day)}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

type Call = (path: string) => Promise<{ ok: boolean; status: number; json: { data?: unknown; error?: string } }>;

export default function AppActivitySection({ call }: { call: Call }) {
  const [open, setOpen] = useState(true);
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call(`app-activity?days=${days}`);
    if (r.ok) {
      setData(r.json.data as Activity);
      setError('');
    } else setError(r.json.error || 'Could not load the app activity');
    setLoading(false);
  }, [call, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const todayRow = data?.daily.find((d) => d.day === data.today);
  const pct = data && data.onApp.customers > 0 ? Math.round((data.active.last7 / data.onApp.customers) * 100) : 0;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>App activity</Typography>
          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Customers who came to the app, signed in</Typography>
        </Box>
        <Button size="small" onClick={() => setOpen((v) => !v)} endIcon={open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />} sx={{ textTransform: 'none', fontWeight: 600 }}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </Box>
      <Collapse in={open}>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        {data && (
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' }, gap: 1.25, mb: 2 }}>
              <Tile value={data.onApp.customers} label="Have the app" hint={data.platforms ? `${data.platforms.ios.customers} iPhone · ${data.platforms.android.customers} Android` : `${data.onApp.installs} phones`} onClick={() => setPicked({ title: 'Customers with the app', ids: data.lists.have })} />
              <Tile value={todayRow?.customers ?? data.active.today} label="Opened today" onClick={() => setPicked({ title: 'Opened the app today', ids: data.lists.byDay[data.today] ?? data.lists.today })} />
              <Tile value={data.active.last7} label="Last 7 days" hint={`${pct}% of customers with the app`} onClick={() => setPicked({ title: 'Opened the app in the last 7 days', ids: data.lists.last7 })} />
              <Tile value={data.active.last30} label="Last 30 days" onClick={() => setPicked({ title: 'Opened the app in the last 30 days', ids: data.lists.last30 })} />
              <Tile value={data.returning7 ?? '–'} label="Came back (7 days)" hint={data.returning7 === null ? 'Needs 2 days of history' : 'Opened on 2+ days'} onClick={() => setPicked({ title: 'Came back (opened on 2 or more days in the last 7)', ids: data.lists.returning7 })} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Customers opening the app each day</Typography>
              <ToggleButtonGroup size="small" exclusive value={days} onChange={(_, v) => v && setDays(v)} aria-label="Days shown">
                {[7, 14, 30].map((n) => (
                  <ToggleButton key={n} value={n} sx={{ textTransform: 'none', px: 1.5, py: 0.25 }}>{n} days</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <TapBarsHint />
            <Bars rows={data.daily.map((d) => ({ day: d.day, value: d.customers }))} color="#B8893B" onPick={(day) => setPicked({ title: `Opened the app on ${weekday(day)} ${shortDay(day)}`, ids: data.lists.byDay[day] ?? [] })} />
            <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
              {data.recordingSince ? `Daily counts start on ${shortDay(data.recordingSince)} (when recording began). A dash means no record for that day.` : 'Daily counts start building today: each time a customer opens the app signed in, it is counted once for that day.'}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>New phones signing in</Typography>
                <TapBarsHint />
                <Bars rows={data.newInstalls.map((d) => ({ day: d.day, value: d.installs }))} color="#2F7D5B" onPick={(day) => setPicked({ title: `New phones on ${weekday(day)} ${shortDay(day)}`, subtitle: 'Customers whose phone signed in for the first time that day', ids: data.lists.newByDay[day] ?? [] })} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Paid orders: app vs all</Typography>
                <OrderMixBars rows={data.orders} />
                <Box sx={{ mt: 1.5 }} />
                <Box component="table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Day', 'App', 'Android', 'All', 'App %'].map((h) => (
                        <Box component="th" key={h} sx={{ width: h === 'Day' ? '32%' : '17%', textAlign: h === 'Day' ? 'left' : 'right', color: '#6B7280', fontWeight: 600, fontSize: 12, pb: 0.5 }}>{h}</Box>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.orders].slice(-7).reverse().map((o) => (
                      <tr key={o.day}>
                        <Box component="td" sx={{ py: 0.4 }}>{weekday(o.day)} {shortDay(o.day)}</Box>
                        <Box component="td" sx={{ textAlign: 'right', fontWeight: 700 }}>{o.app}</Box>
                        <Box component="td" sx={{ textAlign: 'right', color: '#6B7280' }}>{o.appAndroid ?? 0}</Box>
                        <Box component="td" sx={{ textAlign: 'right' }}>{o.all}</Box>
                        <Box component="td" sx={{ textAlign: 'right', color: '#6B7280' }}>{o.all ? `${Math.round((o.app / o.all) * 100)}%` : '–'}</Box>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </Box>

            {data.versions.length > 0 && (
              <Typography sx={{ fontSize: 12, color: '#374151', mt: 2 }}>
                <b>App versions (last 30 days):</b> {data.versions.map((v) => `${v.platform === 'android' ? 'Android' : 'iPhone'} ${v.version} · ${v.customers}`).join('   ')}
              </Typography>
            )}
            <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>
              Downloads are not here: the App Store and Google Play only show those in App Store Connect and Play Console. This counts customers who signed in on the app (older app versions are not counted).
              {loading ? ' Refreshing…' : ''}
            </Alert>
          </Box>
        )}
        {!data && !error && <Typography sx={{ mt: 1.5, fontSize: 13, color: '#6B7280' }}>Loading…</Typography>}
      </Collapse>

      <Dialog open={Boolean(picked)} onClose={() => setPicked(null)} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pr: 6, fontWeight: 700, fontSize: 17 }}>
          {picked?.title}
          <Typography sx={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>
            {picked ? `${picked.ids.length} customer${picked.ids.length === 1 ? '' : 's'}` : ''}
            {picked?.subtitle ? ` · ${picked.subtitle}` : ''}
          </Typography>
          <IconButton aria-label="Close" onClick={() => setPicked(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <IconX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 1.5, sm: 2 } }}>
          {picked && data && picked.ids.length === 0 && <Typography sx={{ color: '#6B7280', fontSize: 14 }}>No customers.</Typography>}
          {picked && data && [...picked.ids]
            .sort((a, b) => (data.people[b]?.lastSeenAt ?? '').localeCompare(data.people[a]?.lastSeenAt ?? ''))
            .map((id) => {
              const p = data.people[id];
              return (
                <Box key={id} sx={{ py: 1, borderBottom: '1px solid #F3F4F6', '&:last-of-type': { borderBottom: 0 } }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{p?.name || 'No name'}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#6B7280', overflowWrap: 'anywhere' }}>{[p?.phone, p?.email].filter(Boolean).join(' · ') || 'No contact details'}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#374151' }}>
                    {p?.lastSeenAt ? `Last opened ${new Date(p.lastSeenAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT` : 'Not opened yet'}
                    {p && p.daysOpened > 0 ? ` · opened on ${p.daysOpened} of the days shown` : ''}
                  </Typography>
                </Box>
              );
            })}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
