'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Collapse, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

interface Activity {
  today: string;
  days: string[];
  onApp: { customers: number; installs: number };
  active: { today: number; last7: number; last30: number };
  newInstalls: Array<{ day: string; installs: number }>;
  daily: Array<{ day: string; customers: number | null }>;
  recordingSince: string | null;
  returning7: number | null;
  orders: Array<{ day: string; app: number; all: number; appCustomers: number }>;
  versions: Array<{ version: string; customers: number }>;
}

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

function Tile({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 0 }}>
      <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{hint}</Typography>}
    </Paper>
  );
}

/** Simple bars (no chart library): one per day, height = value, the number above it. */
function Bars({ rows, color }: { rows: Array<{ day: string; value: number | null }>; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.5, sm: 1 }, height: 150, overflowX: 'auto', pb: 0.5 }}>
      {rows.map((r) => (
        <Box key={r.day} sx={{ flex: '1 0 0', minWidth: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: r.value === null ? '#9CA3AF' : '#111827' }}>{r.value === null ? '–' : r.value}</Typography>
          <Box sx={{ width: '100%', maxWidth: 34, borderRadius: '6px 6px 0 0', bgcolor: r.value === null ? '#F3F4F6' : color, height: `${r.value === null ? 4 : Math.max(4, (r.value / max) * 90)}px` }} />
          <Typography sx={{ fontSize: 10, color: '#6B7280', mt: 0.5, lineHeight: 1.1, textAlign: 'center' }}>{weekday(r.day)}<br />{shortDay(r.day)}</Typography>
        </Box>
      ))}
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
              <Tile value={data.onApp.customers} label="Have the app" hint={`${data.onApp.installs} phones`} />
              <Tile value={todayRow?.customers ?? data.active.today} label="Opened today" />
              <Tile value={data.active.last7} label="Last 7 days" hint={`${pct}% of customers with the app`} />
              <Tile value={data.active.last30} label="Last 30 days" />
              <Tile value={data.returning7 ?? '–'} label="Came back (7 days)" hint={data.returning7 === null ? 'Needs 2 days of history' : 'Opened on 2+ days'} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Customers opening the app each day</Typography>
              <ToggleButtonGroup size="small" exclusive value={days} onChange={(_, v) => v && setDays(v)} aria-label="Days shown">
                {[7, 14, 30].map((n) => (
                  <ToggleButton key={n} value={n} sx={{ textTransform: 'none', px: 1.5, py: 0.25 }}>{n} days</ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Bars rows={data.daily.map((d) => ({ day: d.day, value: d.customers }))} color="#B8893B" />
            <Typography sx={{ fontSize: 12, color: '#6B7280', mt: 0.5 }}>
              {data.recordingSince ? `Daily counts start on ${shortDay(data.recordingSince)} (when recording began). A dash means no record for that day.` : 'Daily counts start building today: each time a customer opens the app signed in, it is counted once for that day.'}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>New phones signing in</Typography>
                <Bars rows={data.newInstalls.map((d) => ({ day: d.day, value: d.installs }))} color="#2F7D5B" />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Paid orders: app vs all</Typography>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Day', 'In the app', 'All orders', 'App share'].map((h) => (
                        <Box component="th" key={h} sx={{ textAlign: h === 'Day' ? 'left' : 'right', color: '#6B7280', fontWeight: 600, fontSize: 12, pb: 0.5 }}>{h}</Box>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.orders].slice(-7).reverse().map((o) => (
                      <tr key={o.day}>
                        <Box component="td" sx={{ py: 0.4 }}>{weekday(o.day)} {shortDay(o.day)}</Box>
                        <Box component="td" sx={{ textAlign: 'right', fontWeight: 700 }}>{o.app}</Box>
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
                <b>App versions (last 30 days):</b> {data.versions.map((v) => `${v.version} · ${v.customers}`).join('   ')}
              </Typography>
            )}
            <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>
              Downloads are not here: the App Store only shows those in App Store Connect. This counts customers who signed in on the app (older app versions are not counted).
              {loading ? ' Refreshing…' : ''}
            </Alert>
          </Box>
        )}
        {!data && !error && <Typography sx={{ mt: 1.5, fontSize: 13, color: '#6B7280' }}>Loading…</Typography>}
      </Collapse>
    </Paper>
  );
}
