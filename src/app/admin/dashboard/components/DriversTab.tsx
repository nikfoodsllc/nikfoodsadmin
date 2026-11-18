'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { count, EmptyNote, money2, rangeText, Section, SimpleTable } from './ui';
import { DRIVER_PAY, formatMinutes, shortDay, type DriverSummary } from '@/utils/businessDashboard';

interface DriversAnswer {
  available: boolean;
  error?: string;
  from?: string;
  to?: string;
  shortened?: boolean;
  drivers?: DriverSummary[];
  all?: DriverSummary;
  routes?: Array<{ date: string; driverName: string; driverSerial: string; plannedMinutes: number; deliveries: number; paidMinutes: number; total: number }>;
}

function DriverCard({ d, highlight }: { d: DriverSummary; highlight?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 0, bgcolor: highlight ? '#faf9f6' : undefined }}>
      <Typography sx={{ fontWeight: 700 }}>{d.driver}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {count(d.days)} {highlight ? 'driver days' : d.days === 1 ? 'day' : 'days'} · {d.deliveriesPerDay} deliveries a day
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1.5 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Cost per delivery</Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{money2(d.costPerDelivery)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Pay per day</Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{money2(d.payPerDay)}</Typography>
        </Box>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
        Total {money2(d.pay)} for {count(d.deliveries)} deliveries
      </Typography>
    </Paper>
  );
}

export default function DriversTab({ token, range }: { token: string; range: { from: string; to: string } }) {
  const [data, setData] = useState<DriversAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/admin/business-dashboard/drivers?from=${range.from}&to=${range.to}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Could not load the routes');
        setData(body.data);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the routes');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, range.from, range.to]);

  const rule = `Pay = planned route time + ${DRIVER_PAY.bufferMinutes} min, rounded up to ${DRIVER_PAY.roundToMinutes} min, × $${DRIVER_PAY.hourlyRate}/hour, + $${DRIVER_PAY.perDelivery} per delivery`;

  return (
    <Section title="Driver pay" subtitle={rule}>
      {loading && !data ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : data && !data.available ? (
        <Alert severity="warning">{data.error}</Alert>
      ) : data && (data.routes ?? []).length === 0 ? (
        <EmptyNote>No planned routes in this period.</EmptyNote>
      ) : data ? (
        <Box sx={{ opacity: loading ? 0.5 : 1 }}>
          {data.shortened && data.from && data.to && (
            <Alert severity="info" sx={{ mb: 2 }}>Driver pay covers the latest 120 days of the period: {rangeText({ from: data.from, to: data.to })}.</Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(240px, 1fr))' }, gap: 2, mb: 3 }}>
            {(data.drivers ?? []).map((d) => <DriverCard key={d.driver} d={d} />)}
            {data.all && (data.drivers ?? []).length > 1 && <DriverCard d={data.all} highlight />}
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1 }}>Each route</Typography>
          <SimpleTable
            head={['Day', 'Driver', 'Time', 'Stops', 'Pay']}
            align={['left', 'left', 'right', 'right', 'right']}
            rows={(data.routes ?? []).slice(0, showAll ? undefined : 10).map((r) => [
              shortDay(r.date),
              <Box key="d" sx={{ whiteSpace: 'normal' }}>{r.driverName || `Driver ${r.driverSerial}`}</Box>,
              <Box key="t" sx={{ lineHeight: 1.3, minWidth: 54 }}>
                {formatMinutes(r.paidMinutes)}
                <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary', whiteSpace: 'normal' }}>planned {formatMinutes(r.plannedMinutes)}</Box>
              </Box>,
              count(r.deliveries),
              <Box key="p" sx={{ lineHeight: 1.3 }}>
                <strong>{money2(r.total)}</strong>
                <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>{money2(r.deliveries > 0 ? r.total / r.deliveries : 0)}/stop</Box>
              </Box>,
            ])}
          />
          {(data.routes ?? []).length > 10 && (
            <Button size="small" onClick={() => setShowAll((v) => !v)} sx={{ mt: 1 }}>
              {showAll ? 'Show the latest 10' : `Show all ${(data.routes ?? []).length} routes`}
            </Button>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Uses the time OptimoRoute planned for each route, not the time the driver actually took. Drivers are grouped by their name in OptimoRoute.
          </Typography>
        </Box>
      ) : null}
    </Section>
  );
}
